import hashlib
from uuid import UUID
from fastapi import Request, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import (
    AdminUser, AdminSession, AdminRole as AdminRoleEnum,
    AdminStatus, Device,
)
from app.models_rbac import AdminRole, AdminRolePermission, AdminPermission, Permission
from app.security.sessions import get_session, touch_session


def _extract_token(request: Request) -> str | None:
    cookie = request.cookies.get("vks_session")
    if cookie:
        return cookie
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def _extract_device_token(request: Request) -> str | None:
    return request.cookies.get("__Host-device")


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
        .where(AdminRole.name == admin.role.value if hasattr(admin.role, 'value') else AdminRole.name == admin.role)
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
