"""Drop dormant tables: devices, mfa_methods, mfa_challenges, reminders, report_files

These tables were defined in early migrations for features (MFA, device
tracking, report attachments, reminders) that were never implemented. No code
ever writes or reads from them — they only appeared in backup/restore cascade
loops. Dropping them reduces schema surface area and simplifies the backup and
user-deletion logic.

Revision ID: 0050
Revises: 0049
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB


revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # sessions.device_id holds a FK into devices. Drop it before dropping
    # devices so the foreign key constraint doesn't block the drop.
    op.drop_column("sessions", "device_id")

    # mfa_challenges → mfa_methods (challenge.mfa_id FK). Drop the dependent first.
    op.drop_table("mfa_challenges")
    op.drop_table("mfa_methods")
    op.drop_table("devices")
    op.drop_table("reminders")
    op.drop_table("report_files")


def downgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("device_id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_fingerprint", sa.Text, unique=True, nullable=False),
        sa.Column("device_name", sa.Text),
        sa.Column("platform", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("trusted_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True)),
    )
    op.create_index("ix_devices_user_id", "devices", ["user_id"])

    op.add_column(
        "sessions",
        sa.Column("device_id", PG_UUID(as_uuid=True), sa.ForeignKey("devices.device_id", ondelete="SET NULL")),
    )

    op.create_table(
        "mfa_methods",
        sa.Column("mfa_id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("secret_or_ref", sa.Text, nullable=False),
        sa.Column("enabled_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("last_used_at", sa.TIMESTAMP(timezone=True)),
    )
    op.create_index("ix_mfa_methods_user_id", "mfa_methods", ["user_id"])

    op.create_table(
        "mfa_challenges",
        sa.Column("challenge_id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", PG_UUID(as_uuid=True), sa.ForeignKey("sessions.session_id", ondelete="CASCADE"), nullable=False),
        sa.Column("mfa_id", PG_UUID(as_uuid=True), sa.ForeignKey("mfa_methods.mfa_id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.Column("verified_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("attempts", sa.Integer, server_default=sa.text("0")),
    )
    op.create_index("ix_mfa_challenges_session_id", "mfa_challenges", ["session_id"])
    op.create_index("ix_mfa_challenges_mfa_id", "mfa_challenges", ["mfa_id"])

    op.create_table(
        "reminders",
        sa.Column("reminder_id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", PG_UUID(as_uuid=True), sa.ForeignKey("users.user_id")),
        sa.Column("label", sa.Text),
        sa.Column("schedule_type", sa.Text),
        sa.Column("schedule_json", JSONB),
        sa.Column("enabled", sa.Boolean, server_default=sa.text("TRUE")),
        sa.Column("next_run_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_reminders_user_id", "reminders", ["user_id"])

    op.create_table(
        "report_files",
        sa.Column("file_id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("report_id", PG_UUID(as_uuid=True), sa.ForeignKey("reports.report_id")),
        sa.Column("file_type", sa.Text),
        sa.Column("storage_path", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_report_files_report_id", "report_files", ["report_id"])
