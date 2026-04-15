"""Drop redundant participant profile address column

Revision ID: 0031
Revises: 0030
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa


revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("participant_profile", "address")


def downgrade() -> None:
    op.add_column("participant_profile", sa.Column("address", sa.Text(), nullable=True))
