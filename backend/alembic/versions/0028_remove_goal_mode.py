"""Remove redundant goal_mode from goals and templates

Revision ID: 0028
Revises: 0027
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_goal_templates_goal_mode", "goal_templates", type_="check")
    op.drop_column("goal_templates", "goal_mode")

    op.drop_constraint("ck_health_goals_goal_mode", "health_goals", type_="check")
    op.drop_column("health_goals", "goal_mode")


def downgrade() -> None:
    op.add_column(
        "health_goals",
        sa.Column("goal_mode", sa.Text(), nullable=False, server_default=sa.text("'daily'")),
    )
    op.create_check_constraint(
        "ck_health_goals_goal_mode",
        "health_goals",
        "goal_mode IN ('daily', 'long_term')",
    )

    op.add_column(
        "goal_templates",
        sa.Column("goal_mode", sa.Text(), nullable=False, server_default=sa.text("'daily'")),
    )
    op.create_check_constraint(
        "ck_goal_templates_goal_mode",
        "goal_templates",
        "goal_mode IN ('daily', 'long_term')",
    )
