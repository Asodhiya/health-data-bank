

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.schemas.survey_schema import SurveyCreate, FormFieldCreate, FieldOptionCreate




RESEARCHER_ID = uuid.uuid4()
FORM_ID = uuid.uuid4()
FIELD_ID = uuid.uuid4()


def make_db():
    """Async mock DB session with common methods wired up."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.delete = AsyncMock()
    db.execute = AsyncMock()
    db.scalar = AsyncMock(return_value=None)
    return db


def db_result(value):
    """Build a mock execute() result whose scalar methods return `value`."""
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    r.scalar_one.return_value = value
    r.scalars.return_value.all.return_value = value if isinstance(value, list) else ([] if value is None else [value])
    return r


def make_form(status="DRAFT", created_by=None, fields=None):
    """Fake SurveyForm model object."""
    form = MagicMock()
    form.form_id = FORM_ID
    form.title = "Blood Pressure Survey"
    form.description = "Monthly BP check"
    form.status = status
    form.created_by = created_by or RESEARCHER_ID
    form.fields = fields or []
    return form


def make_field_create(field_type="text", label="How are you?", options=None):
    return FormFieldCreate(
        label=label,
        field_type=field_type,
        is_required=True,
        display_order=1,
        options=options or [],
    )


def make_survey_create(title="Blood Pressure Survey", fields=None):
    return SurveyCreate(
        title=title,
        description="Monthly BP check",
        fields=fields or [],
    )



class TestCreateSurveyForm:

    @pytest.mark.asyncio
    async def test_raises_409_on_duplicate_title(self):
        """If a form with the same title already exists for this researcher, 409 is raised."""
        from app.services.form_management_service import create_survey_form

        db = make_db()
        # execute() returns an existing form → duplicate detected
        db.execute.return_value = db_result(make_form())

        with pytest.raises(HTTPException) as exc_info:
            await create_survey_form(make_survey_create(), RESEARCHER_ID, db)

        assert exc_info.value.status_code == 409
        assert "already have a form titled" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_creates_form_with_text_field(self):
        """Happy path: form is created with a single text field, commit is called."""
        from app.services.form_management_service import create_survey_form

        db = make_db()
        created_form = make_form()
        # First execute: no duplicate found. Second execute: return created form.
        db.execute.side_effect = [db_result(None), db_result(created_form)]

        text_field = make_field_create(field_type="text", label="How are you feeling?")
        result = await create_survey_form(make_survey_create(fields=[text_field]), RESEARCHER_ID, db)

        db.commit.assert_called_once()
        assert result is created_form

    @pytest.mark.asyncio
    async def test_creates_form_with_number_field(self):
        """Number field type is handled without errors."""
        from app.services.form_management_service import create_survey_form

        db = make_db()
        created_form = make_form()
        db.execute.side_effect = [db_result(None), db_result(created_form)]

        number_field = make_field_create(field_type="number", label="Enter your weight (kg)")
        result = await create_survey_form(make_survey_create(fields=[number_field]), RESEARCHER_ID, db)

        db.commit.assert_called_once()
        assert result is created_form

    @pytest.mark.asyncio
    async def test_creates_form_with_date_field(self):
        """Date field type is handled without errors."""
        from app.services.form_management_service import create_survey_form

        db = make_db()
        created_form = make_form()
        db.execute.side_effect = [db_result(None), db_result(created_form)]

        date_field = make_field_create(field_type="date", label="Date of last checkup")
        result = await create_survey_form(make_survey_create(fields=[date_field]), RESEARCHER_ID, db)

        db.commit.assert_called_once()
        assert result is created_form

    @pytest.mark.asyncio
    async def test_creates_form_with_dropdown_field_and_options(self):
        """Dropdown field with options is handled — options are added to DB."""
        from app.services.form_management_service import create_survey_form

        db = make_db()
        created_form = make_form()
        db.execute.side_effect = [db_result(None), db_result(created_form)]

        options = [
            FieldOptionCreate(label="Never", value=1, display_order=1),
            FieldOptionCreate(label="Sometimes", value=2, display_order=2),
            FieldOptionCreate(label="Always", value=3, display_order=3),
        ]
        dropdown_field = make_field_create(field_type="dropdown", label="How often do you exercise?", options=options)
        result = await create_survey_form(make_survey_create(fields=[dropdown_field]), RESEARCHER_ID, db)

        db.commit.assert_called_once()
        # db.add should be called for: form + field + 3 options = 5 times minimum
        assert db.add.call_count >= 5
        assert result is created_form

    @pytest.mark.asyncio
    async def test_creates_form_with_no_fields(self):
        """A form with no fields is valid — creates the shell."""
        from app.services.form_management_service import create_survey_form

        db = make_db()
        created_form = make_form()
        db.execute.side_effect = [db_result(None), db_result(created_form)]

        result = await create_survey_form(make_survey_create(fields=[]), RESEARCHER_ID, db)

        db.commit.assert_called_once()
        assert result is created_form


# ---------------------------------------------------------------------------
# update_survey_form
# ---------------------------------------------------------------------------

class TestUpdateSurveyForm:

    @pytest.mark.asyncio
    async def test_raises_404_when_form_not_found(self):
        """If the form doesn't exist, 404 is raised before any update."""
        from app.services.form_management_service import update_survey_form

        db = make_db()
        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=None)):
            with pytest.raises(HTTPException) as exc_info:
                await update_survey_form(FORM_ID, make_survey_create(), RESEARCHER_ID, db)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_403_when_not_owner(self):
        """A researcher who didn't create the form cannot edit it."""
        from app.services.form_management_service import update_survey_form

        other_researcher = uuid.uuid4()
        form = make_form(created_by=other_researcher)

        db = make_db()
        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            with pytest.raises(HTTPException) as exc_info:
                await update_survey_form(FORM_ID, make_survey_create(), RESEARCHER_ID, db)

        assert exc_info.value.status_code == 403
        assert "created this form" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_raises_400_when_form_is_published(self):
        """Published forms cannot be edited — must unpublish first."""
        from app.services.form_management_service import update_survey_form

        form = make_form(status="PUBLISHED", created_by=RESEARCHER_ID)

        db = make_db()
        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            with pytest.raises(HTTPException) as exc_info:
                await update_survey_form(FORM_ID, make_survey_create(), RESEARCHER_ID, db)

        assert exc_info.value.status_code == 400
        assert "Unpublish" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_happy_path_updates_form(self):
        """Owner updates a DRAFT form — commit is called, success msg returned."""
        from app.services.form_management_service import update_survey_form

        form = make_form(status="DRAFT", created_by=RESEARCHER_ID, fields=[])
        db = make_db()
        db.execute.return_value = db_result(None)  # FieldElementMap delete result

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            result = await update_survey_form(FORM_ID, make_survey_create(), RESEARCHER_ID, db)

        db.commit.assert_called_once()
        assert result == {"msg": "form updated"}


# ---------------------------------------------------------------------------
# delete_survey_form
# ---------------------------------------------------------------------------

class TestDeleteSurveyForm:

    @pytest.mark.asyncio
    async def test_raises_404_when_form_not_found(self):
        from app.services.form_management_service import delete_survey_form

        db = make_db()
        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=None)):
            with pytest.raises(HTTPException) as exc_info:
                await delete_survey_form(FORM_ID, RESEARCHER_ID, db)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_403_when_not_owner(self):
        from app.services.form_management_service import delete_survey_form

        other_researcher = uuid.uuid4()
        form = make_form(created_by=other_researcher)

        db = make_db()
        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            with pytest.raises(HTTPException) as exc_info:
                await delete_survey_form(FORM_ID, RESEARCHER_ID, db)

        assert exc_info.value.status_code == 403
        assert "created this form" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_happy_path_deletes_form(self):
        """Owner deletes their form — db.delete and commit are called."""
        from app.services.form_management_service import delete_survey_form

        form = make_form(created_by=RESEARCHER_ID)
        db = make_db()

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            result = await delete_survey_form(FORM_ID, RESEARCHER_ID, db)

        db.delete.assert_called_once_with(form)
        db.commit.assert_called_once()
        assert result == {"msg": "form deleted"}
