import structlog
import re
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from app.db import get_db
from app.models import AdminUser, AdminStatus, AuditEvent, AuditLog
from app.models_rbac import AdminRole as AdminRoleModel, Permission
from app.models_rbac import AdminPermission, AdminRolePermission
from app.api.deps import (
    get_current_admin,
    require_permission,
    get_admin_role_level,
    assert_can_manage,
)
from app.security.passwords import hash_password

logger = structlog.get_logger()
router = APIRouter(prefix="/admin/api", tags=["admin-users"])

_PASSWORD_MIN = 12
_RESERVED_ROLE_NAMES = {"owner", "admin", "manager", "support", "viewer", "operator"}
_ROLE_NAME_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")


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


class CreateRoleRequest(BaseModel):
    name: str = Field(min_length=2, max_length=64)
    description: str | None = None
    level: int = Field(default=40, ge=1, le=99)
    permissions: list[str] = Field(default_factory=list)


def _audit(db: AsyncSession, event: AuditEvent, actor_id=None, target_id=None, ip=None, meta=None):
    db.add(AuditLog(
        event=event,
        actor_admin_id=actor_id,
        target_admin_id=target_id,
        ip_address=ip,
        metadata_=meta or {},
    ))


def _user_to_dict(
    user: AdminUser,
    creator: AdminUser | None = None,
    role_row: AdminRoleModel | None = None,
) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "role_level": role_row.level if role_row else None,
        "role_id": str(user.role_id) if user.role_id else None,
        "status": user.status.value if hasattr(user.status, "value") else user.status,
        "telegram_chat_id": user.telegram_chat_id,
        "telegram_username": user.telegram_username,
        "totp_enabled": user.totp_enabled,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "locked_until": user.locked_until.isoformat() if user.locked_until else None,
        "failed_login_count": user.failed_login_count or 0,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "created_by": (
            {
                "id": str(creator.id),
                "username": creator.username,
                "display_name": creator.display_name,
            }
            if creator
            else None
        ),
    }


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _resolve_assignable_role(
    db: AsyncSession, role_name: str, actor: AdminUser
) -> AdminRoleModel:
    """Fetch the role row and enforce that the actor may assign it."""
    result = await db.execute(select(AdminRoleModel).where(AdminRoleModel.name == role_name))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=400, detail="invalid_role")

    actor_is_owner = actor.role == "owner"
    if role.name == "owner" and not actor_is_owner:
        raise HTTPException(status_code=403, detail="only_owner_can_assign_owner")

    if not actor_is_owner:
        actor_level = await get_admin_role_level(db, actor)
        if role.level >= actor_level:
            raise HTTPException(status_code=403, detail="cannot_assign_role_at_or_above_yours")
    return role


@router.get("/users")
async def list_users(
    admin: AdminUser = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    Creator = aliased(AdminUser)
    result = await db.execute(
        select(AdminUser, Creator, AdminRoleModel)
        .outerjoin(Creator, AdminUser.created_by == Creator.id)
        .outerjoin(AdminRoleModel, AdminUser.role_id == AdminRoleModel.id)
        .order_by(AdminUser.created_at)
    )
    users = result.all()
    return {"items": [_user_to_dict(u, creator=c, role_row=r) for u, c, r in users]}


@router.post("/users/create")
async def create_user(
    body: CreateUserRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.USERS_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    # Check username uniqueness
    existing = await db.execute(select(AdminUser.id).where(AdminUser.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="username_taken")

    # Check email uniqueness
    if body.email:
        existing_email = await db.execute(select(AdminUser.id).where(AdminUser.email == body.email))
        if existing_email.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="email_taken")

    role = await _resolve_assignable_role(db, body.role, admin)

    new_user = AdminUser(
        username=body.username,
        display_name=body.display_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role_id=role.id,
        role=role.name,
        status=AdminStatus.active,
        telegram_chat_id=body.telegram_chat_id,
        created_by=admin.id,
    )
    db.add(new_user)
    try:
        await db.flush()
        _audit(db, AuditEvent.admin_created, actor_id=admin.id, target_id=new_user.id,
               ip=_client_ip(request),
               meta={"target_username": new_user.username, "role": role.name})
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.error("admin_user_create_conflict",
                     username=body.username,
                     error=str(exc.__cause__ or exc))
        raise HTTPException(status_code=409, detail="username_taken")

    return _user_to_dict(new_user, creator=admin, role_row=role)


@router.get("/users/check-availability")
async def check_user_availability(
    username: str | None = None,
    email: str | None = None,
    admin: AdminUser = Depends(require_permission(Permission.USERS_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    response: dict = {}

    if username is not None:
        candidate = username.strip()
        taken = False
        suggestions: list[str] = []
        if len(candidate) >= 3:
            row = await db.execute(
                select(AdminUser.id).where(AdminUser.username == candidate)
            )
            taken = row.scalar_one_or_none() is not None
            if taken:
                base = re.sub(r"[^a-zA-Z0-9._-]", "", candidate)[:56] or "user"
                for n in range(1, 31):
                    if len(suggestions) >= 3:
                        break
                    probe = f"{base}{n}"
                    exists = await db.execute(
                        select(AdminUser.id).where(AdminUser.username == probe)
                    )
                    if exists.scalar_one_or_none() is None:
                        suggestions.append(probe)
        response["username"] = {
            "available": len(candidate) >= 3 and not taken,
            "taken": taken,
            "suggestions": suggestions,
        }

    if email is not None:
        candidate = email.strip()
        if candidate:
            row = await db.execute(
                select(AdminUser.id).where(AdminUser.email == candidate)
            )
            email_taken = row.scalar_one_or_none() is not None
            response["email"] = {
                "available": not email_taken,
                "taken": email_taken,
            }

    return response


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    admin: AdminUser = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    Creator = aliased(AdminUser)
    result = await db.execute(
        select(AdminUser, Creator, AdminRoleModel)
        .outerjoin(Creator, AdminUser.created_by == Creator.id)
        .outerjoin(AdminRoleModel, AdminUser.role_id == AdminRoleModel.id)
        .where(AdminUser.id == UUID(user_id))
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "user_not_found")
    user, creator, role_row = row
    return _user_to_dict(user, creator=creator, role_row=role_row)


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

    editing_self = user.id == admin.id

    if body.role is not None:
        # Role changes always go through the hierarchy gate (blocks self-edit too).
        await assert_can_manage(db, admin, user)
        role = await _resolve_assignable_role(db, body.role, admin)

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

        user.role = role.name
        user.role_id = role.id
    elif not editing_self:
        # Profile edits on other users still respect the hierarchy.
        await assert_can_manage(db, admin, user)

    if body.display_name is not None:
        user.display_name = body.display_name

    if body.email is not None:
        if body.email != (user.email or ""):
            clash = await db.execute(
                select(AdminUser.id).where(
                    AdminUser.email == body.email,
                    AdminUser.id != user.id,
                )
            )
            if clash.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="email_taken")
        user.email = body.email or None

    if body.telegram_chat_id is not None:
        user.telegram_chat_id = body.telegram_chat_id

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username})

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.error("admin_user_update_conflict",
                     target=str(user.id), error=str(exc.__cause__ or exc))
        raise HTTPException(status_code=409, detail="email_taken")

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

    await assert_can_manage(db, admin, user)

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

    # Mark all sessions as revoked
    from app.models import AdminSession
    from sqlalchemy import update
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.admin_disabled, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
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

    await assert_can_manage(db, admin, user)

    user.status = AdminStatus.active

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username, "action": "enabled"})

    await db.commit()
    return {"status": "enabled"}


@router.post("/users/{user_id}/unlock")
async def unlock_user(
    user_id: str,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    actor_level = await get_admin_role_level(db, admin)
    if actor_level is None or actor_level < 60:
        raise HTTPException(403, "unlock_requires_top_three_ranks")

    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "user_not_found")

    was_locked = bool(user.locked_until) or (user.failed_login_count or 0) > 0
    user.locked_until = None
    user.failed_login_count = 0

    from app.security.devices import log_security_event
    from app.models import SecurityEventType
    await log_security_event(
        db, SecurityEventType.account_unlocked, severity="medium",
        admin_id=user.id,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        path=request.url.path, method="POST",
        reason=f"Suspension revoked by {admin.username}",
        metadata={
            "actor_admin_id": str(admin.id),
            "actor_username": admin.username,
            "target_username": user.username,
            "was_locked": was_locked,
        },
    )

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
           meta={"target_username": user.username, "action": "unlocked"})

    await db.commit()
    return {"status": "unlocked", "was_locked": was_locked}


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

    await assert_can_manage(db, admin, user)

    from app.models import AdminSession
    from sqlalchemy import update
    await db.execute(
        update(AdminSession)
        .where(AdminSession.admin_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )

    _audit(db, AuditEvent.admin_updated, actor_id=admin.id, target_id=user.id,
           ip=_client_ip(request),
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

    await assert_can_manage(db, admin, user)

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
           ip=_client_ip(request),
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
    user_counts = (
        select(AdminUser.role_id.label("role_id"), func.count().label("cnt"))
        .group_by(AdminUser.role_id)
        .subquery()
    )
    result = await db.execute(
        select(AdminRoleModel, func.coalesce(user_counts.c.cnt, 0))
        .outerjoin(user_counts, user_counts.c.role_id == AdminRoleModel.id)
        .order_by(AdminRoleModel.level.desc(), AdminRoleModel.name)
    )
    roles = result.all()

    items = []
    for role, user_count in roles:
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
            "level": role.level,
            "user_count": int(user_count),
            "permissions": perms,
        })
    return {"items": items}


@router.post("/roles")
async def create_role(
    body: CreateRoleRequest,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.ROLES_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    name = body.name.strip().lower()
    if not _ROLE_NAME_RE.match(name):
        raise HTTPException(400, "invalid_role_name")
    if name in _RESERVED_ROLE_NAMES:
        raise HTTPException(400, "reserved_role_name")

    dup = await db.execute(select(AdminRoleModel.id).where(AdminRoleModel.name == name))
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="role_name_taken")

    if admin.role != "owner":
        actor_level = await get_admin_role_level(db, admin)
        if body.level >= actor_level:
            raise HTTPException(status_code=403, detail="role_level_above_yours")

    perm_keys = sorted(set(body.permissions))
    perm_rows: list[AdminPermission] = []
    if perm_keys:
        perm_result = await db.execute(
            select(AdminPermission).where(AdminPermission.key.in_(perm_keys))
        )
        perm_rows = list(perm_result.scalars().all())
    if len(perm_rows) != len(perm_keys):
        raise HTTPException(400, "unknown_permission")

    new_role = AdminRoleModel(
        name=name,
        description=body.description,
        is_system=False,
        level=body.level,
    )
    db.add(new_role)
    try:
        await db.flush()
        for perm in perm_rows:
            db.add(AdminRolePermission(role_id=new_role.id, permission_id=perm.id))
        _audit(db, AuditEvent.role_created, actor_id=admin.id,
               ip=_client_ip(request),
               meta={"name": name, "level": body.level})
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.error("role_create_conflict", name=name, error=str(exc.__cause__ or exc))
        raise HTTPException(status_code=409, detail="role_name_taken")

    return {
        "id": str(new_role.id),
        "name": new_role.name,
        "description": new_role.description,
        "is_system": new_role.is_system,
        "level": new_role.level,
        "permissions": [perm.key for perm in perm_rows],
    }


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    request: Request,
    admin: AdminUser = Depends(require_permission(Permission.ROLES_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    try:
        rid = UUID(role_id)
    except ValueError:
        raise HTTPException(400, "invalid_role_id")

    result = await db.execute(select(AdminRoleModel).where(AdminRoleModel.id == rid))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "role_not_found")
    if role.is_system:
        raise HTTPException(403, "system_role_protected")

    in_use = await db.execute(
        select(func.count(AdminUser.id)).where(AdminUser.role_id == rid)
    )
    if in_use.scalar() > 0:
        raise HTTPException(status_code=409, detail="role_in_use")

    await db.execute(delete(AdminRolePermission).where(AdminRolePermission.role_id == rid))
    await db.delete(role)
    _audit(db, AuditEvent.role_deleted, actor_id=admin.id,
           ip=_client_ip(request),
           meta={"name": role.name})
    await db.commit()
    return {"status": "role_deleted"}


@router.get("/permissions")
async def list_permissions(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AdminPermission).order_by(AdminPermission.category, AdminPermission.key))
    perms = result.scalars().all()
    return {
        "items": [
            {"id": str(p.id), "key": p.key, "description": p.description, "category": p.category}
            for p in perms
        ]
    }
