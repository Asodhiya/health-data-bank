"""Enable RLS on health data points

Revision ID: 0043
Revises: 0042
Create Date: 2026-04-11
"""

from alembic import op


revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE health_data_points ENABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS health_data_points_admin_all ON health_data_points")
    op.execute("DROP POLICY IF EXISTS health_data_points_participant_own_all ON health_data_points")
    op.execute("DROP POLICY IF EXISTS health_data_points_caretaker_select_visible ON health_data_points")
    op.execute("DROP POLICY IF EXISTS health_data_points_researcher_select_visible ON health_data_points")

    op.execute(
        """
        CREATE POLICY health_data_points_admin_all
        ON health_data_points
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY health_data_points_participant_own_all
        ON health_data_points
        FOR ALL
        USING (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM participant_profile pp
                WHERE pp.participant_id = health_data_points.participant_id
                  AND pp.user_id = app.current_user_id()
            )
        )
        WITH CHECK (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM participant_profile pp
                WHERE pp.participant_id = health_data_points.participant_id
                  AND pp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY health_data_points_caretaker_select_visible
        ON health_data_points
        FOR SELECT
        USING (
            app.current_user_role() = 'caretaker'
            AND EXISTS (
                SELECT 1
                FROM group_members gm
                JOIN groups g
                  ON g.group_id = gm.group_id
                JOIN caretaker_profile cp
                  ON cp.caretaker_id = g.caretaker_id
                WHERE gm.participant_id = health_data_points.participant_id
                  AND gm.left_at IS NULL
                  AND cp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY health_data_points_researcher_select_visible
        ON health_data_points
        FOR SELECT
        USING (app.current_user_role() = 'researcher')
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS health_data_points_researcher_select_visible ON health_data_points")
    op.execute("DROP POLICY IF EXISTS health_data_points_caretaker_select_visible ON health_data_points")
    op.execute("DROP POLICY IF EXISTS health_data_points_participant_own_all ON health_data_points")
    op.execute("DROP POLICY IF EXISTS health_data_points_admin_all ON health_data_points")
    op.execute("ALTER TABLE health_data_points DISABLE ROW LEVEL SECURITY")
