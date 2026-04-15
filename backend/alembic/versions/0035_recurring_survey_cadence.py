"""Add recurring cadence support to surveys

Revision ID: 0035
Revises: 0034
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa


revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "survey_forms",
        sa.Column("cadence", sa.Text(), nullable=False, server_default="once"),
    )
    op.add_column(
        "survey_forms",
        sa.Column("cadence_anchor_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_survey_forms_cadence",
        "survey_forms",
        "cadence IN ('once', 'daily', 'weekly', 'monthly')",
    )

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

    op.add_column(
        "form_submissions",
        sa.Column("cycle_key", sa.Text(), nullable=True, server_default="once"),
    )
    op.execute("UPDATE form_submissions SET cycle_key = 'once' WHERE cycle_key IS NULL")
    op.alter_column("form_submissions", "cycle_key", nullable=False, server_default="once")
    op.create_index(
        "ix_form_submissions_participant_form_cycle",
        "form_submissions",
        ["participant_id", "form_id", "cycle_key"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_form_submissions_participant_form_cycle", table_name="form_submissions")
    op.drop_column("form_submissions", "cycle_key")
    op.drop_constraint("ck_form_deployments_cadence", "form_deployments", type_="check")
    op.drop_column("form_deployments", "cadence_anchor_at")
    op.drop_column("form_deployments", "cadence")
    op.drop_constraint("ck_survey_forms_cadence", "survey_forms", type_="check")
    op.drop_column("survey_forms", "cadence_anchor_at")
    op.drop_column("survey_forms", "cadence")
