"""Enable RLS on form submissions and submission answers

Revision ID: 0042
Revises: 0041
Create Date: 2026-04-11
"""

from alembic import op


revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS form_submissions_admin_all ON form_submissions")
    op.execute("DROP POLICY IF EXISTS form_submissions_participant_own_all ON form_submissions")
    op.execute("DROP POLICY IF EXISTS form_submissions_researcher_select_visible ON form_submissions")
    op.execute("DROP POLICY IF EXISTS form_submissions_caretaker_select_owned_group ON form_submissions")

    op.execute(
        """
        CREATE POLICY form_submissions_admin_all
        ON form_submissions
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY form_submissions_participant_own_all
        ON form_submissions
        FOR ALL
        USING (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM participant_profile pp
                WHERE pp.participant_id = form_submissions.participant_id
                  AND pp.user_id = app.current_user_id()
            )
        )
        WITH CHECK (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM participant_profile pp
                WHERE pp.participant_id = form_submissions.participant_id
                  AND pp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY form_submissions_researcher_select_visible
        ON form_submissions
        FOR SELECT
        USING (
            app.current_user_role() = 'researcher'
            AND EXISTS (
                SELECT 1
                FROM survey_forms sf
                WHERE sf.form_id = form_submissions.form_id
                  AND (
                    sf.created_by = app.current_user_id()
                    OR sf.title = 'Intake Form'
                  )
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY form_submissions_caretaker_select_owned_group
        ON form_submissions
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
                WHERE gm.participant_id = form_submissions.participant_id
                  AND gm.left_at IS NULL
                  AND cp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute("DROP POLICY IF EXISTS submission_answers_admin_all ON submission_answers")
    op.execute("DROP POLICY IF EXISTS submission_answers_participant_own_all ON submission_answers")
    op.execute("DROP POLICY IF EXISTS submission_answers_researcher_select_visible ON submission_answers")
    op.execute("DROP POLICY IF EXISTS submission_answers_caretaker_select_visible ON submission_answers")

    op.execute(
        """
        CREATE POLICY submission_answers_admin_all
        ON submission_answers
        FOR ALL
        USING (app.current_user_role() = 'admin')
        WITH CHECK (app.current_user_role() = 'admin')
        """
    )

    op.execute(
        """
        CREATE POLICY submission_answers_participant_own_all
        ON submission_answers
        FOR ALL
        USING (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM form_submissions fs
                JOIN participant_profile pp
                  ON pp.participant_id = fs.participant_id
                WHERE fs.submission_id = submission_answers.submission_id
                  AND pp.user_id = app.current_user_id()
            )
        )
        WITH CHECK (
            app.current_user_role() = 'participant'
            AND EXISTS (
                SELECT 1
                FROM form_submissions fs
                JOIN participant_profile pp
                  ON pp.participant_id = fs.participant_id
                WHERE fs.submission_id = submission_answers.submission_id
                  AND pp.user_id = app.current_user_id()
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY submission_answers_researcher_select_visible
        ON submission_answers
        FOR SELECT
        USING (
            app.current_user_role() = 'researcher'
            AND EXISTS (
                SELECT 1
                FROM form_submissions fs
                JOIN survey_forms sf
                  ON sf.form_id = fs.form_id
                WHERE fs.submission_id = submission_answers.submission_id
                  AND (
                    sf.created_by = app.current_user_id()
                    OR sf.title = 'Intake Form'
                  )
            )
        )
        """
    )

    op.execute(
        """
        CREATE POLICY submission_answers_caretaker_select_visible
        ON submission_answers
        FOR SELECT
        USING (
            app.current_user_role() = 'caretaker'
            AND EXISTS (
                SELECT 1
                FROM form_submissions fs
                JOIN group_members gm
                  ON gm.participant_id = fs.participant_id
                JOIN groups g
                  ON g.group_id = gm.group_id
                JOIN caretaker_profile cp
                  ON cp.caretaker_id = g.caretaker_id
                WHERE fs.submission_id = submission_answers.submission_id
                  AND gm.left_at IS NULL
                  AND cp.user_id = app.current_user_id()
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS submission_answers_caretaker_select_visible ON submission_answers")
    op.execute("DROP POLICY IF EXISTS submission_answers_researcher_select_visible ON submission_answers")
    op.execute("DROP POLICY IF EXISTS submission_answers_participant_own_all ON submission_answers")
    op.execute("DROP POLICY IF EXISTS submission_answers_admin_all ON submission_answers")
    op.execute("ALTER TABLE submission_answers DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS form_submissions_caretaker_select_owned_group ON form_submissions")
    op.execute("DROP POLICY IF EXISTS form_submissions_researcher_select_visible ON form_submissions")
    op.execute("DROP POLICY IF EXISTS form_submissions_participant_own_all ON form_submissions")
    op.execute("DROP POLICY IF EXISTS form_submissions_admin_all ON form_submissions")
    op.execute("ALTER TABLE form_submissions DISABLE ROW LEVEL SECURITY")
