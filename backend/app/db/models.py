import uuid
from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
    PrimaryKeyConstraint,
    text,

)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from datetime import datetime

from typing import List

class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    username: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    first_name: Mapped[str | None] = mapped_column(Text)
    last_name: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    status: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    last_login_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    Address: Mapped[str | None] = mapped_column(Text)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    role_name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

    users = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "role_id", name="pk_user_roles"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("roles.role_id", ondelete="CASCADE"), nullable=False
    )

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")


class Permission(Base):
    __tablename__ = "permissions"

    permission_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    roles = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (
        PrimaryKeyConstraint("role_id", "permission_id", name="pk_role_permissions"),
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("roles.role_id", ondelete="CASCADE"), nullable=False
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("permissions.permission_id", ondelete="CASCADE"), nullable=False
    )

    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")




class Device(Base):
    __tablename__ = "devices"

    device_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"))
    device_fingerprint: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    device_name: Mapped[str | None] = mapped_column(Text)
    platform: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    last_seen_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    trusted_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    revoked_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))


class Session(Base):
    __tablename__ = "sessions"

    session_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"))
    device_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("devices.device_id", ondelete="SET NULL"))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    expired_at: Mapped[str] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    mfa_verified_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))


class MFAMethod(Base):
    __tablename__ = "mfa_methods"

    mfa_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(Text, nullable=False)
    secret_or_ref: Mapped[str] = mapped_column(Text, nullable=False)
    enabled_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    last_used_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))


class MFAChallenge(Base):
    __tablename__ = "mfa_challenges"

    challenge_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    session_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("sessions.session_id", ondelete="CASCADE"))
    mfa_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("mfa_methods.mfa_id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    verified_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    attempts: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))




class ParticipantProfile(Base):
    __tablename__ = "participant_profile"

    participant_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        unique=True,
    )
    dob: Mapped[str | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    program_enrolled_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))


class CaretakerProfile(Base):
    __tablename__ = "caretaker_profile"

    caretaker_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), unique=True)
    title: Mapped[str | None] = mapped_column(Text)
    organization: Mapped[str | None] = mapped_column(Text)


class ResearcherProfile(Base):
    __tablename__ = "researcher_profile"

    researcher_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), unique=True)
    department: Mapped[str | None] = mapped_column(Text)


class AdminProfile(Base):
    __tablename__ = "admin_profile"

    admin_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), unique=True)



class Group(Base):
    __tablename__ = "groups"

    group_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    caretaker_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("caretaker_profile.caretaker_id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"))


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (
        PrimaryKeyConstraint("group_id", "participant_id", name="pk_group_members"),
    )

    group_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("groups.group_id", ondelete="CASCADE"))
    participant_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("participant_profile.participant_id", ondelete="CASCADE"))
    joined_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    left_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))




class SurveyForm(Base):
    __tablename__ = "survey_forms"

    form_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int | None] = mapped_column(Integer, server_default=text("1"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    fields: Mapped[List["FormField"]]= relationship("FormField", back_populates="form", cascade="all, delete-orphan")


class FormField(Base):
    __tablename__ = "form_fields"

    field_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    form_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("survey_forms.form_id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(Text, nullable=False)
    field_type: Mapped[str] = mapped_column(Text, nullable=False)
    is_required: Mapped[bool | None] = mapped_column(Boolean, server_default=text("FALSE"))
    display_order: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_fields.field_id"))
    options: Mapped[List["FieldOption"]] = relationship("FieldOption", back_populates="field", cascade="all, delete-orphan", foreign_keys="[FieldOption.field_id]")
    form: Mapped["SurveyForm"] = relationship("SurveyForm", back_populates="fields")

class FieldOption(Base):
    __tablename__ = "field_options"

    option_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    field_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_fields.field_id", ondelete="CASCADE"))
    value: Mapped[int | None] = mapped_column(Integer)
    label: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_fields.field_id"))
    field: Mapped["FormField"] = relationship("FormField", back_populates="options",foreign_keys="[FieldOption.field_id]")

class FormDeployment(Base):
    __tablename__ = "form_deployments"

    deployment_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    form_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("survey_forms.form_id"))
    group_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("groups.group_id"))
    deployed_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    deployed_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    revoked_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))


class FormSubmission(Base):
    __tablename__ = "form_submissions"

    submission_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    form_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("survey_forms.form_id"))
    participant_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("participant_profile.participant_id"))
    group_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("groups.group_id"))
    submitted_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    is_valid: Mapped[bool | None] = mapped_column(Boolean, server_default=text("TRUE"))


class SubmissionAnswer(Base):
    __tablename__ = "submission_answers"

    answer_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    submission_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_submissions.submission_id", ondelete="CASCADE"))
    field_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_fields.field_id"))
    value_text: Mapped[str | None] = mapped_column(Text)
    value_number: Mapped[float | None] = mapped_column(Numeric)
    value_date: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    value_json: Mapped[dict | None] = mapped_column(JSONB)




class HealthGoal(Base):
    __tablename__ = "health_goals"

    goal_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    participant_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("participant_profile.participant_id"))
    goal_type: Mapped[str | None] = mapped_column(Text)
    target_value: Mapped[float | None] = mapped_column(Numeric)
    unit: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text, server_default=text("'active'"))
    start_date: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    end_date: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class CaretakerFeedback(Base):
    __tablename__ = "caretaker_feedback"

    feedback_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    caretaker_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("caretaker_profile.caretaker_id"))
    participant_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("participant_profile.participant_id"))
    submission_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_submissions.submission_id"))
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))




class Report(Base):
    __tablename__ = "reports"

    report_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    report_type: Mapped[str | None] = mapped_column(Text)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    participant_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("participant_profile.participant_id"))
    group_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("groups.group_id"))
    parameters: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class ReportFile(Base):
    __tablename__ = "report_files"

    file_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    report_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("reports.report_id"))
    file_type: Mapped[str | None] = mapped_column(Text)
    storage_path: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))




class Backup(Base):
    __tablename__ = "backups"

    backup_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    checksum: Mapped[str | None] = mapped_column(Text)


class RestoreEvent(Base):
    __tablename__ = "restore_events"

    restore_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    backup_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("backups.backup_id", ondelete="SET NULL"))
    restored_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    restored_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    notes: Mapped[str | None] = mapped_column(Text)


class AuditLog(Base):
    __tablename__ = "audit_log"

    audit_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    action: Mapped[str | None] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(Text)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    ip_address: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    details: Mapped[dict | None] = mapped_column(JSONB)



class DataElement(Base):
    __tablename__ = "data_elements"

    element_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    code: Mapped[str | None] = mapped_column(Text, unique=True)
    label: Mapped[str | None] = mapped_column(Text)
    datatype: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("TRUE"))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class FieldElementMap(Base):
    __tablename__ = "field_element_map"
    __table_args__ = (
        PrimaryKeyConstraint("field_id", "element_id", name="pk_field_element_map"),
    )

    field_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_fields.field_id"))
    element_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("data_elements.element_id"))
    transform_rule: Mapped[dict | None] = mapped_column(JSONB)
    mapped_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class HealthDataPoint(Base):
    __tablename__ = "health_data_points"

    data_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    participant_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("participant_profile.participant_id"))
    element_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("data_elements.element_id"))
    observed_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    source_type: Mapped[str | None] = mapped_column(Text)
    source_submission_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    source_field_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    entered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    value_text: Mapped[str | None] = mapped_column(Text)
    value_number: Mapped[float | None] = mapped_column(Numeric)
    value_date: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    value_json: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))




class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    deployment_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_deployments.deployment_id"))
    type: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text, server_default=text("'unread'"))
    source_type: Mapped[str | None] = mapped_column(Text)
    source_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    read_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))


class Reminder(Base):
    __tablename__ = "reminders"

    reminder_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    label: Mapped[str | None] = mapped_column(Text)
    schedule_type: Mapped[str | None] = mapped_column(Text)
    schedule_json: Mapped[dict | None] = mapped_column(JSONB)
    enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("TRUE"))
    next_run_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
