"""Enforce one active goal template per data element

Revision ID: 0033
Revises: 0032
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa


revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade():
    # Keep the newest active template per element and deactivate older active
    # duplicates so the unique partial index can be created safely.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                template_id,
                ROW_NUMBER() OVER (
                    PARTITION BY element_id
                    ORDER BY created_at DESC NULLS LAST, template_id DESC
                ) AS rn
            FROM goal_templates
            WHERE is_active = TRUE
              AND element_id IS NOT NULL
        )
        UPDATE goal_templates gt
        SET is_active = FALSE
        FROM ranked r
        WHERE gt.template_id = r.template_id
          AND r.rn > 1
        """
    )

    op.create_index(
        "ux_goal_templates_active_element",
        "goal_templates",
        ["element_id"],
        unique=True,
        postgresql_where=sa.text("is_active = TRUE AND element_id IS NOT NULL"),
    )


def downgrade():
    op.drop_index("ux_goal_templates_active_element", table_name="goal_templates")
