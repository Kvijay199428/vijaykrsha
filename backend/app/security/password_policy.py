import re

PASSWORD_MIN_LENGTH = 12
PASSWORD_MAX_LENGTH = 256

_UPPER_RE = re.compile(r"[A-Z]")
_LOWER_RE = re.compile(r"[a-z]")
_DIGIT_RE = re.compile(r"[0-9]")
_SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")


def validate_password_strength(v: str) -> str:
    """Canonical password policy enforced on every password-set path.

    Keep in sync with src/lib/passwordValidation.ts (frontend mirror, UX only).
    """
    if len(v) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long")
    if len(v) > PASSWORD_MAX_LENGTH:
        raise ValueError("Password must be at most 256 characters long")
    if not _UPPER_RE.search(v):
        raise ValueError("Password must contain an uppercase letter")
    if not _LOWER_RE.search(v):
        raise ValueError("Password must contain a lowercase letter")
    if not _DIGIT_RE.search(v):
        raise ValueError("Password must contain a number")
    if not _SPECIAL_RE.search(v):
        raise ValueError("Password must contain a special character")
    if v != v.strip():
        raise ValueError("Password must not have leading or trailing whitespace")
    return v
