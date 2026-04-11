"""Enable RLS on notifications

Revision ID: 0040
Revises: 0039
Create Date: 2026-04-11
"""

from alembic import op


revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS notifications_admin_all ON notifications")
    op.execute("DROP POLICY IF EXISTS notifications_select_own ON notifications")
    op.execute("DROP POLICY IF EXISTS notifications_update_own ON notifications")
    op.execute("DROP POLICY IF EXISTS notifications_insert_any ON notifications")

    op.execute(
        """
        CREATE POLICY notifications_admin_all
        ON notifications
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY notifications_select_own
        ON notifications
        FOR SELECT
        USING (user_id = app.current_user_id())
        """
    )

    op.execute(
        """
        CREATE POLICY notifications_update_own
        ON notifications
        FOR UPDATE
        USING (user_id = app.current_user_id())
        WITH CHECK (user_id = app.current_user_id())
        """
    )

    op.execute(
        """
        CREATE POLICY notifications_insert_any
        ON notifications
        FOR INSERT
        WITH CHECK (TRUE)
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS notifications_insert_any ON notifications")
    op.execute("DROP POLICY IF EXISTS notifications_update_own ON notifications")
    op.execute("DROP POLICY IF EXISTS notifications_select_own ON notifications")
    op.execute("DROP POLICY IF EXISTS notifications_admin_all ON notifications")
    op.execute("ALTER TABLE notifications DISABLE ROW LEVEL SECURITY")
