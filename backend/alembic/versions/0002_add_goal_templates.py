"""Add goal_templates table and link health_goals to it

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-09

- Creates goal_templates table (researcher-defined catalogue)
- Adds template_id FK to health_goals
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goal_templates",
        sa.Column("template_id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("element_id", UUID(as_uuid=True), sa.ForeignKey("data_elements.element_id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_target", sa.Numeric(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
    )

    op.add_column(
        "health_goals",
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("goal_templates.template_id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("health_goals", "template_id")
    op.drop_table("goal_templates")
