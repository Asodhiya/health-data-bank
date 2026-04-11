"""Add show_on_profile boolean to form_fields

Revision ID: 0038
Revises: 0037
Create Date: 2026-04-11
"""

from alembic import op
import sqlalchemy as sa


revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "form_fields",
        sa.Column("show_on_profile", sa.Boolean(), server_default=sa.text("FALSE")),
    )


def downgrade() -> None:
    op.drop_column("form_fields", "show_on_profile")
