"""
Seed data for onboarding templates.
Run once to insert the initial consent form and background info templates.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import ConsentFormTemplate, BackgroundInfoTemplate


CONSENT_ITEMS = [
    {"id": "read_understood", "text": "I have read and understand the Background Information Sheet.", "required": True},
    {"id": "right_to_withdraw", "text": "I understand that I have the right to withdraw from the research study at any time without reason, and I will receive no penalty.", "required": True},
    {"id": "direct_quotations", "text": "I give permission for the use of direct quotations.", "required": False},
    {"id": "future_contact", "text": "I give permission for the research team to contact me for future research studies.", "required": False},
    {"id": "freedom_withdraw", "text": "I understand that I have the freedom to withdraw from the research study by the specified date. All information collected from you within this study will be deleted.", "required": True},
    {"id": "no_waiver", "text": "I understand that no waiver of rights is sought.", "required": True},
    {"id": "keep_copy", "text": "I understand that I can keep a copy of the signed and dated consent form.", "required": True},
    {"id": "confidential", "text": "I understand that the information will be kept confidential within the limits of the law.", "required": True},
    {"id": "agree_participate", "text": "I agree to participate in the research study.", "required": True},
    {"id": "use_data", "text": "I give permission for the use of my data.", "required": True},
    {"id": "contact_ethics", "text": "I understand that I can contact the UPEI Research Ethics Board at (902) 620-5104, or by email at researchcompliance@upei.ca.", "required": True},
    {"id": "group_confidential", "text": "I understand that the program will take place in a group setting so information shared within the group will remain confidential.", "required": True},
    {"id": "no_guarantee", "text": "Participants are reminded to keep information shared during group sessions confidential but that the research team cannot guarantee confidentiality of group sessions.", "required": True},
]

BACKGROUND_SECTIONS = [
    {"heading": "Principal Investigator", "body": "Content to be provided by research team"},
    {"heading": "Why Is This Research Being Done?", "body": "Content to be provided by research team"},
    {"heading": "What Is The Purpose Of This Research?", "body": "Content to be provided by research team"},
    {"heading": "Why Have I Been Asked To Participate?", "body": "Content to be provided by research team"},
    {"heading": "What Will My Responsibilities Be?", "body": "Content to be provided by research team"},
    {"heading": "What Are The Risks And Discomforts?", "body": "Content to be provided by research team"},
    {"heading": "How Many People Will Be In The Study?", "body": "Content to be provided by research team"},
    {"heading": "What Are The Possible Benefits?", "body": "Content to be provided by research team"},
    {"heading": "What Information Will Be Kept Private?", "body": "Content to be provided by research team"},
    {"heading": "Can Participation In The Study End Early?", "body": "Content to be provided by research team"},
    {"heading": "Will I Be Paid To Participate?", "body": "Content to be provided by research team"},
    {"heading": "Will There Be Any Costs To Me?", "body": "Content to be provided by research team"},
    {"heading": "How Can I Learn About The Results?", "body": "Content to be provided by research team"},
    {"heading": "If I Have Questions Who Should I Call?", "body": "Content to be provided by research team"},
]


async def seed_onboarding_data(db: AsyncSession) -> None:
    """Insert initial consent and background info templates if they don't already exist."""
    consent_result = await db.execute(
        select(ConsentFormTemplate).limit(1)
    )
    if not consent_result.scalar_one_or_none():
        db.add(ConsentFormTemplate(
            version=1,
            title="Research Study Consent Form",
            subtitle=None,
            items=CONSENT_ITEMS,
            is_active=True,
            created_by=None,
        ))

    background_result = await db.execute(
        select(BackgroundInfoTemplate).limit(1)
    )
    if not background_result.scalar_one_or_none():
        db.add(BackgroundInfoTemplate(
            version=1,
            title="Background Information Sheet",
            subtitle=None,
            sections=BACKGROUND_SECTIONS,
            is_active=True,
            created_by=None,
        ))

    await db.commit()
