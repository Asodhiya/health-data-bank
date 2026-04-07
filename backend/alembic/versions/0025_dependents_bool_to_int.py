"""Change dependents column from Boolean to Integer

Revision ID: 0025
Revises: 0024
Create Date: 2026-04-06

- Converts existing True -> 1, False -> 0, NULL stays NULL
"""

from alembic import op
import sqlalchemy as sa


revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add a temporary integer column
    op.add_column("participant_profile", sa.Column("dependents_int", sa.Integer(), nullable=True))

    # Migrate data: True -> 1, False -> 0
    op.execute(
        "UPDATE participant_profile SET dependents_int = CASE WHEN dependents = true THEN 1 WHEN dependents = false THEN 0 ELSE NULL END"
    )

    # Drop old boolean column and rename new one
    op.drop_column("participant_profile", "dependents")
    op.alter_column("participant_profile", "dependents_int", new_column_name="dependents")


def downgrade() -> None:
    # Add temporary boolean column
    op.add_column("participant_profile", sa.Column("dependents_bool", sa.Boolean(), nullable=True))

    # Migrate data back: >0 -> True, 0 -> False
    op.execute(
        "UPDATE participant_profile SET dependents_bool = CASE WHEN dependents > 0 THEN true WHEN dependents = 0 THEN false ELSE NULL END"
    )

    # Drop integer column and rename back
    op.drop_column("participant_profile", "dependents")
    op.alter_column("participant_profile", "dependents_bool", new_column_name="dependents")
