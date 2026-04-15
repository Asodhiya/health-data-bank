"""Add config JSONB column to form_fields

Revision ID: 0037
Revises: 0036
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import JSONB


revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    columns = [c["name"] for c in inspect(conn).get_columns("form_fields")]
    if "config" not in columns:
        op.add_column("form_fields", sa.Column("config", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("form_fields", "config")