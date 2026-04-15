"""Add cadence columns to form_deployments and cycle_key to form_submissions

Revision ID: 0036
Revises: 0035
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa


revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "form_deployments",
        sa.Column("cadence", sa.Text(), nullable=False, server_default="once"),
    )
    op.add_column(
        "form_deployments",
        sa.Column("cadence_anchor_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_form_deployments_cadence",
        "form_deployments",
        "cadence IN ('once', 'daily', 'weekly', 'monthly')",
    )

    # form_submissions.cycle_key already exists (was added outside migration history)


def downgrade():
    op.drop_constraint("ck_form_deployments_cadence", "form_deployments", type_="check")
    op.drop_column("form_deployments", "cadence_anchor_at")
    op.drop_column("form_deployments", "cadence")
