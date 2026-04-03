"""Add backup schedule settings table

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-03
"""

from alembic import op


revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS backup_schedule_settings (
            schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            enabled BOOLEAN NOT NULL DEFAULT FALSE,
            frequency TEXT NOT NULL DEFAULT 'weekly',
            time_local TEXT NOT NULL DEFAULT '03:00',
            day_of_week TEXT NULL,
            day_of_month INTEGER NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            scope TEXT NOT NULL DEFAULT 'full',
            retention_count INTEGER NOT NULL DEFAULT 5,
            notify_on_success BOOLEAN NOT NULL DEFAULT TRUE,
            notify_on_failure BOOLEAN NOT NULL DEFAULT TRUE,
            anchor_at_utc TIMESTAMPTZ NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL
        )
        """
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS backup_schedule_settings")
