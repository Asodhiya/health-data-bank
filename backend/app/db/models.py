import uuid
from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
    reset_token_hash: Mapped[str | None] = mapped_column( String,nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True),nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    locked_until: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    participant_profile = relationship("ParticipantProfile", back_populates="user", uselist=False, lazy="selectin")
    researcher_profile = relationship("ResearcherProfile", back_populates="user", uselist=False, lazy="selectin")
    caretaker_profile = relationship("CaretakerProfile", back_populates="user", uselist=False, lazy="selectin")
    admin_profile = relationship("AdminProfile", back_populates="user", uselist=False, lazy="selectin")


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    role_name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

    users = relationship("UserRole", back_populates="role", cascade="all, delete-orphan",lazy="selectin")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

class SignupInvite(Base):
    __tablename__ = "signup_invites"

    invite_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    email: Mapped[str] = mapped_column(Text, nullable=False)

    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    role_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("roles.role_id", ondelete="CASCADE"),
        nullable=False
    )

    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False
    )

    used: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("FALSE")
    )

    invited_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=False
    )

    group_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("groups.group_id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

    role = relationship("Role")
    
class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "role_id", name="pk_user_roles"),
        UniqueConstraint("user_id", name="uq_user_roles_user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("roles.role_id", ondelete="CASCADE"), nullable=False
    )

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users",lazy="selectin")


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
    pronouns: Mapped[str | None] = mapped_column(Text)
    primary_language: Mapped[str | None] = mapped_column(Text)
    occupation_status: Mapped[str | None] = mapped_column(Text)
    living_arrangement: Mapped[str | None] = mapped_column(Text)
    highest_education_level: Mapped[str | None] = mapped_column(Text)
    dependents: Mapped[int | None] = mapped_column(Integer)
    marital_status: Mapped[str | None] = mapped_column(Text)
    country_of_origin: Mapped[str | None] = mapped_column(Text)
    program_enrolled_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    onboarding_status: Mapped[str | None] = mapped_column(Text, server_default=text("'PENDING'"))
    user = relationship("User", back_populates="participant_profile")
    consents: Mapped[list["ParticipantConsent"]] = relationship(
        "ParticipantConsent", back_populates="participant", cascade="all, delete-orphan"
    )


class CaretakerProfile(Base):
    __tablename__ = "caretaker_profile"

    caretaker_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), unique=True)
    title: Mapped[str | None] = mapped_column(Text)
    organization: Mapped[str | None] = mapped_column(Text)
    credentials: Mapped[str | None] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(Text)
    specialty: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    working_hours_start: Mapped[str | None] = mapped_column(Text)
    working_hours_end: Mapped[str | None] = mapped_column(Text)
    contact_preference: Mapped[str | None] = mapped_column(Text)
    available_days: Mapped[list | None] = mapped_column(JSONB)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    user = relationship("User", back_populates="caretaker_profile")


class ResearcherProfile(Base):
    __tablename__ = "researcher_profile"

    researcher_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), unique=True)
    title: Mapped[str | None] = mapped_column(Text)
    credentials: Mapped[str | None] = mapped_column(Text)
    organization: Mapped[str | None] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(Text)
    specialty: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    user = relationship("User", back_populates="researcher_profile")


class AdminProfile(Base):
    __tablename__ = "admin_profile"

    admin_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), unique=True)
    title: Mapped[str | None] = mapped_column(Text)
    role_title: Mapped[str | None] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(Text)
    organization: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    contact_preference: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'email'"))
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    user = relationship("User", back_populates="admin_profile")



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
    parent_form_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("survey_forms.form_id"), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    modified_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    fields: Mapped[List["FormField"]]= relationship("FormField", back_populates="form", cascade="all, delete-orphan")


class FormField(Base):
    __tablename__ = "form_fields"

    field_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    form_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("survey_forms.form_id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(Text, nullable=False)
    field_type: Mapped[str] = mapped_column(Text, nullable=False)
    profile_field: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_required: Mapped[bool | None] = mapped_column(Boolean, server_default=text("FALSE"))
    display_order: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
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
    form_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("survey_forms.form_id", ondelete="SET NULL"))
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
    submitted_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    #submitted_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()")) #what it used to be
    is_valid: Mapped[bool | None] = mapped_column(Boolean, server_default=text("TRUE"))

class SubmissionAnswer(Base):
    __tablename__ = "submission_answers"
    __table_args__ = (
        PrimaryKeyConstraint("submission_id", "field_id", name="pk_submission_answers"),
    )

    submission_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_submissions.submission_id", ondelete="CASCADE"))
    field_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_fields.field_id"))
    value_text: Mapped[str | None] = mapped_column(Text)
    value_number: Mapped[float | None] = mapped_column(Numeric)
    value_date: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    value_json: Mapped[dict | None] = mapped_column(JSONB)




class GoalTemplate(Base):
    __tablename__ = "goal_templates"
    __table_args__ = (
        CheckConstraint(
            "progress_mode IN ('incremental', 'absolute')",
            name="ck_goal_templates_progress_mode",
        ),
        CheckConstraint(
            "direction IN ('at_least', 'at_most')",
            name="ck_goal_templates_direction",
        ),
        CheckConstraint(
            "\"window\" IN ('daily', 'weekly', 'monthly', 'none')",
            name="ck_goal_templates_window",
        ),
    )

    template_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    element_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("data_elements.element_id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    default_target: Mapped[float | None] = mapped_column(Numeric)
    progress_mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'incremental'"))
    direction: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'at_least'"))
    window: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'daily'"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("TRUE"))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class HealthGoal(Base):
    __tablename__ = "health_goals"

    goal_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    participant_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("participant_profile.participant_id"))
    template_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("goal_templates.template_id"))
    element_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("data_elements.element_id", ondelete="SET NULL"))
    target_value: Mapped[float | None] = mapped_column(Numeric)
    progress_mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'incremental'"))
    direction: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'at_least'"))
    window: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'daily'"))
    baseline_value: Mapped[float | None] = mapped_column(Numeric)
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


class CaretakerNote(Base):
    __tablename__ = "caretaker_notes"

    note_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    caretaker_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("caretaker_profile.caretaker_id", ondelete="CASCADE"), nullable=False)
    participant_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("participant_profile.participant_id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    tag: Mapped[str | None] = mapped_column(Text)




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
    snapshot_content: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'manual'"))


class BackupScheduleSettings(Base):
    __tablename__ = "backup_schedule_settings"

    schedule_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    frequency: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'weekly'"))
    time_local: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'03:00'"))
    day_of_week: Mapped[str | None] = mapped_column(Text)
    day_of_month: Mapped[int | None] = mapped_column(Integer)
    timezone: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'UTC'"))
    scope: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'full'"))
    retention_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("5"))
    notify_on_success: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    notify_on_failure: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"))
    anchor_at_utc: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL")
    )


class SystemMaintenanceSettings(Base):
    __tablename__ = "system_maintenance_settings"

    setting_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'The system is currently undergoing scheduled maintenance. Please check back shortly.'"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL")
    )


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

    health_data_points: Mapped[list["HealthDataPoint"]] = relationship(
        "HealthDataPoint", back_populates="data_element", cascade="all, delete-orphan"
    )


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
    element_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("data_elements.element_id", ondelete="CASCADE"))
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

    data_element: Mapped["DataElement"] = relationship("DataElement", back_populates="health_data_points")




class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.user_id"))
    deployment_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("form_deployments.deployment_id"))
    type: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(Text)
    role_target: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text, server_default=text("'unread'"))
    source_type: Mapped[str | None] = mapped_column(Text)
    source_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    read_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))


class SystemFeedback(Base):
    __tablename__ = "system_feedback"

    feedback_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL")
    )
    category: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'general'"))
    subject: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    page_path: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'new'"))
    reviewed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()")
    )


class ConsentFormTemplate(Base):
    __tablename__ = "consent_form_template"

    template_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(Text)
    items: Mapped[list] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("TRUE"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    consents: Mapped[list["ParticipantConsent"]] = relationship(
        "ParticipantConsent", back_populates="template"
    )


class BackgroundInfoTemplate(Base):
    __tablename__ = "background_info_template"

    template_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(Text)
    sections: Mapped[list] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool | None] = mapped_column(Boolean, server_default=text("TRUE"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class ParticipantConsent(Base):
    __tablename__ = "participant_consent"

    consent_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("participant_profile.participant_id", ondelete="CASCADE"),
        nullable=False,
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consent_form_template.template_id"),
        nullable=False,
    )
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    signature: Mapped[str] = mapped_column(Text, nullable=False)
    consent_date: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    withdrawn_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    participant: Mapped["ParticipantProfile"] = relationship("ParticipantProfile", back_populates="consents")
    template: Mapped["ConsentFormTemplate"] = relationship("ConsentFormTemplate", back_populates="consents")


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
