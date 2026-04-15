"""Enable RLS on health goals

Revision ID: 0044
Revises: 0043
Create Date: 2026-04-11
"""

from alembic import op


revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE health_goals ENABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS health_goals_admin_all ON health_goals")
    op.execute("DROP POLICY IF EXISTS health_goals_participant_own_all ON health_goals")
    op.execute("DROP POLICY IF EXISTS health_goals_caretaker_select_visible ON health_goals")
    op.execute("DROP POLICY IF EXISTS health_goals_researcher_select_visible ON health_goals")

    op.execute(
        """
        CREATE POLICY health_goals_admin_all
        ON health_goals
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY health_goals_participant_own_all
        ON health_goals
        FOR ALL
        USING (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM participant_profile pp
                WHERE pp.participant_id = health_goals.participant_id
                  AND pp.user_id = app.current_user_id()
            )
        )
        WITH CHECK (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM participant_profile pp
                WHERE pp.participant_id = health_goals.participant_id
                  AND pp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY health_goals_caretaker_select_visible
        ON health_goals
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
                WHERE gm.participant_id = health_goals.participant_id
                  AND gm.left_at IS NULL
                  AND cp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY health_goals_researcher_select_visible
        ON health_goals
        FOR SELECT
        USING (app.current_user_role() = 'researcher')
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS health_goals_researcher_select_visible ON health_goals")
    op.execute("DROP POLICY IF EXISTS health_goals_caretaker_select_visible ON health_goals")
    op.execute("DROP POLICY IF EXISTS health_goals_participant_own_all ON health_goals")
    op.execute("DROP POLICY IF EXISTS health_goals_admin_all ON health_goals")
    op.execute("ALTER TABLE health_goals DISABLE ROW LEVEL SECURITY")
