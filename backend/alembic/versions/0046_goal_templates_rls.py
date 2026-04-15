"""Enable RLS on goal templates

Revision ID: 0046
Revises: 0045
Create Date: 2026-04-11
"""

from alembic import op


revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS goal_templates_admin_all ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_participant_select_active ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_caretaker_select_active ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_researcher_select_all ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_researcher_insert_own ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_researcher_update_own ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_researcher_delete_own ON goal_templates")

    op.execute(
        """
        CREATE POLICY goal_templates_admin_all
        ON goal_templates
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY goal_templates_participant_select_active
        ON goal_templates
        FOR SELECT
        USING (
            app.current_user_role() = 'participant'
            AND is_active = TRUE
        )
        """
    )

    op.execute(
        """
        CREATE POLICY goal_templates_caretaker_select_active
        ON goal_templates
        FOR SELECT
        USING (
            app.current_user_role() = 'caretaker'
            AND is_active = TRUE
        )
        """
    )

    op.execute(
        """
        CREATE POLICY goal_templates_researcher_select_all
        ON goal_templates
        FOR SELECT
        USING (app.current_user_role() = 'researcher')
        """
    )

    op.execute(
        """
        CREATE POLICY goal_templates_researcher_insert_own
        ON goal_templates
        FOR INSERT
        WITH CHECK (
            app.current_user_role() = 'researcher'
            AND created_by = app.current_user_id()
        )
        """
    )

    op.execute(
        """
        CREATE POLICY goal_templates_researcher_update_own
        ON goal_templates
        FOR UPDATE
        USING (
            app.current_user_role() = 'researcher'
            AND created_by = app.current_user_id()
        )
        WITH CHECK (created_by = app.current_user_id())
        """
    )

    op.execute(
        """
        CREATE POLICY goal_templates_researcher_delete_own
        ON goal_templates
        FOR DELETE
        USING (
            app.current_user_role() = 'researcher'
            AND created_by = app.current_user_id()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS goal_templates_researcher_delete_own ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_researcher_update_own ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_researcher_insert_own ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_researcher_select_all ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_caretaker_select_active ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_participant_select_active ON goal_templates")
    op.execute("DROP POLICY IF EXISTS goal_templates_admin_all ON goal_templates")
    op.execute("ALTER TABLE goal_templates DISABLE ROW LEVEL SECURITY")
