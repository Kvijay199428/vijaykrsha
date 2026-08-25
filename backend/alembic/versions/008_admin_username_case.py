"""008_admin_username_case_sensitive - Enforce case-sensitive admin usernames

- Convert admin_users.username from CITEXT (case-insensitive compare) to
  VARCHAR(64). Login lookups, availability checks, and password-reset
  lookups all use `username == input`, so they become binary comparisons.
- Uniqueness likewise becomes case-sensitive: "Admin" and "admin" can no
  longer collide, and typing the wrong case no longer authenticates.

Passwords were always case-sensitive (argon2/bcrypt verify).

Revision ID: 008_admin_username_case
Revises: 007_role_varchar_levels
Create Date: 2026-08-24
"""
from alembic import op

revision = "008_admin_username_case"
down_revision = "007_role_varchar_levels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE admin_users ALTER COLUMN username TYPE VARCHAR(64)
        USING username::varchar(64)
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE admin_users ALTER COLUMN username TYPE CITEXT
        USING username::citext
    """)
