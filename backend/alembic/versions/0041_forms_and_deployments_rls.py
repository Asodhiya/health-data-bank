"""Enable RLS on survey forms and form deployments

Revision ID: 0041
Revises: 0040
Create Date: 2026-04-11
"""

from alembic import op


revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE survey_forms ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE form_deployments ENABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS survey_forms_admin_all ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_researcher_select_all ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_researcher_insert_own ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_researcher_update_own ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_researcher_delete_own ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_participant_caretaker_select ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_intake_select ON survey_forms")

    op.execute(
        """
        CREATE POLICY survey_forms_admin_all
        ON survey_forms
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY survey_forms_researcher_select_all
        ON survey_forms
        FOR SELECT
        USING (app.current_user_role() = 'researcher')
        """
    )

    op.execute(
        """
        CREATE POLICY survey_forms_researcher_insert_own
        ON survey_forms
        FOR INSERT
        WITH CHECK (
            app.current_user_role() = 'researcher'
            AND created_by = app.current_user_id()
        )
        """
    )

    op.execute(
        """
        CREATE POLICY survey_forms_researcher_update_own
        ON survey_forms
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
        CREATE POLICY survey_forms_researcher_delete_own
        ON survey_forms
        FOR DELETE
        USING (
            app.current_user_role() = 'researcher'
            AND created_by = app.current_user_id()
        )
        """
    )

    op.execute(
        """
        CREATE POLICY survey_forms_participant_caretaker_select
        ON survey_forms
        FOR SELECT
        USING (
            app.current_user_role() IN ('participant', 'caretaker')
            AND status IN ('PUBLISHED', 'ARCHIVED')
        )
        """
    )

    op.execute(
        """
        CREATE POLICY survey_forms_intake_select
        ON survey_forms
        FOR SELECT
        USING (title = 'Intake Form')
        """
        )

    op.execute("DROP POLICY IF EXISTS form_deployments_admin_all ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_researcher_select_all ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_researcher_insert_owned_form ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_researcher_update_owned_or_deployed ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_researcher_delete_owned_or_deployed ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_participant_select_assigned ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_caretaker_select_groups ON form_deployments")

    op.execute(
        """
        CREATE POLICY form_deployments_admin_all
        ON form_deployments
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY form_deployments_researcher_select_all
        ON form_deployments
        FOR SELECT
        USING (app.current_user_role() = 'researcher')
        """
    )

    op.execute(
        """
        CREATE POLICY form_deployments_researcher_insert_owned_form
        ON form_deployments
        FOR INSERT
        WITH CHECK (
            app.current_user_role() = 'researcher'
            AND EXISTS (
                SELECT 1
                FROM survey_forms sf
                WHERE sf.form_id = form_deployments.form_id
                  AND sf.created_by = app.current_user_id()
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY form_deployments_researcher_update_owned_or_deployed
        ON form_deployments
        FOR UPDATE
        USING (
            app.current_user_role() = 'researcher'
            AND (
                deployed_by = app.current_user_id()
                OR EXISTS (
                    SELECT 1
                    FROM survey_forms sf
                    WHERE sf.form_id = form_deployments.form_id
                      AND sf.created_by = app.current_user_id()
                )
            )
        )
        WITH CHECK (
            app.current_user_role() = 'researcher'
            AND (
                deployed_by = app.current_user_id()
                OR EXISTS (
                    SELECT 1
                    FROM survey_forms sf
                    WHERE sf.form_id = form_deployments.form_id
                      AND sf.created_by = app.current_user_id()
                )
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY form_deployments_researcher_delete_owned_or_deployed
        ON form_deployments
        FOR DELETE
        USING (
            app.current_user_role() = 'researcher'
            AND (
                deployed_by = app.current_user_id()
                OR EXISTS (
                    SELECT 1
                    FROM survey_forms sf
                    WHERE sf.form_id = form_deployments.form_id
                      AND sf.created_by = app.current_user_id()
                )
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY form_deployments_participant_select_assigned
        ON form_deployments
        FOR SELECT
        USING (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM participant_profile pp
                JOIN group_members gm
                  ON gm.participant_id = pp.participant_id
                WHERE pp.user_id = app.current_user_id()
                  AND gm.group_id = form_deployments.group_id
                  AND gm.left_at IS NULL
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY form_deployments_caretaker_select_groups
        ON form_deployments
        FOR SELECT
        USING (
            app.current_user_role() = 'caretaker'
            AND EXISTS (
                SELECT 1
                FROM caretaker_profile cp
                JOIN groups g
                  ON g.caretaker_id = cp.caretaker_id
                WHERE cp.user_id = app.current_user_id()
                  AND g.group_id = form_deployments.group_id
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS form_deployments_caretaker_select_groups ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_participant_select_assigned ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_researcher_delete_owned_or_deployed ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_researcher_update_owned_or_deployed ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_researcher_insert_owned_form ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_researcher_select_all ON form_deployments")
    op.execute("DROP POLICY IF EXISTS form_deployments_admin_all ON form_deployments")
    op.execute("ALTER TABLE form_deployments DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS survey_forms_intake_select ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_participant_caretaker_select ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_researcher_delete_own ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_researcher_update_own ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_researcher_insert_own ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_researcher_select_all ON survey_forms")
    op.execute("DROP POLICY IF EXISTS survey_forms_admin_all ON survey_forms")
    op.execute("ALTER TABLE survey_forms DISABLE ROW LEVEL SECURITY")
