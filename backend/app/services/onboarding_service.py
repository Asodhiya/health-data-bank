from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.db.models import ParticipantProfile, SurveyForm, FormSubmission

INTAKE_FORM_TITLE = "Intake Form"


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
