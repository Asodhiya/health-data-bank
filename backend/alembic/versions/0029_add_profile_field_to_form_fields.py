"""Add profile_field mapping to form fields

Revision ID: 0029
Revises: 0028
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("form_fields", sa.Column("profile_field", sa.Text(), nullable=True))
    op.execute(
        """
        UPDATE form_fields
        SET profile_field = CASE
            WHEN lower(label) IN ('date of birth', 'dob') THEN 'dob'
            WHEN lower(label) IN ('gender', 'sex') THEN 'gender'
            WHEN lower(label) = 'pronouns' THEN 'pronouns'
            WHEN lower(label) IN ('primary language', 'language') THEN 'primary_language'
            WHEN lower(label) = 'country of origin' THEN 'country_of_origin'
            WHEN lower(label) = 'marital status' THEN 'marital_status'
            WHEN lower(label) IN ('highest education', 'highest education level') THEN 'highest_education_level'
            WHEN lower(label) IN ('living arrangement', 'who do you live with?') THEN 'living_arrangement'
            WHEN lower(label) = 'dependents' THEN 'dependents'
            WHEN lower(label) IN ('occupation', 'occupation / status', 'occupation status') THEN 'occupation_status'
            ELSE profile_field
        END
        WHERE form_id IN (
            SELECT form_id FROM survey_forms WHERE title = 'Intake Form'
        )
        """
    )


def downgrade() -> None:
    op.drop_column("form_fields", "profile_field")
