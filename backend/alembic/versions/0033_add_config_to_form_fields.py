"""Add config JSONB column to form_fields

Revision ID: 0033
Revises: 0032
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("form_fields", sa.Column("config", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("form_fields", "config")