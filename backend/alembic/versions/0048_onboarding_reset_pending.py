"""Add onboarding_reset_to flag to participant_profile

Revision ID: 0048
Revises: 0047
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    columns = [c["name"] for c in inspect(conn).get_columns("participant_profile")]
    if "onboarding_reset_to" not in columns:
        op.add_column(
            "participant_profile",
            sa.Column("onboarding_reset_to", sa.Text(), nullable=True),
        )
    if "onboarding_reset_pending" in columns:
        op.execute(
            sa.text(
                """
                UPDATE participant_profile
                SET onboarding_reset_to = COALESCE(onboarding_reset_to, 'CONSENT_GIVEN')
                WHERE onboarding_reset_pending = TRUE
                """
            )
        )
        op.drop_column("participant_profile", "onboarding_reset_pending")


def downgrade() -> None:
    conn = op.get_bind()
    columns = [c["name"] for c in inspect(conn).get_columns("participant_profile")]
    if "onboarding_reset_pending" not in columns:
        op.add_column(
            "participant_profile",
            sa.Column(
                "onboarding_reset_pending",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("FALSE"),
            ),
        )
    if "onboarding_reset_to" in columns:
        op.execute(
            sa.text(
                """
                UPDATE participant_profile
                SET onboarding_reset_pending = TRUE
                WHERE onboarding_reset_to IS NOT NULL
                """
            )
        )
        op.drop_column("participant_profile", "onboarding_reset_to")
