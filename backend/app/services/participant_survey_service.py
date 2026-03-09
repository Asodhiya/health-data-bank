"""
Participant Survey Service
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.db.models import (
    SurveyForm, FormDeployment, GroupMember, FormSubmission, 
    SubmissionAnswer, FormField, ParticipantProfile
)

async def list_assigned_surveys(user_id: UUID, db: AsyncSession) -> List[Dict[str, Any]]:
    """List all surveys assigned to the participant (includes question/answer count)"""
    stmt = select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    result = await db.execute(stmt)
    participant = result.scalar_one_or_none()
    
    if not participant:
        return []

    stmt = (
        select(SurveyForm, FormDeployment)
        .join(FormDeployment, FormDeployment.form_id == SurveyForm.form_id)
        .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
        .where(
            and_(
                GroupMember.participant_id == participant.participant_id,
                SurveyForm.status == "PUBLISHED",
                FormDeployment.revoked_at.is_(None)
            )
        )
        .order_by(desc(FormDeployment.deployed_at))
    )
    result = await db.execute(stmt)
    rows = result.all()

    form_ids = [row.SurveyForm.form_id for row in rows]
    submissions_map = {}
    answer_counts = {}
    question_counts = {}

    if form_ids:
        sub_stmt = select(FormSubmission).where(
            and_(
                FormSubmission.participant_id == participant.participant_id,
                FormSubmission.form_id.in_(form_ids)
            )
        )
        sub_result = await db.execute(sub_stmt)
        for sub in sub_result.scalars():
            submissions_map[sub.form_id] = sub

        sub_ids = [sub.submission_id for sub in submissions_map.values()]
        if sub_ids:
            ans_count_stmt = (
                select(SubmissionAnswer.submission_id, func.count(SubmissionAnswer.answer_id))
                .where(SubmissionAnswer.submission_id.in_(sub_ids))
                .group_by(SubmissionAnswer.submission_id)
            )
            ans_count_res = await db.execute(ans_count_stmt)
            for sub_id, count in ans_count_res:
                answer_counts[sub_id] = count


        q_count_stmt = (
            select(FormField.form_id, func.count(FormField.field_id))
            .where(FormField.form_id.in_(form_ids))
            .group_by(FormField.form_id)
        )
        q_count_res = await db.execute(q_count_stmt)
        for f_id, count in q_count_res:
            question_counts[f_id] = count


    output = []
    for survey, deployment in rows:
        sub = submissions_map.get(survey.form_id)
        status = "NEW"
        submitted_at = None
        answered = 0
        
        if sub:
            if sub.submitted_at:
                status = "COMPLETED"
                submitted_at = sub.submitted_at
            else:
                status = "IN_PROGRESS"
            answered = answer_counts.get(sub.submission_id, 0)
        
        output.append({
            "form_id": survey.form_id,
            "title": survey.title,
            "description": survey.description,
            "status": status, 
            "due_date": None, 
            "deployed_at": deployment.deployed_at,
            "submitted_at": submitted_at,
            "question_count": question_counts.get(survey.form_id, 0),
            "answered_count": answered
        })
        
    return output

async def get_participant_survey_detail(form_id: UUID, user_id: UUID, db: AsyncSession) -> Optional[SurveyForm]:
    """Get survey details of selected survey"""
    stmt = select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    result = await db.execute(stmt)
    participant = result.scalar_one_or_none()
    
    if not participant:
        return None

    stmt = (
        select(FormDeployment)
        .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
        .where(
            and_(
                FormDeployment.form_id == form_id,
                GroupMember.participant_id == participant.participant_id,
                FormDeployment.revoked_at.is_(None)
            )
        )
    )
    result = await db.execute(stmt)
    deployment = result.scalar_one_or_none()
    
    if not deployment:
        return None 

    stmt = (
        select(SurveyForm)
        .where(SurveyForm.form_id == form_id)
        .options(selectinload(SurveyForm.fields).selectinload(FormField.options))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_participant_survey_response(form_id: UUID, user_id: UUID, db: AsyncSession) -> Optional[FormSubmission]:
    """Get existing submission (draft or completed)"""
    stmt = select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    result = await db.execute(stmt)
    participant = result.scalar_one_or_none()
    if not participant:
        return None

    stmt = (
        select(FormSubmission)
        .where(
            and_(
                FormSubmission.form_id == form_id,
                FormSubmission.participant_id == participant.participant_id
            )
        )
        .order_by(desc(FormSubmission.submitted_at)) 
    )
    result = await db.execute(stmt)
    submission = result.scalars().first()

    if not submission:
        return None

    stmt_answers = select(SubmissionAnswer).where(SubmissionAnswer.submission_id == submission.submission_id)
    result_answers = await db.execute(stmt_answers)
    answers = result_answers.scalars().all()

    submission.answers = answers
    return submission


async def save_survey_response(form_id: UUID, user_id: UUID, answers: List[Dict[str, Any]], db: AsyncSession,is_draft: bool = False) -> FormSubmission:
    """Save or Submit survey response"""
    stmt = select(ParticipantProfile).where(ParticipantProfile.user_id == user_id)
    result = await db.execute(stmt)
    participant = result.scalar_one_or_none()
    
    if not participant:
        raise ValueError("User is not a participant")

    stmt = (
        select(FormDeployment)
        .join(GroupMember, GroupMember.group_id == FormDeployment.group_id)
        .where(
            and_(
                FormDeployment.form_id == form_id,
                GroupMember.participant_id == participant.participant_id
            )
        )
    )
    result = await db.execute(stmt)
    deployment = result.scalar_one_or_none()
    
    if not deployment:
        raise ValueError("Form not assigned to participant")

    stmt = (
        select(FormSubmission)
        .where(
            and_(
                FormSubmission.form_id == form_id,
                FormSubmission.participant_id == participant.participant_id
            )
        )
    )
    result = await db.execute(stmt)
    submission = result.scalar_one_or_none()

    if submission:
        if submission.submitted_at is not None:
            raise ValueError("Cannot modify a completed submission")

        from sqlalchemy import delete
        await db.execute(delete(SubmissionAnswer).where(SubmissionAnswer.submission_id == submission.submission_id))
        
    else:
        submission = FormSubmission(
            form_id=form_id,
            participant_id=participant.participant_id,
            group_id=deployment.group_id
        )
        db.add(submission)
        await db.flush()

    if is_draft:
        submission.submitted_at = None
    else:
        submission.submitted_at = datetime.now()

    for ans in answers:
        field_id = ans.get('field_id')
        value = ans.get('value')
        
        val_text = None
        val_num = None
        val_json = None
        
        if isinstance(value, (int, float)):
            val_num = value
        elif isinstance(value, (dict, list)):
            val_json = value
        else:
            val_text = str(value)

        answer_record = SubmissionAnswer(
            submission_id=submission.submission_id,
            field_id=UUID(field_id) if isinstance(field_id, str) else field_id,
            value_text=val_text,
            value_number=val_num,
            value_json=val_json
        )
        db.add(answer_record)

    await db.commit()
    return submission
