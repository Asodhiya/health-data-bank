"""Add FK and performance indexes

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-23

Adds indexes on:
- High-traffic FK columns used in JOINs and WHERE clauses
- Composite indexes on health_data_points and form_submissions
- Timestamp columns used in range filters
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── health_data_points ────────────────────────────────────────────────────
    # Covers all stats/trends/report queries: participant filter + element group + date range
    op.create_index(
        "ix_hdp_participant_element_observed",
        "health_data_points",
        ["participant_id", "element_id", "observed_at"],
    )
    # Reverse lookup: all participants for a given element
    op.create_index(
        "ix_hdp_element_id",
        "health_data_points",
        ["element_id"],
    )

    # ── form_submissions ──────────────────────────────────────────────────────
    # Covers get_participant_submissions and the unscoped subqueries in get_participants
    op.create_index(
        "ix_fs_participant_submitted",
        "form_submissions",
        ["participant_id", "submitted_at"],
    )
    op.create_index(
        "ix_fs_form_id",
        "form_submissions",
        ["form_id"],
    )
    op.create_index(
        "ix_fs_group_id",
        "form_submissions",
        ["group_id"],
    )

    # ── notifications ─────────────────────────────────────────────────────────
    # list_notifications filters by user_id and status
    op.create_index(
        "ix_notifications_user_status",
        "notifications",
        ["user_id", "status"],
    )
    op.create_index(
        "ix_notifications_deployment_id",
        "notifications",
        ["deployment_id"],
    )

    # ── health_goals ──────────────────────────────────────────────────────────
    op.create_index(
        "ix_hg_participant_status",
        "health_goals",
        ["participant_id", "status"],
    )
    op.create_index(
        "ix_hg_element_id",
        "health_goals",
        ["element_id"],
    )
    op.create_index(
        "ix_hg_template_id",
        "health_goals",
        ["template_id"],
    )

    # ── reports ───────────────────────────────────────────────────────────────
    # list_reports: WHERE requested_by = ? ORDER BY created_at DESC
    op.create_index(
        "ix_reports_requested_by_created",
        "reports",
        ["requested_by", "created_at"],
    )
    op.create_index(
        "ix_reports_participant_id",
        "reports",
        ["participant_id"],
    )
    op.create_index(
        "ix_reports_group_id",
        "reports",
        ["group_id"],
    )

    # ── groups ────────────────────────────────────────────────────────────────
    # get_groups joins Group → CaretakerProfile via caretaker_id
    op.create_index(
        "ix_groups_caretaker_id",
        "groups",
        ["caretaker_id"],
    )

    # ── group_members ─────────────────────────────────────────────────────────
    # PK is (group_id, participant_id) — participant_id alone has no index
    op.create_index(
        "ix_group_members_participant_id",
        "group_members",
        ["participant_id"],
    )

    # ── form_deployments ──────────────────────────────────────────────────────
    # get_available_elements filters WHERE group_id = ? AND revoked_at IS NULL
    op.create_index(
        "ix_fd_group_id_revoked",
        "form_deployments",
        ["group_id", "revoked_at"],
    )
    op.create_index(
        "ix_fd_form_id",
        "form_deployments",
        ["form_id"],
    )

    # ── form_fields ───────────────────────────────────────────────────────────
    # SurveyForm → FormField join on form_id
    op.create_index(
        "ix_form_fields_form_id",
        "form_fields",
        ["form_id"],
    )

    # ── field_element_map ─────────────────────────────────────────────────────
    # PK is (field_id, element_id) — element_id alone has no index
    op.create_index(
        "ix_fem_element_id",
        "field_element_map",
        ["element_id"],
    )

    # ── caretaker_feedback ────────────────────────────────────────────────────
    op.create_index(
        "ix_cf_participant_id",
        "caretaker_feedback",
        ["participant_id"],
    )
    op.create_index(
        "ix_cf_caretaker_id",
        "caretaker_feedback",
        ["caretaker_id"],
    )
    op.create_index(
        "ix_cf_submission_id",
        "caretaker_feedback",
        ["submission_id"],
    )

    # ── goal_templates ────────────────────────────────────────────────────────
    op.create_index(
        "ix_gt_element_id",
        "goal_templates",
        ["element_id"],
    )

    # ── auth / session tables ─────────────────────────────────────────────────
    op.create_index("ix_devices_user_id", "devices", ["user_id"])
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_mfa_methods_user_id", "mfa_methods", ["user_id"])
    op.create_index("ix_mfa_challenges_session_id", "mfa_challenges", ["session_id"])
    op.create_index("ix_mfa_challenges_mfa_id", "mfa_challenges", ["mfa_id"])

    # ── audit / admin tables ──────────────────────────────────────────────────
    op.create_index("ix_audit_log_actor_user_id", "audit_log", ["actor_user_id"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])
    op.create_index("ix_signup_invites_role_id", "signup_invites", ["role_id"])
    op.create_index("ix_signup_invites_invited_by", "signup_invites", ["invited_by"])
    op.create_index("ix_report_files_report_id", "report_files", ["report_id"])
    op.create_index("ix_reminders_user_id", "reminders", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_reminders_user_id", table_name="reminders")
    op.drop_index("ix_report_files_report_id", table_name="report_files")
    op.drop_index("ix_signup_invites_invited_by", table_name="signup_invites")
    op.drop_index("ix_signup_invites_role_id", table_name="signup_invites")
    op.drop_index("ix_audit_log_created_at", table_name="audit_log")
    op.drop_index("ix_audit_log_actor_user_id", table_name="audit_log")
    op.drop_index("ix_mfa_challenges_mfa_id", table_name="mfa_challenges")
    op.drop_index("ix_mfa_challenges_session_id", table_name="mfa_challenges")
    op.drop_index("ix_mfa_methods_user_id", table_name="mfa_methods")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_index("ix_devices_user_id", table_name="devices")
    op.drop_index("ix_gt_element_id", table_name="goal_templates")
    op.drop_index("ix_cf_submission_id", table_name="caretaker_feedback")
    op.drop_index("ix_cf_caretaker_id", table_name="caretaker_feedback")
    op.drop_index("ix_cf_participant_id", table_name="caretaker_feedback")
    op.drop_index("ix_fem_element_id", table_name="field_element_map")
    op.drop_index("ix_form_fields_form_id", table_name="form_fields")
    op.drop_index("ix_fd_form_id", table_name="form_deployments")
    op.drop_index("ix_fd_group_id_revoked", table_name="form_deployments")
    op.drop_index("ix_group_members_participant_id", table_name="group_members")
    op.drop_index("ix_groups_caretaker_id", table_name="groups")
    op.drop_index("ix_reports_group_id", table_name="reports")
    op.drop_index("ix_reports_participant_id", table_name="reports")
    op.drop_index("ix_reports_requested_by_created", table_name="reports")
    op.drop_index("ix_hg_template_id", table_name="health_goals")
    op.drop_index("ix_hg_element_id", table_name="health_goals")
    op.drop_index("ix_hg_participant_status", table_name="health_goals")
    op.drop_index("ix_notifications_deployment_id", table_name="notifications")
    op.drop_index("ix_notifications_user_status", table_name="notifications")
    op.drop_index("ix_fs_group_id", table_name="form_submissions")
    op.drop_index("ix_fs_form_id", table_name="form_submissions")
    op.drop_index("ix_fs_participant_submitted", table_name="form_submissions")
    op.drop_index("ix_hdp_element_id", table_name="health_data_points")
    op.drop_index("ix_hdp_participant_element_observed", table_name="health_data_points")
