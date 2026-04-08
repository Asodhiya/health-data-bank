"""Add targeted performance indexes for admin list and insights queries.

Revision ID: 0022
Revises: 0021
Create Date: 2026-04-06
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users list pagination/sorting/filtering
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_created_at ON users (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_status ON users (status)")

    # role joins used by admin users list and role summary endpoint
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_roles_role_id ON user_roles (role_id)")

    # active membership lookups (left_at IS NULL) used in admin list/stats
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_members_participant_left_at "
        "ON group_members (participant_id, left_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_group_members_group_left_at "
        "ON group_members (group_id, left_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_group_members_group_left_at")
    op.execute("DROP INDEX IF EXISTS ix_group_members_participant_left_at")
    op.execute("DROP INDEX IF EXISTS ix_user_roles_role_id")
    op.execute("DROP INDEX IF EXISTS ix_user_roles_user_id")
    op.execute("DROP INDEX IF EXISTS ix_users_status")
    op.execute("DROP INDEX IF EXISTS ix_users_created_at")

