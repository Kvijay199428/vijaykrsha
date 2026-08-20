import hashlib
from uuid import UUID
from fastapi import Request, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models import AdminUser, AdminSession, AdminRole, AdminStatus
from app.security.sessions import get_session, touch_session


def _extract_token(request: Request) -> str | None:
    cookie = request.cookies.get("vks_session")
    if cookie:
        return cookie
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


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

    stmt = __import__("sqlalchemy").select(AdminUser).where(AdminUser.id == session.admin_id)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=401, detail="admin_not_found")
    if admin.status != AdminStatus.active:
        raise HTTPException(status_code=403, detail="admin_disabled")

    await touch_session(db, session)
    return admin


async def require_owner(
    admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    if admin.role != AdminRole.owner:
        raise HTTPException(status_code=403, detail="owner_required")
    return admin


async def require_manager(
    admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    if admin.role not in (AdminRole.owner, AdminRole.admin):
        raise HTTPException(status_code=403, detail="manager_required")
    return admin
