"""
Onboarding Service
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_
from uuid import UUID
from typing import Optional

from app.db.models import (
    ParticipantProfile,
    SurveyForm,
    FormSubmission,
    ConsentFormTemplate,
    BackgroundInfoTemplate,
    ParticipantConsent,
)

INTAKE_FORM_TITLE = "Intake Form"
ONBOARDING_RESET_TARGETS = {"PENDING", "BACKGROUND_READ", "CONSENT_GIVEN"}


def _normalize_reset_target(reset_to: str | None) -> str | None:
    if reset_to is None:
        return None
    normalized = str(reset_to).strip().upper()
    if normalized in ONBOARDING_RESET_TARGETS:
        return normalized
    return None


async def check_intake_completed(user_id: UUID, db: AsyncSession) -> bool:
    """Returns True if the participant has already submitted the intake form."""
    profile_result = await db.execute(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return False

    intake_form_result = await db.execute(
        select(SurveyForm).where(SurveyForm.title == INTAKE_FORM_TITLE)
    )
    intake_form = intake_form_result.scalar_one_or_none()
    if not intake_form:
        return False

    submission_result = await db.execute(
        select(FormSubmission).where(
            FormSubmission.form_id == intake_form.form_id,
            FormSubmission.participant_id == profile.participant_id,
            FormSubmission.submitted_at.isnot(None),
        )
    )
    return submission_result.scalar_one_or_none() is not None


async def get_active_consent_template(db: AsyncSession) -> Optional[ConsentFormTemplate]:
    """Returns the currently active consent form template, or None."""
    result = await db.execute(
        select(ConsentFormTemplate).where(ConsentFormTemplate.is_active == True)
    )
    return result.scalar_one_or_none()


async def get_active_background_template(db: AsyncSession) -> Optional[BackgroundInfoTemplate]:
    """Returns the currently active background info template, or None."""
    result = await db.execute(
        select(BackgroundInfoTemplate).where(BackgroundInfoTemplate.is_active == True)
    )
    return result.scalar_one_or_none()


async def submit_consent(
    participant_id: UUID,
    template_id: UUID,
    answers: dict,
    signature: str,
    db: AsyncSession,
) -> ParticipantConsent:
    """
    Validates and saves a consent submission for a participant.
    Updates onboarding_status to CONSENT_GIVEN.
    Raises ValueError on validation failure.
    """
    if not signature or not signature.strip():
        raise ValueError("Signature is required.")

    template_result = await db.execute(
        select(ConsentFormTemplate).where(ConsentFormTemplate.template_id == template_id)
    )
    template = template_result.scalar_one_or_none()
    if not template:
        raise ValueError("Consent template not found.")

    for item in template.items:
        if answers.get(item["id"]) != "yes":
            raise ValueError(
                f"Consent item '{item['id']}' must be agreed to."
            )

    consent = ParticipantConsent(
        participant_id=participant_id,
        template_id=template_id,
        answers=answers,
        signature=signature,
    )
    db.add(consent)

    await db.execute(
        update(ParticipantProfile)
        .where(ParticipantProfile.participant_id == participant_id)
        .values(onboarding_status="CONSENT_GIVEN")
    )

    await db.commit()
    await db.refresh(consent)
    return consent


async def mark_background_read(user_id: UUID, db: AsyncSession) -> None:
    """
    Updates onboarding_status to BACKGROUND_READ only if current status is PENDING.
    """
    result = await db.execute(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise ValueError("Participant profile not found.")

    if profile.onboarding_status == "PENDING":
        await db.execute(
            update(ParticipantProfile)
            .where(ParticipantProfile.participant_id == profile.participant_id)
            .values(onboarding_status="BACKGROUND_READ")
        )
        await db.commit()


async def complete_onboarding(user_id: UUID, db: AsyncSession) -> None:
    """
    Updates onboarding_status to COMPLETED only if current status is CONSENT_GIVEN.
    """
    result = await db.execute(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise ValueError("Participant profile not found.")

    if profile.onboarding_status != "CONSENT_GIVEN":
        raise ValueError(
            "Cannot complete onboarding: consent must be given first."
        )

    await db.execute(
        update(ParticipantProfile)
        .where(ParticipantProfile.participant_id == profile.participant_id)
        .values(onboarding_status="COMPLETED")
    )
    await db.commit()


async def queue_onboarding_reset_for_completed_participants(
    reset_to: str,
    db: AsyncSession,
) -> int:
    """
    Queue an onboarding reset for completed participants to be applied at login.

    reset_to:
      - PENDING          -> restart at background page
      - BACKGROUND_READ  -> restart at consent page
      - CONSENT_GIVEN    -> restart at intake page

    If participants already have a pending reset, the earlier step wins
    (PENDING < BACKGROUND_READ < CONSENT_GIVEN).
    """
    normalized_target = _normalize_reset_target(reset_to)
    if not normalized_target:
        raise ValueError(f"Invalid onboarding reset target: {reset_to}")

    stmt = update(ParticipantProfile).where(
        ParticipantProfile.onboarding_status == "COMPLETED"
    )

    if normalized_target == "PENDING":
        stmt = stmt.where(
            or_(
                ParticipantProfile.onboarding_reset_to.is_(None),
                ParticipantProfile.onboarding_reset_to != "PENDING",
            )
        )
    elif normalized_target == "BACKGROUND_READ":
        stmt = stmt.where(
            or_(
                ParticipantProfile.onboarding_reset_to.is_(None),
                ParticipantProfile.onboarding_reset_to == "CONSENT_GIVEN",
            )
        )
    else:  # CONSENT_GIVEN
        stmt = stmt.where(ParticipantProfile.onboarding_reset_to.is_(None))

    result = await db.execute(stmt.values(onboarding_reset_to=normalized_target))
    return int(result.rowcount or 0)


async def process_pending_onboarding_reset(user_id: UUID, db: AsyncSession) -> str | None:
    """
    Apply a queued onboarding reset for this participant at login.

    Returns the reset target when a reset was applied, otherwise None.
    """
    profile_result = await db.execute(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return None

    reset_target = _normalize_reset_target(profile.onboarding_reset_to)
    if not reset_target:
        if profile.onboarding_reset_to:
            await db.execute(
                update(ParticipantProfile)
                .where(ParticipantProfile.participant_id == profile.participant_id)
                .values(onboarding_reset_to=None)
            )
        return None

    intake_form_result = await db.execute(
        select(SurveyForm).where(SurveyForm.title == INTAKE_FORM_TITLE)
    )
    intake_form = intake_form_result.scalar_one_or_none()

    await db.execute(
        update(ParticipantProfile)
        .where(ParticipantProfile.participant_id == profile.participant_id)
        .values(
            onboarding_status=reset_target,
            onboarding_reset_to=None,
        )
    )

    if intake_form:
        await db.execute(
            update(FormSubmission)
            .where(
                FormSubmission.form_id == intake_form.form_id,
                FormSubmission.participant_id == profile.participant_id,
                FormSubmission.submitted_at.isnot(None),
            )
            .values(submitted_at=None)
        )

    return reset_target


async def get_onboarding_status(user_id: UUID, db: AsyncSession) -> str:
    """Returns the onboarding_status string for the participant, defaulting to 'PENDING'."""
    result = await db.execute(
        select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return "PENDING"
    return profile.onboarding_status or "PENDING"


async def update_consent_template(
    items: list,
    title: str,
    subtitle: Optional[str],
    admin_user_id: UUID,
    db: AsyncSession,
) -> ConsentFormTemplate:
    """
    Creates a new version of the consent form template and deactivates all prior versions.
    """
    version_result = await db.execute(
        select(ConsentFormTemplate).where(ConsentFormTemplate.is_active == True)
    )
    current = version_result.scalar_one_or_none()
    next_version = (current.version + 1) if current else 1

    await db.execute(
        update(ConsentFormTemplate).values(is_active=False)
    )

    new_template = ConsentFormTemplate(
        version=next_version,
        title=title,
        subtitle=subtitle,
        items=items,
        is_active=True,
        created_by=admin_user_id,
    )
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return new_template


async def update_background_template(
    sections: list,
    title: str,
    subtitle: Optional[str],
    admin_user_id: UUID,
    db: AsyncSession,
) -> BackgroundInfoTemplate:
    """
    Creates a new version of the background info template and deactivates all prior versions.
    """
    version_result = await db.execute(
        select(BackgroundInfoTemplate).where(BackgroundInfoTemplate.is_active == True)
    )
    current = version_result.scalar_one_or_none()
    next_version = (current.version + 1) if current else 1

    await db.execute(
        update(BackgroundInfoTemplate).values(is_active=False)
    )

    new_template = BackgroundInfoTemplate(
        version=next_version,
        title=title,
        subtitle=subtitle,
        sections=sections,
        is_active=True,
        created_by=admin_user_id,
    )
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    return new_template
