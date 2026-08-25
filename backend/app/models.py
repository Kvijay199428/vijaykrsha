import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, BigInteger, SmallInteger,
    DateTime, Enum, ForeignKey, CheckConstraint, UniqueConstraint, Index,
    JSON, LargeBinary,
)
from sqlalchemy.dialects.postgresql import UUID, INET, CITEXT, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def utcnow():
    return datetime.now(timezone.utc)


class AdminRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    operator = "operator"
    viewer = "viewer"


class AdminStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    disabled = "disabled"
    pending = "pending"


class MessageStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    waiting = "waiting"
    resolved = "resolved"
    spam = "spam"
    archived = "archived"


class MessagePriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class MessageChannel(str, enum.Enum):
    contact_form = "contact_form"
    email = "email"
    phone = "phone"
    whatsapp = "whatsapp"
    telegram = "telegram"
    other = "other"


class OtpPurpose(str, enum.Enum):
    login = "login"
    password_reset = "password_reset"
    admin_action = "admin_action"


class OtpDelivery(str, enum.Enum):
    telegram = "telegram"
    email = "email"


class AuditEvent(str, enum.Enum):
    login_success = "login_success"
    login_failure = "login_failure"
    logout = "logout"
    otp_sent = "otp_sent"
    otp_verified = "otp_verified"
    totp_verified = "totp_verified"
    message_viewed = "message_viewed"
    message_updated = "message_updated"
    message_deleted = "message_deleted"
    settings_updated = "settings_updated"
    admin_created = "admin_created"
    admin_updated = "admin_updated"
    admin_disabled = "admin_disabled"
    password_changed = "password_changed"
    totp_enabled = "totp_enabled"
    totp_disabled = "totp_disabled"
    role_created = "role_created"
    role_deleted = "role_deleted"


class DeviceState(str, enum.Enum):
    unknown = "unknown"
    verified = "verified"
    trusted = "trusted"
    suspicious = "suspicious"
    blocked = "blocked"
    revoked = "revoked"


class SecurityEventType(str, enum.Enum):
    login_success = "login_success"
    login_failure = "login_failure"
    login_lockout = "login_lockout"
    otp_failure = "otp_failure"
    otp_rate_limit = "otp_rate_limit"
    totp_failure = "totp_failure"
    new_device = "new_device"
    device_trusted = "device_trusted"
    device_revoked = "device_revoked"
    device_blocked = "device_blocked"
    session_created = "session_created"
    session_revoked = "session_revoked"
    rate_limited = "rate_limited"
    bot_suspected = "bot_suspected"
    suspicious_request = "suspicious_request"
    account_locked = "account_locked"
    account_unlocked = "account_unlocked"


class SecuritySeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # VARCHAR (not CITEXT): logins must match the exact stored case.
    username = Column(String(64), nullable=False, unique=True, index=True)
    email = Column(CITEXT, unique=True)
    display_name = Column(String(160), nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(String(64), nullable=False, default="admin")
    role_id = Column(UUID(as_uuid=True), ForeignKey("admin_roles.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    status = Column(Enum(AdminStatus), nullable=False, default=AdminStatus.active)
    telegram_chat_id = Column(Text)
    telegram_username = Column(String(64))
    totp_enabled = Column(Boolean, nullable=False, default=False)
    totp_secret_ciphertext = Column(LargeBinary)
    totp_enabled_at = Column(DateTime(timezone=True))
    last_login_at = Column(DateTime(timezone=True))
    password_changed_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    failed_login_count = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    sessions = relationship("AdminSession", back_populates="admin", cascade="all, delete-orphan")
    challenges = relationship("AuthChallenge", back_populates="admin", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="admin", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("length(username) BETWEEN 3 AND 64"),
    )


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    session_hash = Column(String(64), nullable=False, unique=True, index=True)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    absolute_expires_at = Column(DateTime(timezone=True))
    revoked_at = Column(DateTime(timezone=True))

    admin = relationship("AdminUser", back_populates="sessions")
    device = relationship("Device", back_populates="sessions")

    __table_args__ = (
        Index("idx_sessions_admin", "admin_id", "revoked_at", "expires_at"),
    )


class AuthChallenge(Base):
    __tablename__ = "auth_challenges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    challenge_hash = Column(String(64), nullable=False, unique=True, index=True)
    otp_hash = Column(String(64))
    otp_delivery = Column(Enum(OtpDelivery))
    otp_purpose = Column(Enum(OtpPurpose), nullable=False, default=OtpPurpose.login)
    telegram_message_id = Column(BigInteger)
    otp_attempts = Column(Integer, nullable=False, default=0)
    totp_attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    otp_verified_at = Column(DateTime(timezone=True))
    totp_verified_at = Column(DateTime(timezone=True))
    consumed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    admin = relationship("AdminUser", back_populates="challenges")


class WebsiteUser(Base):
    __tablename__ = "website_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(160))
    email = Column(CITEXT, index=True)
    phone = Column(String(32))
    organization = Column(String(160))
    country_code = Column(String(2))
    first_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    message_count = Column(Integer, nullable=False, default=0)
    is_blocked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_reference = Column(String(24), nullable=False, unique=True, index=True)
    website_user_id = Column(UUID(as_uuid=True), ForeignKey("website_users.id", ondelete="SET NULL"))
    channel = Column(Enum(MessageChannel), nullable=False, default=MessageChannel.contact_form)
    status = Column(Enum(MessageStatus), nullable=False, default=MessageStatus.new)
    priority = Column(Enum(MessagePriority), nullable=False, default=MessagePriority.normal)
    subject = Column(String(240))
    body = Column(Text, nullable=False)
    sender_name = Column(String(160))
    sender_email = Column(CITEXT)
    sender_phone = Column(String(32))
    source_page = Column(String(500))
    ip_address = Column(INET)
    user_agent = Column(Text)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    first_viewed_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    website_user = relationship("WebsiteUser")
    assignee = relationship("AdminUser", foreign_keys=[assigned_to])
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")
    notes = relationship("MessageNote", back_populates="message", cascade="all, delete-orphan")
    tags = relationship("MessageTag", secondary="contact_message_tags", back_populates="messages")

    __table_args__ = (
        Index("idx_messages_created", "created_at"),
        Index("idx_messages_status_priority", "status", "priority", "created_at"),
        Index("idx_messages_assigned", "assigned_to", "status"),
    )


class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("contact_messages.id", ondelete="CASCADE"), nullable=False)
    object_key = Column(Text, nullable=False, unique=True)
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(160), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    sha256_hex = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    message = relationship("ContactMessage", back_populates="attachments")


class MessageTag(Base):
    __tablename__ = "message_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(CITEXT, nullable=False, unique=True)
    color = Column(String(32))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    messages = relationship("ContactMessage", secondary="contact_message_tags", back_populates="tags")


class ContactMessageTag(Base):
    __tablename__ = "contact_message_tags"

    message_id = Column(UUID(as_uuid=True), ForeignKey("contact_messages.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("message_tags.id", ondelete="CASCADE"), primary_key=True)


class MessageNote(Base):
    __tablename__ = "message_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("contact_messages.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="RESTRICT"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    message = relationship("ContactMessage", back_populates="notes")
    author = relationship("AdminUser")


class AdminSetting(Base):
    __tablename__ = "admin_settings"

    id = Column(SmallInteger, primary_key=True, default=1)
    telegram_otp_required = Column(Boolean, nullable=False, default=True)
    default_totp_enabled = Column(Boolean, nullable=False, default=False)
    otp_length = Column(SmallInteger, nullable=False, default=6)
    otp_ttl_seconds = Column(Integer, nullable=False, default=300)
    otp_resend_seconds = Column(Integer, nullable=False, default=60)
    max_login_attempts = Column(SmallInteger, nullable=False, default=5)
    session_idle_minutes = Column(Integer, nullable=False, default=30)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event = Column(Enum(AuditEvent), nullable=False)
    actor_admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    target_message_id = Column(UUID(as_uuid=True), ForeignKey("contact_messages.id", ondelete="SET NULL"))
    target_admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"))
    ip_address = Column(INET)
    user_agent = Column(Text)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        Index("idx_audit_logs_created", "created_at"),
    )


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_hash = Column(String(64), nullable=False, unique=True, index=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    first_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    first_ip = Column(INET)
    last_ip = Column(INET)
    user_agent = Column(Text)
    browser_name = Column(String(64))
    browser_version = Column(String(32))
    os_name = Column(String(64))
    os_version = Column(String(32))
    device_type = Column(String(32))
    country = Column(String(2))
    state = Column(Enum(DeviceState), nullable=False, default=DeviceState.unknown)
    risk_score = Column(Integer, nullable=False, default=0)
    last_login_at = Column(DateTime(timezone=True))
    last_activity_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    admin = relationship("AdminUser", back_populates="devices")
    sessions = relationship("AdminSession", back_populates="device")
    trusted = relationship("TrustedDevice", back_populates="device", uselist=False)

    __table_args__ = (
        Index("idx_devices_admin", "admin_id"),
        Index("idx_devices_hash", "device_hash"),
    )


class TrustedDevice(Base):
    __tablename__ = "trusted_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, unique=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False)
    trust_hash = Column(String(64), nullable=False, unique=True, index=True)
    trusted_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_used_at = Column(DateTime(timezone=True))
    ip_address = Column(INET)
    user_agent = Column(Text)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    device = relationship("Device", back_populates="trusted")

    __table_args__ = (
        Index("idx_trusted_devices_admin", "admin_id"),
    )


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_type = Column(Enum(SecurityEventType), nullable=False, index=True)
    severity = Column(Enum(SecuritySeverity), nullable=False, default=SecuritySeverity.low)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("admin_sessions.id", ondelete="SET NULL"))
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"))
    ip_address = Column(INET, index=True)
    user_agent = Column(Text)
    path = Column(Text)
    method = Column(String(8))
    risk_score = Column(Integer, nullable=False, default=0)
    reason = Column(Text)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)

    __table_args__ = (
        Index("idx_security_events_type_created", "event_type", "created_at"),
    )
