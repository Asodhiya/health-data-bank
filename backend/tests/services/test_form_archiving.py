import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.services import form_management_service


RESEARCHER_ID = uuid.uuid4()
OTHER_RESEARCHER_ID = uuid.uuid4()


def make_form(status="DRAFT", created_by=RESEARCHER_ID):
    form = type("Form", (), {})()
    form.form_id = uuid.uuid4()
    form.status = status
    form.created_by = created_by
    return form


@pytest.mark.asyncio
async def test_archive_survey_form_marks_draft_as_archived():
    form = make_form("DRAFT")
    db = AsyncMock()

    with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
        result = await form_management_service.archive_survey_form(form.form_id, RESEARCHER_ID, db)

    assert result == {"msg": "Form archived."}
    assert form.status == "ARCHIVED"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_archive_survey_form_rejects_published():
    form = make_form("PUBLISHED")
    db = AsyncMock()

    with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
        with pytest.raises(HTTPException, match="Unpublish the form first"):
            await form_management_service.archive_survey_form(form.form_id, RESEARCHER_ID, db)


@pytest.mark.asyncio
async def test_unarchive_survey_form_restores_draft():
    form = make_form("ARCHIVED")
    db = AsyncMock()

    with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
        result = await form_management_service.unarchive_survey_form(form.form_id, RESEARCHER_ID, db)

    assert result == {"msg": "Form restored to draft."}
    assert form.status == "DRAFT"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_unarchive_survey_form_rejects_non_archived():
    form = make_form("DRAFT")
    db = AsyncMock()

    with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
        with pytest.raises(HTTPException, match="Only archived forms can be restored to draft."):
            await form_management_service.unarchive_survey_form(form.form_id, RESEARCHER_ID, db)


@pytest.mark.asyncio
async def test_archive_survey_form_rejects_non_owner():
    form = make_form("DRAFT", created_by=OTHER_RESEARCHER_ID)
    db = AsyncMock()

    with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
        with pytest.raises(HTTPException, match="created this form"):
            await form_management_service.archive_survey_form(form.form_id, RESEARCHER_ID, db)


@pytest.mark.asyncio
async def test_unarchive_survey_form_rejects_non_owner():
    form = make_form("ARCHIVED", created_by=OTHER_RESEARCHER_ID)
    db = AsyncMock()

    with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
        with pytest.raises(HTTPException, match="created this form"):
            await form_management_service.unarchive_survey_form(form.form_id, RESEARCHER_ID, db)
