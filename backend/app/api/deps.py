import hashlib
from uuid import UUID
from fastapi import Request, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.config import get_settings
from app.models import (
    AdminUser, AdminSession, AdminRole as AdminRoleEnum,
    AdminStatus, Device,
)
from app.models_rbac import AdminRole, AdminRolePermission, AdminPermission, Permission
from app.security.sessions import get_session, touch_session

settings = get_settings()


def _extract_token(request: Request) -> str | None:
    cookie = request.cookies.get("vks_session")
    if cookie:
        return cookie
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def _extract_device_token(request: Request) -> str | None:
    return request.cookies.get(settings.device_cookie_name)


async def get_current_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="not_authenticated")

    session = await get_session(db, token)
    if not session:
        raise HTTPException(status_code=401, detail="session_expired")

    stmt = select(AdminUser).where(AdminUser.id == session.admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=401, detail="admin_not_found")
    if admin.status != AdminStatus.active:
        raise HTTPException(status_code=403, detail="admin_disabled")

    await touch_session(db, session)
    return admin


async def get_current_admin_with_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> tuple[AdminUser, AdminSession]:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="not_authenticated")

    session = await get_session(db, token)
    if not session:
        raise HTTPException(status_code=401, detail="session_expired")

    stmt = select(AdminUser).where(AdminUser.id == session.admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=401, detail="admin_not_found")
    if admin.status != AdminStatus.active:
        raise HTTPException(status_code=403, detail="admin_disabled")

    await touch_session(db, session)
    return admin, session


def require_owner(
    admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    if admin.role != AdminRoleEnum.owner:
        raise HTTPException(status_code=403, detail="owner_required")
    return admin


def require_manager(
    admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    if admin.role not in (AdminRoleEnum.owner, AdminRoleEnum.admin):
        raise HTTPException(status_code=403, detail="manager_required")
    return admin


async def _get_admin_permission_keys(db: AsyncSession, admin: AdminUser) -> set[str]:
    stmt = (
        select(AdminPermission.key)
        .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
        .join(AdminRole, AdminRole.id == AdminRolePermission.role_id)
        .where(AdminRole.id == admin.role_id)
    )
    result = await db.execute(stmt)
    return {row[0] for row in result.all()}


def require_permission(permission_key: str):
    async def _check(
        admin: AdminUser = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db),
    ) -> AdminUser:
        if admin.role == AdminRoleEnum.owner:
            return admin
        perms = await _get_admin_permission_keys(db, admin)
        if permission_key not in perms:
            raise HTTPException(status_code=403, detail=f"permission_denied:{permission_key}")
        return admin
    return _check


async def get_admin_role_level(db: AsyncSession, admin: AdminUser) -> int:
    from app.models_rbac import AdminRole as AdminRoleModel

    if admin.role_id is not None:
        result = await db.execute(
            select(AdminRoleModel.level).where(AdminRoleModel.id == admin.role_id)
        )
        level = result.scalar_one_or_none()
        if level is not None:
            return level
    return 100 if admin.role == AdminRoleEnum.owner else 0


async def assert_can_manage(db: AsyncSession, actor: AdminUser, target: AdminUser) -> int:
    """Hierarchy gate for acting on another user. Owner bypasses; otherwise
    the actor's role level must be strictly above the target's."""
    if target.id == actor.id:
        raise HTTPException(status_code=400, detail="cannot_manage_self")
    if actor.role == AdminRoleEnum.owner:
        return 100

    actor_level = await get_admin_role_level(db, actor)
    target_level = await get_admin_role_level(db, target)
    if actor_level <= target_level:
        raise HTTPException(status_code=403, detail="insufficient_role_rank")
    return actor_level
