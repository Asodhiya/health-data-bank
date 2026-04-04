"""Add parent_form_id and modified_at to survey_forms

Revision ID: 0021
Revises: 0020
Create Date: 2026-04-03
"""

from alembic import op


revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE survey_forms
        ADD COLUMN IF NOT EXISTS parent_form_id UUID REFERENCES survey_forms(form_id)
        """
    )
    op.execute(
        """
        ALTER TABLE survey_forms
        ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ DEFAULT now()
        """
    )
    op.execute(
        """
        UPDATE survey_forms SET modified_at = created_at WHERE modified_at IS NULL
        """
    )


def downgrade():
    op.execute("ALTER TABLE survey_forms DROP COLUMN IF EXISTS parent_form_id")
    op.execute("ALTER TABLE survey_forms DROP COLUMN IF EXISTS modified_at")
