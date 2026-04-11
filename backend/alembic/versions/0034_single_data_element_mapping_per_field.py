"""Enforce one data element mapping per form field

Revision ID: 0034
Revises: 0033
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa


revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade():
    # Keep the most recently mapped element per field so the uniqueness
    # constraint can be created without failing on legacy duplicates.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                field_id,
                element_id,
                ROW_NUMBER() OVER (
                    PARTITION BY field_id
                    ORDER BY mapped_at DESC NULLS LAST, element_id DESC
                ) AS rn
            FROM field_element_map
        )
        DELETE FROM field_element_map fem
        USING ranked r
        WHERE fem.field_id = r.field_id
          AND fem.element_id = r.element_id
          AND r.rn > 1
        """
    )

    op.create_unique_constraint(
        "uq_field_element_map_field_id",
        "field_element_map",
        ["field_id"],
    )


def downgrade():
    op.drop_constraint("uq_field_element_map_field_id", "field_element_map", type_="unique")
