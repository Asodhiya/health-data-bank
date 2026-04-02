"""Enforce one active goal per participant and data element

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa


revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    # Keep only one active goal per participant+element (most recent wins) so the
    # unique index can be created without failing on legacy duplicates.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                goal_id,
                ROW_NUMBER() OVER (
                    PARTITION BY participant_id, element_id
                    ORDER BY created_at DESC NULLS LAST, goal_id DESC
                ) AS rn
            FROM health_goals
            WHERE status = 'active'
              AND participant_id IS NOT NULL
              AND element_id IS NOT NULL
        )
        DELETE FROM health_goals hg
        USING ranked r
        WHERE hg.goal_id = r.goal_id
          AND r.rn > 1
        """
    )

    op.create_index(
        "ux_health_goals_active_participant_element",
        "health_goals",
        ["participant_id", "element_id"],
        unique=True,
        postgresql_where=sa.text(
            "status = 'active' AND participant_id IS NOT NULL AND element_id IS NOT NULL"
        ),
    )


def downgrade():
    op.drop_index("ux_health_goals_active_participant_element", table_name="health_goals")

