"""Remove lifestyle/wellness questions from Intake Form (keep only fields 1-4)

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-26

Removes form_fields with display_order >= 5 from the "Intake Form".
These were the 10 lifestyle & wellness questions (transportation, stress,
substances, diet, eating habits, exercise, sitting time, etc.) that are
no longer part of the intake questionnaire.
"""
from alembic import op

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    # Delete submission_answers that reference the fields being removed first
    op.execute("""
        DELETE FROM submission_answers
        WHERE field_id IN (
            SELECT ff.field_id FROM form_fields ff
            JOIN survey_forms sf ON ff.form_id = sf.form_id
            WHERE sf.title = 'Intake Form'
            AND ff.display_order >= 5
        )
    """)
    # Now delete the fields themselves (options cascade via ON DELETE CASCADE)
    op.execute("""
        DELETE FROM form_fields
        WHERE form_id = (
            SELECT form_id FROM survey_forms WHERE title = 'Intake Form' LIMIT 1
        )
        AND display_order >= 5
    """)


def downgrade():
    # The deleted fields cannot be automatically restored.
    # Re-run the original intake form seed/setup to restore them.
    pass
