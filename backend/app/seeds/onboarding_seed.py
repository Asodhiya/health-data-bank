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
    {
        "heading": "",
        "body": (
            "**Connections for Healthy Living**\n\n"
            "*Title of Study*"
        ),
    },
    {
        "heading": "",
        "style": "card",
        "body": (
            "**Principal Investigator**\n\n"
            "Dr. William Montelpare  \n"
            "Professor, Dept. of Applied Human Sciences  \n"
            "University of Prince Edward Island  \n"
            "Charlottetown, PE  \n"
            "Tel: 902-620-5186 · wmontelpare@upei.ca"
        ),
    },
    {
        "heading": "",
        "body": (
            "You have been invited to participate in a research study. You are eligible to participate "
            "in the study because you are an undergraduate student at the University of Prince Edward "
            "Island, that must be available for the next 10 weeks, beginning from when you join the "
            "study. The Connections program is a ten week wellness program for students enrolled at "
            "the University of Prince Edward Island.\n\n"
            "Before you decide whether or not you would like to participate in the research study, "
            "please read this background information sheet so that you can learn about the study and "
            "what is involved in your participation. Once you review this background information "
            "sheet, research staff will be happy to answer any questions that you may have. If you do "
            "decide you would like to participate in the study, you will be asked to sign a letter of "
            "informed consent. Please take as much time as you need to decide whether or not you "
            "would like to participate in the study.\n\n"
            "Your participation in this research study is completely voluntary. You have the right to "
            "withdraw from the research study by February 28, 2023. If you choose to withdraw from "
            "the study, you will not receive any type of penalty. You have the right to refuse to any "
            "of the questions asked of you."
        ),
    },
    {
        "heading": "Why Is This Research Being Done?",
        "body": (
            "Our intention is to develop a health education and promotion program for undergraduate "
            "students enrolled at UPEI. This model of healthcare programming will provide education "
            "on topics that contribute to the health and wellbeing of the student population, along "
            "with an exercise program. The educational curriculum is based on a process-oriented "
            "approach known as a participatory planning process (Reger, Williams & Kolar, 2002). "
            "This process helps participants identify their problems, set goals, mobilize resources, "
            "and develop strategies for achieving their goals."
        ),
    },
    {
        "heading": "What Is The Purpose Of This Research?",
        "body": (
            "The purpose of this specific research study is to determine the effectiveness of an "
            "8-week educational and exercise program in a cohort of university undergraduate students."
        ),
    },
    {
        "heading": "Why Have I Been Asked To Participate?",
        "body": (
            "You have been invited to participate in this research project because you fit the "
            "eligibility criteria for the study. This means that you are currently a University of "
            "Prince Edward Island undergraduate student, lasting the duration of the study.\n\n"
            "Individuals that are interested in participating in the Connections program will be "
            "invited to attend an information session to be held both virtually and in-person at "
            "UPEI. Health Centered Research Clinic staff will explain the program and the various "
            "activities in which participants will be involved, along with expected time commitments. "
            "Interested participants will be required to read through the background information "
            "form and sign the consent form. Once completed, the participant will be asked to do the "
            "Physical Activity Readiness Questionnaire (PAR-Q) as part of the program screening "
            "procedure to determine if the participant is medically eligible to participate without "
            "the need of medical clearance."
        ),
    },
    {
        "heading": "What Will My Responsibilities Be?",
        "body": (
            "If you choose to participate in this research project you will first be asked to sign "
            "the letter of informed consent. Once the consent has been signed the next form you will "
            "need to fill out is the PAR-Q form which assesses your physical readiness. You will "
            "also be asked to complete an initial intake day, scheduled for 1.5 hours. At this time, "
            "you will complete a series of non-invasive physical tests including: balance testing, "
            "one mile walk, half kneeling ankle flexion, back scratch test, resting heart rate, "
            "height/weight measurement and endurance of extensors.\n\n"
            "In addition to the physical tests, you will be asked to complete a number of surveys "
            "about perceived stress, loneliness, willingness to change, physical activity readiness, "
            "and a confidence questionnaire. All testing and sessions will take place at the Health "
            "Centred Research Clinic, located in the lower level of the Steel Building on the UPEI "
            "campus.\n\n"
            "Once you have completed your initial intake day, you may attend your first session. "
            "Both groups will receive all of the education and exercise sessions. Education sessions "
            "will cover various topics related to health, well-being and skills development. Exercise "
            "sessions will include guided group exercise and a tailored exercise routine to complete "
            "at home. All sessions will be 45 minutes in length and held once a week for 8 weeks."
        ),
    },
    {
        "heading": "Time Commitment",
        "style": "card",
        "body": (
            "| Activity | Duration |\n"
            "| --- | --- |\n"
            "| Initial intake day | 1.5 hours |\n"
            "| 8 Education sessions | 8 hours |\n"
            "| 8 Exercise sessions | 8 hours |\n"
            "| Post program assessment | 1.5 hours |\n"
            "| **Total commitment** | **Up to 19 hours** |"
        ),
    },
    {
        "heading": "What Are The Possible Risks And Discomforts?",
        "body": (
            "There are no known risks for participating in this research study. It is possible that "
            "you may feel some exercise related discomfort. There may be risks associated with "
            "participating in an exercise program, but a kinesiologist is present to alleviate those "
            "risks. You may also feel uncomfortable answering some of the questions asked on the "
            "surveys and questionnaires. However, if you feel uncomfortable about anything being "
            "discussed or asked of you, you may choose not to participate in that activity, or "
            "withdraw from the study completely."
        ),
    },
    {
        "heading": "How Many People Will Be In The Study?",
        "body": "There will be 28 participants in this study.",
    },
    {
        "heading": "What Are The Possible Benefits?",
        "body": (
            "There may be no direct benefits to you for participating in the study. However, you may "
            "see some health benefits from increased physical activity and attendance at the education "
            "sessions."
        ),
    },
    {
        "heading": "What Information Will Be Kept Private?",
        "body": (
            "Your personal information will not be shared with anyone outside of the research team "
            "without your consent, or as required by law. Any of the surveys or questionnaires that "
            "you answer will have your name removed and will be given an ID number. Your name will "
            "not be associated with any of the information you provide. A master log with your name "
            "and your ID will be securely stored on a password protected computer at the University "
            "of Prince Edward Island.\n\n"
            "There will be no identifying factors associated with your information, should this "
            "research study be published. Should a member of the research team be concerned about "
            "your health or well-being, they have the right to alert and consult with a primary "
            "healthcare provider. If a member of the research team suspects that you are experiencing "
            "emotional and/or physical abuse, they are obligated to report this information to the "
            "authorities."
        ),
    },
    {
        "heading": "Can Participation In The Study End Early?",
        "body": (
            "Your participation in this research project is completely voluntary. You have the right "
            "to withdraw from the research study by February 28, 2023. Please reach out to either "
            "Anja Salijevic at asalijevic@upei.ca or Laurie Michael at lmichael@upei.ca if you wish "
            "to withdraw. If you would like to pass any of the questions, activities or physical "
            "assessments, you may do so and still remain in the study."
        ),
    },
    {
        "heading": "Who Can Participate?",
        "style": "card",
        "body": (
            "**Inclusion Criteria**\n\n"
            "- Undergraduate student at UPEI\n"
            "- Over 18 years of age\n"
            "- Passing the screening of the PAR-Q test\n\n"
            "**Exclusion Criteria**\n\n"
            "- Under 18 years of age\n"
            "- Not an undergraduate student at UPEI\n"
            "- Not passing the PAR-Q screening and not receiving approval from a health professional\n\n"
            "*PAR-Q is a test to determine whether a client should have a medical evaluation done "
            "before participating in a program that involves exercise.*"
        ),
    },
    {
        "heading": "Will I Be Paid To Participate?",
        "body": "No, you will not be paid to participate in the study. This study is completely voluntary.",
    },
    {
        "heading": "Will There Be Any Costs To Me?",
        "body": "No, there will be no costs to you for participating in this study.",
    },
    {
        "heading": "How Can I Learn About The Results?",
        "body": (
            "If you are interested in receiving a copy of the study abstract once it is complete, "
            "please check the box at the end of the consent form under the Sharing Study Results "
            "section, and leave your email and/or mailing address."
        ),
    },
    {
        "heading": "If I Have Questions, Who Should I Call?",
        "style": "card",
        "body": (
            "**Principal Investigator:** Dr. William Montelpare — "
            "wmontelpare@upei.ca · 902-620-5186\n\n"
            "**Health Educator:** Anja Salijevic — asalijevic@upei.ca\n\n"
            "**Dietitian:** Laurie Michael — lmichael@upei.ca\n\n"
            "*This study has been reviewed and approved by the UPEI Research Ethics Board. "
            "Contact them at researchcompliance@upei.ca or 902-620-5104.*"
        ),
    },
]


async def seed_onboarding_data(db: AsyncSession) -> None:
    """Insert consent template if missing; insert or update background info template."""
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
            subtitle="Appendix A — Please read carefully before proceeding",
            sections=BACKGROUND_SECTIONS,
            is_active=True,
            created_by=None,
        ))

    await db.commit()
