"""Add country_of_origin to participant_profile

Revision ID: 0026
Revises: 0025
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa


revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("participant_profile", sa.Column("country_of_origin", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("participant_profile", "country_of_origin")
