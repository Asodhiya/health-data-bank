import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.security import PasswordHash
from app.db.models import (
    AdminProfile,
    CaretakerProfile,
    FormSubmission,
    ParticipantProfile,
    ResearcherProfile,
    Role,
    SurveyForm,
    User,
    UserRole,
)
from app.db.session import AsyncSessionLocal


DEV_EMAIL = "dev.allroles@healthdatabank.local"
DEV_USERNAME = "dev_allroles"
DEV_PASSWORD = "Test@1234"
DEV_FIRST_NAME = "Dev"
DEV_LAST_NAME = "AllRoles"
ROLE_NAMES = ("admin", "caretaker", "researcher", "participant")
INTAKE_FORM_TITLE = "Intake Form"


async def main() -> None:
    if not settings.DEBUG:
        raise SystemExit("This script only runs in DEBUG mode.")

    async with AsyncSessionLocal() as db:
        roles = (
            await db.execute(select(Role).where(Role.role_name.in_(ROLE_NAMES)))
        ).scalars().all()
        role_map = {role.role_name.lower(): role for role in roles}
        missing_roles = [role for role in ROLE_NAMES if role not in role_map]
        if missing_roles:
            raise SystemExit(f"Missing roles in database: {', '.join(missing_roles)}")

        user = await db.scalar(select(User).where(User.email == DEV_EMAIL))
        password_hash = PasswordHash.from_password(DEV_PASSWORD).to_str()

        if not user:
            user = User(
                username=DEV_USERNAME,
                email=DEV_EMAIL,
                password_hash=password_hash,
                first_name=DEV_FIRST_NAME,
                last_name=DEV_LAST_NAME,
                phone="5550000000",
                Address="Dev Environment",
                status=True,
            )
            db.add(user)
            await db.flush()
        else:
            user.username = DEV_USERNAME
            user.password_hash = password_hash
            user.first_name = DEV_FIRST_NAME
            user.last_name = DEV_LAST_NAME
            user.status = True
            user.failed_login_attempts = 0
            user.locked_until = None
            user.reset_token_hash = None
            user.reset_token_expires_at = None

        existing_role_ids = set(
            (
                await db.execute(
                    select(UserRole.role_id).where(UserRole.user_id == user.user_id)
                )
            ).scalars().all()
        )
        for role_name in ROLE_NAMES:
            role = role_map[role_name]
            if role.role_id not in existing_role_ids:
                db.add(UserRole(user_id=user.user_id, role_id=role.role_id))

        participant_profile = await db.scalar(
            select(ParticipantProfile).where(ParticipantProfile.user_id == user.user_id)
        )
        if not participant_profile:
            participant_profile = ParticipantProfile(
                user_id=user.user_id,
                onboarding_status="COMPLETED",
            )
            db.add(participant_profile)
            await db.flush()
        else:
            participant_profile.onboarding_status = "COMPLETED"

        caretaker_profile = await db.scalar(
            select(CaretakerProfile).where(CaretakerProfile.user_id == user.user_id)
        )
        if not caretaker_profile:
            db.add(
                CaretakerProfile(
                    user_id=user.user_id,
                    title="Dev Caretaker",
                    organization="Health Data Bank",
                    onboarding_completed=True,
                )
            )
        else:
            caretaker_profile.onboarding_completed = True

        researcher_profile = await db.scalar(
            select(ResearcherProfile).where(ResearcherProfile.user_id == user.user_id)
        )
        if not researcher_profile:
            db.add(
                ResearcherProfile(
                    user_id=user.user_id,
                    title="Dev Researcher",
                    organization="Health Data Bank",
                    onboarding_completed=True,
                )
            )
        else:
            researcher_profile.onboarding_completed = True

        admin_profile = await db.scalar(
            select(AdminProfile).where(AdminProfile.user_id == user.user_id)
        )
        if not admin_profile:
            db.add(
                AdminProfile(
                    user_id=user.user_id,
                    title="Dev Admin",
                    role_title="Platform Admin",
                    organization="Health Data Bank",
                    onboarding_completed=True,
                )
            )
        else:
            admin_profile.onboarding_completed = True

        intake_form = await db.scalar(
            select(SurveyForm).where(SurveyForm.title == INTAKE_FORM_TITLE)
        )
        if intake_form and participant_profile:
            intake_submission = await db.scalar(
                select(FormSubmission).where(
                    FormSubmission.form_id == intake_form.form_id,
                    FormSubmission.participant_id == participant_profile.participant_id,
                    FormSubmission.submitted_at.is_not(None),
                )
            )
            if not intake_submission:
                db.add(
                    FormSubmission(
                        form_id=intake_form.form_id,
                        participant_id=participant_profile.participant_id,
                        submitted_at=datetime.now(timezone.utc),
                        is_valid=True,
                    )
                )

        await db.commit()
        print(f"Dev account ready: {DEV_EMAIL} / {DEV_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
