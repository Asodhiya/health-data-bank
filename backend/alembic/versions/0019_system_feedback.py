"""Add system feedback table

Revision ID: 0019
Revises: 0018
Create Date: 2026-04-03
"""

from alembic import op


revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS system_feedback (
            feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
            category TEXT NOT NULL DEFAULT 'general',
            subject TEXT NULL,
            message TEXT NOT NULL,
            page_path TEXT NULL,
            status TEXT NOT NULL DEFAULT 'new',
            reviewed_at TIMESTAMPTZ NULL,
            reviewed_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS system_feedback")
