"""Add group_id to signup_invites

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-16

- Adds group_id FK column to signup_invites so invited participants
  are automatically added to a group on registration
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "signup_invites",
        sa.Column(
            "group_id",
            UUID(as_uuid=True),
            sa.ForeignKey("groups.group_id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("signup_invites", "group_id")
