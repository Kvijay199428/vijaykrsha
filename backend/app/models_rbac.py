import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from app.models import Base


def utcnow():
    return datetime.now(timezone.utc)


class AdminRole(Base):
    __tablename__ = "admin_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(64), nullable=False, unique=True, index=True)
    description = Column(Text)
    is_system = Column(Boolean, nullable=False, default=False)
    level = Column(Integer, nullable=False, default=40)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class AdminPermission(Base):
    __tablename__ = "admin_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(128), nullable=False, unique=True, index=True)
    description = Column(Text)
    category = Column(String(64))


class AdminRolePermission(Base):
    __tablename__ = "admin_role_permissions"

    role_id = Column(UUID(as_uuid=True), ForeignKey("admin_roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("admin_permissions.id", ondelete="CASCADE"), primary_key=True)


# Permission constants
class Permission:
    DASHBOARD_VIEW = "dashboard.view"

    MESSAGES_VIEW = "messages.view"
    MESSAGES_UPDATE = "messages.update"
    MESSAGES_DELETE = "messages.delete"
    MESSAGES_NOTES = "messages.notes"
    MESSAGES_TAGS = "messages.tags"

    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_UPDATE = "users.update"
    USERS_DISABLE = "users.disable"
    USERS_DELETE = "users.delete"
    USERS_RESET_PASSWORD = "users.reset_password"
    USERS_MANAGE_2FA = "users.manage_2fa"

    SETTINGS_VIEW = "settings.view"
    SETTINGS_UPDATE = "settings.update"

    AUDIT_LOGS_VIEW = "audit_logs.view"

    ROLES_VIEW = "roles.view"
    ROLES_MANAGE = "roles.manage"

    ALL = [
        DASHBOARD_VIEW,
        MESSAGES_VIEW, MESSAGES_UPDATE, MESSAGES_DELETE, MESSAGES_NOTES, MESSAGES_TAGS,
        USERS_VIEW, USERS_CREATE, USERS_UPDATE, USERS_DISABLE, USERS_DELETE,
        USERS_RESET_PASSWORD, USERS_MANAGE_2FA,
        SETTINGS_VIEW, SETTINGS_UPDATE,
        AUDIT_LOGS_VIEW,
        ROLES_VIEW, ROLES_MANAGE,
    ]


# Role-permission mappings
ROLE_PERMISSIONS = {
    "owner": Permission.ALL,
    "admin": [
        Permission.DASHBOARD_VIEW,
        Permission.MESSAGES_VIEW, Permission.MESSAGES_UPDATE, Permission.MESSAGES_NOTES, Permission.MESSAGES_TAGS,
        Permission.USERS_VIEW, Permission.USERS_CREATE, Permission.USERS_UPDATE, Permission.USERS_DISABLE,
        Permission.USERS_RESET_PASSWORD,
        Permission.SETTINGS_VIEW, Permission.AUDIT_LOGS_VIEW,
        Permission.ROLES_VIEW, Permission.ROLES_MANAGE,
    ],
    "manager": [
        Permission.DASHBOARD_VIEW,
        Permission.MESSAGES_VIEW, Permission.MESSAGES_UPDATE, Permission.MESSAGES_NOTES, Permission.MESSAGES_TAGS,
        Permission.USERS_VIEW, Permission.USERS_DISABLE,
        Permission.SETTINGS_VIEW,
        Permission.ROLES_VIEW, Permission.ROLES_MANAGE,
    ],
    "support": [
        Permission.DASHBOARD_VIEW,
        Permission.MESSAGES_VIEW, Permission.MESSAGES_UPDATE, Permission.MESSAGES_NOTES,
    ],
    "viewer": [
        Permission.DASHBOARD_VIEW,
        Permission.MESSAGES_VIEW,
    ],
}
