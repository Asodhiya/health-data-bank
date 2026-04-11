"""Enable RLS on participant profile

Revision ID: 0045
Revises: 0044
Create Date: 2026-04-11
"""

from alembic import op


revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE participant_profile ENABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS participant_profile_admin_all ON participant_profile")
    op.execute("DROP POLICY IF EXISTS participant_profile_participant_own_all ON participant_profile")
    op.execute("DROP POLICY IF EXISTS participant_profile_caretaker_select_visible ON participant_profile")
    op.execute("DROP POLICY IF EXISTS participant_profile_researcher_select_visible ON participant_profile")

    op.execute(
        """
        CREATE POLICY participant_profile_admin_all
        ON participant_profile
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY participant_profile_participant_own_all
        ON participant_profile
        FOR ALL
        USING (
            app.current_user_role() = 'participant'
            AND user_id = app.current_user_id()
        )
        WITH CHECK (
            app.current_user_role() = 'participant'
            AND user_id = app.current_user_id()
        )
        """
    )

    op.execute(
        """
        CREATE POLICY participant_profile_caretaker_select_visible
        ON participant_profile
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
                WHERE gm.participant_id = participant_profile.participant_id
                  AND gm.left_at IS NULL
                  AND cp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY participant_profile_researcher_select_visible
        ON participant_profile
        FOR SELECT
        USING (app.current_user_role() = 'researcher')
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS participant_profile_researcher_select_visible ON participant_profile")
    op.execute("DROP POLICY IF EXISTS participant_profile_caretaker_select_visible ON participant_profile")
    op.execute("DROP POLICY IF EXISTS participant_profile_participant_own_all ON participant_profile")
    op.execute("DROP POLICY IF EXISTS participant_profile_admin_all ON participant_profile")
    op.execute("ALTER TABLE participant_profile DISABLE ROW LEVEL SECURITY")
