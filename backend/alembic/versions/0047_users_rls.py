"""users row-level security

Revision ID: 0047
Revises: 0046
Create Date: 2026-04-11 00:00:00.000000
"""

from alembic import op


revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS users_admin_or_system_all ON users")
    op.execute(
        """
        CREATE POLICY users_admin_or_system_all
        ON users
        FOR ALL
        USING (app.current_user_role() IN ('admin', 'system'))
        WITH CHECK (app.current_user_role() IN ('admin', 'system'))
        """
    )

    op.execute("DROP POLICY IF EXISTS users_self_select ON users")
    op.execute(
        """
        CREATE POLICY users_self_select
        ON users
        FOR SELECT
        USING (user_id = app.current_user_id())
        """
    )

    op.execute("DROP POLICY IF EXISTS users_self_update ON users")
    op.execute(
        """
        CREATE POLICY users_self_update
        ON users
        FOR UPDATE
        USING (user_id = app.current_user_id())
        WITH CHECK (user_id = app.current_user_id())
        """
    )

    op.execute("DROP POLICY IF EXISTS users_researcher_participant_select ON users")
    op.execute(
        """
        CREATE POLICY users_researcher_participant_select
        ON users
        FOR SELECT
        USING (
            app.current_user_role() = 'researcher'
            AND EXISTS (
                SELECT 1
                FROM participant_profile pp
                WHERE pp.user_id = users.user_id
            )
        )
        """
    )

    op.execute("DROP POLICY IF EXISTS users_caretaker_group_participant_select ON users")
    op.execute(
        """
        CREATE POLICY users_caretaker_group_participant_select
        ON users
        FOR SELECT
        USING (
            app.current_user_role() = 'caretaker'
            AND EXISTS (
                SELECT 1
                FROM participant_profile target_pp
                JOIN group_members gm
                  ON gm.participant_id = target_pp.participant_id
                 AND gm.left_at IS NULL
                JOIN groups g
                  ON g.group_id = gm.group_id
                JOIN caretaker_profile actor_cp
                  ON actor_cp.caretaker_id = g.caretaker_id
                WHERE target_pp.user_id = users.user_id
                  AND actor_cp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute("DROP POLICY IF EXISTS users_participant_group_caretaker_select ON users")
    op.execute(
        """
        CREATE POLICY users_participant_group_caretaker_select
        ON users
        FOR SELECT
        USING (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM caretaker_profile cp
                JOIN groups g
                  ON g.caretaker_id = cp.caretaker_id
                JOIN group_members gm
                  ON gm.group_id = g.group_id
                 AND gm.left_at IS NULL
                JOIN participant_profile actor_pp
                  ON actor_pp.participant_id = gm.participant_id
                WHERE cp.user_id = users.user_id
                  AND actor_pp.user_id = app.current_user_id()
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS users_participant_group_caretaker_select ON users")
    op.execute("DROP POLICY IF EXISTS users_caretaker_group_participant_select ON users")
    op.execute("DROP POLICY IF EXISTS users_researcher_participant_select ON users")
    op.execute("DROP POLICY IF EXISTS users_self_update ON users")
    op.execute("DROP POLICY IF EXISTS users_self_select ON users")
    op.execute("DROP POLICY IF EXISTS users_admin_or_system_all ON users")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")
