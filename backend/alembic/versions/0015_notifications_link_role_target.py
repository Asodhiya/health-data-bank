"""Add link and role_target to notifications

Revision ID: 0015
Revises: 0014
Create Date: 2026-03-31
"""

from alembic import op
import sqlalchemy as sa


revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT")
    op.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS role_target TEXT")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_created_at ON notifications (user_id, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_status ON notifications (user_id, status)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_status")
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_created_at")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS role_target")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS link")
