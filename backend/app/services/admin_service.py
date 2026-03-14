# ── Admin service functions made by Job (SPRINT 6) ──────────────────────────

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from uuid import UUID

from app.db.models import CaretakerProfile, FormDeployment, FormSubmission, Group, User, GroupMember
from app.schemas.admin_schema import (
    AssignCaretakerRequest,
    AssignCaretakerResponse,
    UnassignCaretakerResponse,
    CaretakerItem,
    DeleteGroupResponse,
)
from app.schemas.caretaker_response_schema import GroupCreateRequest, GroupItem
from typing import List


async def list_groups(db: AsyncSession) -> List[GroupItem]:
    """Return all groups with their assigned caretaker_id."""
    result = await db.execute(select(Group))
    groups = result.scalars().all()
    return [
        GroupItem(
            group_id=g.group_id,
            name=g.name,
            description=g.description,
            caretaker_id=g.caretaker_id,
        )
        for g in groups
    ]


async def list_caretakers(db: AsyncSession) -> List[CaretakerItem]:
    """Return all users who have a caretaker profile."""
    result = await db.execute(
        select(CaretakerProfile, User.first_name, User.last_name, User.email)
        .join(User, User.user_id == CaretakerProfile.user_id)
    )
    rows = result.all()
    return [
        CaretakerItem(
            caretaker_id=profile.caretaker_id,
            user_id=profile.user_id,
            name=f"{first_name or ''} {last_name or ''}".strip() or "Unknown",
            email=email,
            title=profile.title,
            organization=profile.organization,
        )
        for profile, first_name, last_name, email in rows
    ]


async def assign_caretaker_to_group(
    payload: AssignCaretakerRequest,
    db: AsyncSession,
) -> AssignCaretakerResponse:
    """Assign a caretaker to a group. Raises error if Group already has a caretaker."""

    caretaker = await db.scalar(
        select(CaretakerProfile).where(CaretakerProfile.user_id == payload.user_id)
    )
    if not caretaker:
        raise HTTPException(status_code=404, detail="No caretaker profile found for this user")

    group = await db.scalar(
        select(Group).where(Group.group_id == payload.group_id)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.caretaker_id is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Group '{group.name}' already has a caretaker assigned. Unassign them first.",
        )

    group.caretaker_id = caretaker.caretaker_id
    await db.commit()
    await db.refresh(group)

    return AssignCaretakerResponse(
        group_id=group.group_id,
        caretaker_id=caretaker.caretaker_id,
        message=f"Caretaker successfully assigned to group '{group.name}'",
    )


async def create_group(
    payload: GroupCreateRequest,
    created_by: UUID,
    db: AsyncSession,
) -> GroupItem:
    """Create a new group. Raises 409 if a group with the same name already exists."""

    existing = await db.scalar(
        select(Group).where(func.lower(Group.name) == payload.name.lower())
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A group named '{payload.name}' already exists.",
        )

    new_group = Group(
        name=payload.name,
        description=payload.description,
        created_by=created_by,
    )
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)

    return GroupItem(
        group_id=new_group.group_id,
        name=new_group.name,
        description=new_group.description,
    )


async def delete_group(
    group_id: UUID,
    db: AsyncSession,
) -> DeleteGroupResponse:
    """Delete a group. Members lose their group assignment (cascade). Returns list of ungrouped participants."""

    group = await db.scalar(
        select(Group).where(Group.group_id == group_id)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group_name = group.name

    members_result = await db.execute(
        select(GroupMember.participant_id).where(GroupMember.group_id == group_id)
    )
    ungrouped = [str(row[0]) for row in members_result.all()]

    await db.execute(
        update(FormDeployment).where(FormDeployment.group_id == group_id).values(group_id=None)
    )
    await db.execute(
        update(FormSubmission).where(FormSubmission.group_id == group_id).values(group_id=None)
    )

    await db.delete(group)
    await db.commit()

    return DeleteGroupResponse(
        group_id=group_id,
        message=f"Group '{group_name}' has been deleted.",
        ungrouped_participants=ungrouped,
    )


async def unassign_caretaker_from_group(
    group_id: UUID,
    db: AsyncSession,
) -> UnassignCaretakerResponse:
    """Remove the caretaker from a group."""

    group = await db.scalar(
        select(Group).where(Group.group_id == group_id)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.caretaker_id is None:
        raise HTTPException(status_code=400, detail="Group has no caretaker assigned")

    group.caretaker_id = None
    await db.commit()

    return UnassignCaretakerResponse(
        group_id=group_id,
        message=f"Caretaker removed from group '{group.name}'",
    )
