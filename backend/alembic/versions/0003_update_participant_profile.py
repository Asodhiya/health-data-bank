"""Update participant_profile table with new demographic columns

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-09

- Adds pronouns, primary_language, occupation_status, living_arrangement,
  highest_education_level, dependents, marital_status columns
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("participant_profile", sa.Column("pronouns", sa.Text(), nullable=True))
    op.add_column("participant_profile", sa.Column("primary_language", sa.Text(), nullable=True))
    op.add_column("participant_profile", sa.Column("occupation_status", sa.Text(), nullable=True))
    op.add_column("participant_profile", sa.Column("living_arrangement", sa.Text(), nullable=True))
    op.add_column("participant_profile", sa.Column("highest_education_level", sa.Text(), nullable=True))
    op.add_column("participant_profile", sa.Column("dependents", sa.Boolean(), nullable=True))
    op.add_column("participant_profile", sa.Column("marital_status", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("participant_profile", "marital_status")
    op.drop_column("participant_profile", "dependents")
    op.drop_column("participant_profile", "highest_education_level")
    op.drop_column("participant_profile", "living_arrangement")
    op.drop_column("participant_profile", "occupation_status")
    op.drop_column("participant_profile", "primary_language")
    op.drop_column("participant_profile", "pronouns")
