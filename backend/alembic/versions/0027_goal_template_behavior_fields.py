"""Add goal behavior fields to goal_templates

Revision ID: 0027
Revises: 0026
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "goal_templates",
        sa.Column("goal_mode", sa.Text(), nullable=False, server_default=sa.text("'daily'")),
    )
    op.add_column(
        "goal_templates",
        sa.Column("progress_mode", sa.Text(), nullable=False, server_default=sa.text("'incremental'")),
    )
    op.add_column(
        "goal_templates",
        sa.Column("direction", sa.Text(), nullable=False, server_default=sa.text("'at_least'")),
    )
    op.add_column(
        "goal_templates",
        sa.Column("window", sa.Text(), nullable=False, server_default=sa.text("'daily'")),
    )
    op.create_check_constraint(
        "ck_goal_templates_goal_mode",
        "goal_templates",
        "goal_mode IN ('daily', 'long_term')",
    )
    op.create_check_constraint(
        "ck_goal_templates_progress_mode",
        "goal_templates",
        "progress_mode IN ('incremental', 'absolute')",
    )
    op.create_check_constraint(
        "ck_goal_templates_direction",
        "goal_templates",
        "direction IN ('at_least', 'at_most')",
    )
    op.create_check_constraint(
        "ck_goal_templates_window",
        "goal_templates",
        "\"window\" IN ('daily', 'weekly', 'monthly', 'none')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_goal_templates_window", "goal_templates", type_="check")
    op.drop_constraint("ck_goal_templates_direction", "goal_templates", type_="check")
    op.drop_constraint("ck_goal_templates_progress_mode", "goal_templates", type_="check")
    op.drop_constraint("ck_goal_templates_goal_mode", "goal_templates", type_="check")
    op.drop_column("goal_templates", "window")
    op.drop_column("goal_templates", "direction")
    op.drop_column("goal_templates", "progress_mode")
    op.drop_column("goal_templates", "goal_mode")
