"""Add snapshot content to backups

Revision ID: 0018
Revises: 0017
Create Date: 2026-04-03
"""

from alembic import op


revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE backups
        ADD COLUMN IF NOT EXISTS snapshot_content TEXT NULL
        """
    )


def downgrade():
    op.execute(
        """
        ALTER TABLE backups
        DROP COLUMN IF EXISTS snapshot_content
        """
    )
