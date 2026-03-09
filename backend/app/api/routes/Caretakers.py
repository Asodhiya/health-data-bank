from fastapi import APIRouter, HTTPException, status,Response,Depends,BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from app.db.session import get_db
from app.core.dependency import require_permissions

router = APIRouter()

# 1) Dashboard
@router.get("/dashboard", response_model=CaretakerDashboardResponse)
async def caretaker_dashboard(user: CurrentUser = Depends(require_caretaker)):
    # TODO: compute real values from DB
    pass


# 2) Assigned Participants
@router.get("/participants", response_model=list[ParticipantListItem])
async def list_assigned_participants(
    q: Optional[str] = Query(default=None, description="Search by name/email/id"),
    status: Optional[Literal["active", "inactive"]] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: query DB for participants assigned to caretaker (and filters)
    pass


@router.get("/participants/{participant_id}", response_model=ParticipantDetail)
async def get_participant(
    participant_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: fetch participant profile
    pass


@router.get("/participants/{participant_id}/summary", response_model=ParticipantSummary)
async def participant_summary(
    participant_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_participant(user.user_id, participant_id)
    # TODO: compute summary (latest metrics, goal progress, flags)
    pass


@router.get("/participants/{participant_id}/health-trends", response_model=HealthTrendsResponse)
async def participant_health_trends(
    participant_id: int,
    metric: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_participant(user.user_id, participant_id)
    # TODO: fetch timeseries points grouped by metric
    pass


@router.get("/participants/{participant_id}/goals", response_model=list[GoalItem])
async def participant_goals(
    participant_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_participant(user.user_id, participant_id)
    # TODO: fetch participant goals
    pass


# 3) Submissions (Read-only)
@router.get("/submissions", response_model=list[SubmissionListItem])
async def list_submissions(
    participant_id: Optional[int] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    form_id: Optional[int] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: query submissions only for participants assigned to caretaker
    # If participant_id provided -> also validate access
    if participant_id is not None:
        await assert_can_access_participant(user.user_id, participant_id)
    pass


@router.get("/submissions/{submission_id}", response_model=SubmissionDetail)
async def get_submission(
    submission_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_submission(user.user_id, submission_id)
    # TODO: fetch submission + answers
    pass


@router.get("/submissions/{submission_id}/answers", response_model=dict[str, Any])
async def get_submission_answers(
    submission_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_submission(user.user_id, submission_id)
    # TODO: fetch answers only
    pass


# 4) Reports
@router.post("/reports/participant", response_model=ReportResponse)
async def generate_participant_report(
    participant_id: int = Query(...),
    body: ReportGenerateRequest = ...,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_participant(user.user_id, participant_id)
    # TODO: generate and store report, return report_id + payload/metadata
    pass


@router.post("/reports/group", response_model=ReportResponse)
async def generate_group_report(
    group_id: int = Query(...),
    body: ReportGenerateRequest = ...,
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: validate caretaker can access this group
    pass


@router.post("/reports/comparison", response_model=ReportResponse)
async def generate_comparison_report(
    participant_id: int = Query(...),
    compare_with: Literal["group_aggregate", "selected_participants"] = Query(...),
    participant_ids: Optional[list[int]] = Query(default=None),
    body: ReportGenerateRequest = ...,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_participant(user.user_id, participant_id)
    # TODO: validate access to participant_ids if provided
    # TODO: generate comparison payload
    pass


@router.get("/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: validate report belongs to caretaker scope
    pass


# 5) Notes / Feedback
@router.post("/participants/{participant_id}/notes", response_model=NoteItem)
async def create_note(
    participant_id: int,
    body: NoteCreateRequest,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_participant(user.user_id, participant_id)
    # TODO: store caretaker note
    pass


@router.get("/participants/{participant_id}/notes", response_model=list[NoteItem])
async def list_notes(
    participant_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_participant(user.user_id, participant_id)
    # TODO: fetch notes
    pass


@router.patch("/notes/{note_id}", response_model=NoteItem)
async def update_note(
    note_id: int,
    body: NoteUpdateRequest,
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: validate note belongs to caretaker scope
    pass


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: validate note belongs to caretaker scope, then delete
    pass


# 6) Groups
@router.get("/groups", response_model=list[GroupItem])
async def list_groups(user: CurrentUser = Depends(require_caretaker)):
    # TODO: fetch groups managed/assigned to caretaker
    pass


@router.get("/groups/{group_id}", response_model=GroupItem)
async def get_group(group_id: int, user: CurrentUser = Depends(require_caretaker)):
    # TODO: validate access and return group
    pass


@router.post("/groups", response_model=GroupItem)
async def create_group(body: GroupCreateRequest, user: CurrentUser = Depends(require_caretaker)):
    # TODO: create group under caretaker
    pass


@router.patch("/groups/{group_id}", response_model=GroupItem)
async def update_group(group_id: int, body: GroupUpdateRequest, user: CurrentUser = Depends(require_caretaker)):
    # TODO: validate access and update group
    pass


@router.delete("/groups/{group_id}")
async def delete_group(group_id: int, user: CurrentUser = Depends(require_caretaker)):
    # TODO: validate access and delete group
    pass


@router.post("/groups/{group_id}/members")
async def add_group_member(
    group_id: int,
    body: GroupMemberAddRequest,
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: validate access and add participant to group
    pass


@router.delete("/groups/{group_id}/members/{participant_id}")
async def remove_group_member(
    group_id: int,
    participant_id: int,
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: validate access and remove participant from group
    pass


# 7) Goal Suggestions (optional)
@router.post("/participants/{participant_id}/goal-suggestions")
async def create_goal_suggestions(
    participant_id: int,
    body: GoalSuggestionRequest,
    user: CurrentUser = Depends(require_caretaker),
):
    await assert_can_access_participant(user.user_id, participant_id)
    # TODO: generate suggested goals based on forms/submissions (store in SUGGESTED_GOALS)
    pass


# 8) Notifications
@router.get("/notifications", response_model=list[NotificationItem])
async def list_notifications(user: CurrentUser = Depends(require_caretaker)):
    # TODO: fetch caretaker notifications
    pass


@router.patch("/notifications/{notification_id}", response_model=NotificationItem)
async def mark_notification(
    notification_id: int,
    body: NotificationReadRequest,
    user: CurrentUser = Depends(require_caretaker),
):
    # TODO: update read status
    pass