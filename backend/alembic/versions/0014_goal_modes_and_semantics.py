"""Add goal semantics to health_goals

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa


revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "health_goals",
        sa.Column("goal_mode", sa.Text(), nullable=False, server_default="daily"),
    )
    op.add_column(
        "health_goals",
        sa.Column("progress_mode", sa.Text(), nullable=False, server_default="incremental"),
    )
    op.add_column(
        "health_goals",
        sa.Column("direction", sa.Text(), nullable=False, server_default="at_least"),
    )
    op.add_column(
        "health_goals",
        sa.Column("window", sa.Text(), nullable=False, server_default="daily"),
    )
    op.add_column(
        "health_goals",
        sa.Column("baseline_value", sa.Numeric(), nullable=True),
    )

    op.create_check_constraint(
        "ck_health_goals_goal_mode",
        "health_goals",
        "goal_mode IN ('daily', 'long_term')",
    )
    op.create_check_constraint(
        "ck_health_goals_progress_mode",
        "health_goals",
        "progress_mode IN ('incremental', 'absolute')",
    )
    op.create_check_constraint(
        "ck_health_goals_direction",
        "health_goals",
        "direction IN ('at_least', 'at_most')",
    )
    op.create_check_constraint(
        "ck_health_goals_window",
        "health_goals",
        "\"window\" IN ('daily', 'weekly', 'monthly', 'none')",
    )


def downgrade():
    op.drop_constraint("ck_health_goals_window", "health_goals", type_="check")
    op.drop_constraint("ck_health_goals_direction", "health_goals", type_="check")
    op.drop_constraint("ck_health_goals_progress_mode", "health_goals", type_="check")
    op.drop_constraint("ck_health_goals_goal_mode", "health_goals", type_="check")

    op.drop_column("health_goals", "baseline_value")
    op.drop_column("health_goals", "window")
    op.drop_column("health_goals", "direction")
    op.drop_column("health_goals", "progress_mode")
    op.drop_column("health_goals", "goal_mode")
