"""Add backup source column

Revision ID: 0020
Revises: 0019
Create Date: 2026-04-03
"""

from alembic import op


revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE backups
        ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
        """
    )
    op.execute(
        """
        UPDATE backups
        SET source = 'manual'
        WHERE source IS NULL
        """
    )


def downgrade():
    op.execute(
        """
        ALTER TABLE backups
        DROP COLUMN IF EXISTS source
        """
    )
