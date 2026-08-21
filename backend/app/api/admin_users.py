import structlog
import re
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import AdminUser, AdminStatus, AuditEvent, AuditLog
from app.models_rbac import AdminRole as AdminRoleModel, Permission
from app.api.deps import get_current_admin, require_permission
from app.security.passwords import hash_password

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api", tags=["admin-users"])

_PASSWORD_MIN = 12


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    display_name: str = Field(min_length=1, max_length=160)
    email: str | None = None
    password: str = Field(min_length=_PASSWORD_MIN, max_length=256)
    role: str = "support"
    telegram_chat_id: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain a special character")
        if v != v.strip():
            raise ValueError("Password must not have leading or trailing whitespace")
        return v


class UpdateUserRequest(BaseModel):
    display_name: str | None = None
    email: str | None = None
    role: str | None = None
    telegram_chat_id: str | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=_PASSWORD_MIN, max_length=256)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain a special character")
        if v != v.strip():
            raise ValueError("Password must not have leading or trailing whitespace")
        return v


def _audit(db: AsyncSession, event: AuditEvent, actor_id=None, target_id=None, ip=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=actor_id,
        target_admin_id=target_id,
        ip_address=ip,
        metadata_=meta or {},
    ))


def _user_to_dict(user: AdminUser) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "role_id": str(user.role_id) if user.role_id else None,
        "status": user.status.value if hasattr(user.status, "value") else user.status,
        "telegram_chat_id": user.telegram_chat_id,
        "telegram_username": user.telegram_username,
        "totp_enabled": user.totp_enabled,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/users")
async def list_users(
    admin: AdminUser = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).order_by(AdminUser.created_at))
    users = result.scalars().all()
    return {"items": [_user_to_dict(u) for u in users]}


@router.post("/users")
async def create_user(
    body: CreateUserRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    # Check username uniqueness
    existing = await db.execute(select(AdminUser).where(AdminUser.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "username_taken")

    # Check email uniqueness
    if body.email:
        existing_email = await db.execute(select(AdminUser).where(AdminUser.email == body.email))
        if existing_email.scalar_one_or_none():
            raise HTTPException(400, "email_taken")

    # Validate role exists
    role_result = await db.execute(select(AdminRoleModel).where(AdminRoleModel.name == body.role))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(400, "invalid_role")

    # Only owner can assign owner role
    if body.role == "owner" and (admin.role.value if hasattr(admin.role, "value") else admin.role) != "owner":
        raise HTTPException(403, "only_owner_can_assign_owner")

    new_user = AdminUser(
        username=body.username,
        display_name=body.display_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role_id=role.id,
        role=body.role,
        status=AdminStatus.active,
        telegram_chat_id=body.telegram_chat_id,
    )
    db.add(new_user)
    await db.flush()

    _audit(db, AuditEvent.admin_created, actor_id=admin.id, target_id=new_user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": new_user.username, "role": body.role})

    await db.commit()
    return _user_to_dict(new_user)


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    admin: AdminUser = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")
    return _user_to_dict(user)


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_UPDATE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    if body.display_name is not None:
        user.display_name = body.display_name
    if body.email is not None:
        user.email = body.email
    if body.telegram_chat_id is not None:
        user.telegram_chat_id = body.telegram_chat_id
    if body.role is not None:
        # Validate role
        role_result = await db.execute(select(AdminRoleModel).where(AdminRoleModel.name == body.role))
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(400, "invalid_role")

        # Only owner can assign owner role
        actor_role = admin.role.value if hasattr(admin.role, "value") else admin.role
        if body.role == "owner" and actor_role != "owner":
            raise HTTPException(403, "only_owner_can_assign_owner")

        # Prevent removing last owner
        if user.role == "owner" and body.role != "owner":
            owner_count = await db.execute(
                select(func.count(AdminUser.id)).where(
                    AdminUser.role == "owner",
                    AdminUser.status == AdminStatus.active,
                )
            )
            if owner_count.scalar() <= 1:
                raise HTTPException(400, "cannot_remove_last_owner")

        user.role = body.role
        user.role_id = role.id

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username})

    await db.commit()
    return _user_to_dict(user)


@router.post("/users/{user_id}/disable")
async def disable_user(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_DISABLE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    # Prevent disabling yourself
    if user.id == admin.id:
        raise HTTPException(400, "cannot_disable_self")

    # Prevent disabling last owner
    if user.role == "owner":
        owner_count = await db.execute(
            select(func.count(AdminUser.id)).where(
                AdminUser.role == "owner",
                AdminUser.status == AdminStatus.active,
            )
        )
        if owner_count.scalar() <= 1:
            raise HTTPException(400, "cannot_disable_last_owner")

    user.status = AdminStatus.disabled

    # Revoke all sessions
    from app.models import AdminSession
    await db.execute(
        select(AdminSession).where(
            AdminSession.admin_id == user.id,
            AdminSession.revoked_at.is_(None),
        )
    )
    # Mark all sessions as revoked
    from sqlalchemy import update
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.admin_disabled, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username})

    await db.commit()
    return {"status": "disabled"}


@router.post("/users/{user_id}/enable")
async def enable_user(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_DISABLE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    user.status = AdminStatus.active

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username, "action": "enabled"})

    await db.commit()
    return {"status": "enabled"}


@router.post("/users/{user_id}/revoke-sessions")
async def revoke_sessions(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_DISABLE)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    from app.models import AdminSession
    from sqlalchemy import update
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username, "action": "sessions_revoked"})

    await db.commit()
    return {"status": "sessions_revoked"}


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: str,
    body: ResetPasswordRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_RESET_PASSWORD)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    user.password_hash = hash_password(body.new_password)
    user.password_changed_at = datetime.now(timezone.utc)

    # Revoke all sessions
    from app.models import AdminSession
    from sqlalchemy import update
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.password_changed, actor_id=admin.id, target_id=user.id,
           ip=request.client.host if request.client else None,
           meta={"target_username": user.username})

    await db.commit()
    return {"status": "password_reset"}


# Compatibility alias
@router.get("/admin-users")
async def list_users_compat(
    admin: AdminUser = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    return await list_users(admin=admin, db=db)


# Roles
@router.get("/roles")
async def list_roles(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models_rbac import AdminRole as RoleModel, AdminRolePermission, AdminPermission
    result = await db.execute(select(RoleModel).order_by(RoleModel.name))
    roles = result.scalars().all()
    items = []
    for role in roles:
        perm_result = await db.execute(
            select(AdminPermission.key)
            .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
            .where(AdminRolePermission.role_id == role.id)
        )
        perms = [row[0] for row in perm_result.all()]
        items.append({
            "id": str(role.id),
            "name": role.name,
            "description": role.description,
            "is_system": role.is_system,
            "permissions": perms,
        })
    return {"items": items}


@router.get("/permissions")
async def list_permissions(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models_rbac import AdminPermission
    result = await db.execute(select(AdminPermission).order_by(AdminPermission.category, AdminPermission.key))
    perms = result.scalars().all()
    return {
        "items": [
            {"id": str(p.id), "key": p.key, "description": p.description, "category": p.category}
            for p in perms
        ]
    }
