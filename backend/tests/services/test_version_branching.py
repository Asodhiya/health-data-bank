"""
Tests for survey form version branching, versioned deletion, and publish-archives-old-version logic.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services import form_management_service


RESEARCHER_ID = uuid.uuid4()
OTHER_ID = uuid.uuid4()
FORM_ID = uuid.uuid4()
ROOT_ID = uuid.uuid4()
GROUP_ID = uuid.uuid4()


def make_form(
    form_id=None,
    status="PUBLISHED",
    version=1,
    parent_form_id=None,
    created_by=None,
):
    f = MagicMock()
    f.form_id = form_id or uuid.uuid4()
    f.status = status
    f.version = version
    f.parent_form_id = parent_form_id
    f.created_by = created_by or RESEARCHER_ID
    f.title = "BP Survey"
    f.description = "Monthly BP check"
    f.fields = []
    return f


def make_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.delete = AsyncMock()
    db.execute = AsyncMock()
    db.scalar = AsyncMock(return_value=None)
    db.get = AsyncMock(return_value=None)
    return db


def db_result(value):
    r = MagicMock()
    if isinstance(value, list):
        r.scalars.return_value.all.return_value = value
        r.scalars.return_value.first.return_value = value[0] if value else None
        r.scalar_one_or_none.return_value = value[0] if value else None
        r.scalar.return_value = value[0] if value else None
        r.all.return_value = [(v,) for v in value]
    else:
        r.scalars.return_value.all.return_value = [] if value is None else [value]
        r.scalars.return_value.first.return_value = None if value is None else value
        r.scalar_one_or_none.return_value = value
        r.scalar.return_value = value
        r.all.return_value = []
    return r


# ===========================================================================
# branch_survey_form
# ===========================================================================

class TestBranchSurveyForm:

    @pytest.mark.asyncio
    async def test_raises_404_when_original_not_found(self):
        db = make_db()
        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=None)):
            with pytest.raises(HTTPException) as exc:
                await form_management_service.branch_survey_form(FORM_ID, RESEARCHER_ID, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_new_branch_gets_incremented_version(self):
        """Branch from v1 produces a v2 draft."""
        original = make_form(form_id=ROOT_ID, version=1, parent_form_id=None)
        db = make_db()
        # call 1: max(version) = 1, call 2: old_fields query = []
        db.execute.side_effect = [db_result(1), db_result([])]

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=original)):
            await form_management_service.branch_survey_form(ROOT_ID, RESEARCHER_ID, db)

        created = db.add.call_args[0][0]
        assert created.version == 2
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_parent_form_id_always_points_to_root(self):
        """Branching from v2 (which has parent=root) still sets new form's parent to root."""
        root_id = uuid.uuid4()
        v2 = make_form(form_id=uuid.uuid4(), version=2, parent_form_id=root_id)
        db = make_db()
        db.execute.side_effect = [db_result(2), db_result([])]

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=v2)):
            await form_management_service.branch_survey_form(v2.form_id, RESEARCHER_ID, db)

        created = db.add.call_args[0][0]
        # parent_form_id should always be root, never v2's own form_id
        assert created.parent_form_id == root_id

    @pytest.mark.asyncio
    async def test_max_version_includes_deleted_versions(self):
        """
        If v3 was deleted, max(version) = 3 so the next branch is v4, not v3 again.
        Soft-deleted versions preserve the version sequence.
        """
        original = make_form(form_id=ROOT_ID, version=1, parent_form_id=None)
        db = make_db()
        db.execute.side_effect = [db_result(3), db_result([])]  # max=3, no fields

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=original)):
            await form_management_service.branch_survey_form(ROOT_ID, RESEARCHER_ID, db)

        created = db.add.call_args[0][0]
        assert created.version == 4

    @pytest.mark.asyncio
    async def test_new_branch_status_is_draft(self):
        """Branched form is always created as DRAFT regardless of original's status."""
        original = make_form(form_id=ROOT_ID, version=1, status="PUBLISHED")
        db = make_db()
        db.execute.side_effect = [db_result(1), db_result([])]

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=original)):
            await form_management_service.branch_survey_form(ROOT_ID, RESEARCHER_ID, db)

        created = db.add.call_args[0][0]
        assert created.status == "DRAFT"


# ===========================================================================
# delete_survey_form — versioned soft-delete logic
# ===========================================================================

class TestDeleteSurveyFormVersioned:

    @pytest.mark.asyncio
    async def test_draft_branch_is_hard_deleted(self):
        """A DRAFT form (even with a parent) is always hard-deleted — it was never published."""
        form = make_form(form_id=FORM_ID, parent_form_id=ROOT_ID, status="DRAFT")
        db = make_db()
        db.execute = AsyncMock(return_value=db_result(None))  # no previous version found

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            result = await form_management_service.delete_survey_form(FORM_ID, RESEARCHER_ID, db)

        db.delete.assert_called_once_with(form)
        db.commit.assert_awaited_once()
        assert result == {"msg": "form deleted"}

    @pytest.mark.asyncio
    async def test_archived_root_form_with_children_is_soft_deleted(self):
        """An ARCHIVED root form that has child versions must soft-delete to preserve version history."""
        form = make_form(form_id=FORM_ID, parent_form_id=None, status="ARCHIVED")
        db = make_db()
        # scalar for children check returns a child id (has children)
        db.scalar.side_effect = [uuid.uuid4(), None]

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            result = await form_management_service.delete_survey_form(FORM_ID, RESEARCHER_ID, db)

        assert form.status == "DELETED"
        db.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_standalone_draft_with_no_submissions_is_hard_deleted(self):
        """A standalone DRAFT with no parent or children is fully removed."""
        form = make_form(form_id=FORM_ID, parent_form_id=None, status="DRAFT")
        db = make_db()

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            result = await form_management_service.delete_survey_form(FORM_ID, RESEARCHER_ID, db)

        db.delete.assert_called_once_with(form)
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_archived_form_with_submissions_is_soft_deleted(self):
        """An ARCHIVED form with completed submissions must soft-delete to preserve response data."""
        form = make_form(form_id=FORM_ID, parent_form_id=None, status="ARCHIVED")
        db = make_db()
        # First scalar: no children. Second: has a submission.
        db.scalar.side_effect = [None, uuid.uuid4()]

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            await form_management_service.delete_survey_form(FORM_ID, RESEARCHER_ID, db)

        assert form.status == "DELETED"
        db.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_raises_403_for_non_owner(self):
        form = make_form(form_id=FORM_ID, created_by=OTHER_ID)
        db = make_db()

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            with pytest.raises(HTTPException) as exc:
                await form_management_service.delete_survey_form(FORM_ID, RESEARCHER_ID, db)

        assert exc.value.status_code == 403


# ===========================================================================
# delete_form_family
# ===========================================================================

class TestDeleteFormFamily:

    @pytest.mark.asyncio
    async def test_soft_deletes_all_family_members(self):
        """Every form in the family is soft-deleted regardless of status."""
        root = make_form(form_id=ROOT_ID, parent_form_id=None, version=1, status="PUBLISHED")
        v2 = make_form(parent_form_id=ROOT_ID, version=2, status="DRAFT")
        v3 = make_form(parent_form_id=ROOT_ID, version=3, status="ARCHIVED")
        db = make_db()

        family_result = MagicMock()
        family_result.scalars.return_value.all.return_value = [root, v2, v3]
        db.execute.return_value = family_result

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=root)):
            result = await form_management_service.delete_form_family(ROOT_ID, RESEARCHER_ID, db)

        assert root.status == "DELETED"
        assert v2.status == "DELETED"
        assert v3.status == "DELETED"
        db.delete.assert_not_called()  # always soft-delete
        db.commit.assert_awaited_once()
        assert "3" in result["msg"]

    @pytest.mark.asyncio
    async def test_raises_403_for_non_owner(self):
        root = make_form(form_id=ROOT_ID, created_by=OTHER_ID)
        db = make_db()

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=root)):
            with pytest.raises(HTTPException) as exc:
                await form_management_service.delete_form_family(ROOT_ID, RESEARCHER_ID, db)

        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_raises_404_when_not_found(self):
        db = make_db()
        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=None)):
            with pytest.raises(HTTPException) as exc:
                await form_management_service.delete_form_family(ROOT_ID, RESEARCHER_ID, db)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_uses_root_id_even_when_called_on_child(self):
        """Calling delete_family on v2 should still delete the whole family via root."""
        v2 = make_form(form_id=uuid.uuid4(), parent_form_id=ROOT_ID, version=2)
        root = make_form(form_id=ROOT_ID, parent_form_id=None, version=1)
        db = make_db()

        family_result = MagicMock()
        family_result.scalars.return_value.all.return_value = [root, v2]
        db.execute.return_value = family_result

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=v2)):
            result = await form_management_service.delete_form_family(v2.form_id, RESEARCHER_ID, db)

        assert root.status == "DELETED"
        assert v2.status == "DELETED"


# ===========================================================================
# publish_survey_form — old version gets ARCHIVED (not DRAFT)
# ===========================================================================

class TestPublishArchivesOldVersion:

    @pytest.mark.asyncio
    async def test_publishing_new_version_archives_old_version_in_same_group(self):
        """
        When v2 is published to group A, the old v1 deployment in group A is removed
        and v1's status is set to ARCHIVED (not DRAFT).
        """
        v2 = make_form(form_id=FORM_ID, parent_form_id=ROOT_ID, version=2, status="DRAFT")
        v1 = make_form(form_id=ROOT_ID, version=1, status="PUBLISHED")

        old_dep = MagicMock()
        old_dep.form_id = ROOT_ID
        old_dep.deployment_id = uuid.uuid4()

        group = MagicMock()
        group.group_id = GROUP_ID

        db = make_db()
        db.get = AsyncMock(return_value=v1)

        execute_calls = [
            db_result(group),           # group lookup
            db_result(None),            # no existing deployment for v2
            db_result([ROOT_ID]),       # sibling ids (v1)
            db_result([old_dep]),       # old deployments in group
            db_result(None),            # no remaining deployments for v1 after removal
            db_result([]),              # participant user rows for notifications
        ]
        db.execute.side_effect = execute_calls

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=v2)):
            with patch("app.services.form_management_service.create_notifications_bulk", AsyncMock()):
                await form_management_service.publish_survey_form(FORM_ID, GROUP_ID, RESEARCHER_ID, db)

        db.delete.assert_any_call(old_dep)
        assert v1.status == "ARCHIVED"
        assert v2.status == "PUBLISHED"

    @pytest.mark.asyncio
    async def test_publishing_to_new_group_does_not_touch_other_group_deployments(self):
        """
        Publishing v2 to group B should not remove v1's deployment in group A.
        Old sibling deployments are only removed for the target group.
        """
        group_a = uuid.uuid4()
        group_b = uuid.uuid4()
        v2 = make_form(form_id=FORM_ID, parent_form_id=ROOT_ID, version=2, status="DRAFT")
        group = MagicMock()
        group.group_id = group_b

        db = make_db()

        execute_calls = [
            db_result(group),       # group lookup
            db_result(None),        # no existing deployment for v2 in group_b
            db_result([ROOT_ID]),   # sibling ids
            db_result([]),          # no old deployments for sibling in group_b
            db_result([]),          # participant rows
        ]
        db.execute.side_effect = execute_calls

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=v2)):
            with patch("app.services.form_management_service.create_notifications_bulk", AsyncMock()):
                await form_management_service.publish_survey_form(FORM_ID, group_b, RESEARCHER_ID, db)

        db.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_raises_409_if_already_deployed_to_group(self):
        """Cannot publish the same form to the same group twice."""
        form = make_form(form_id=FORM_ID, status="DRAFT")
        existing_dep = MagicMock()
        group = MagicMock()
        db = make_db()

        db.execute.side_effect = [
            db_result(group),         # group lookup
            db_result(existing_dep),  # existing deployment found
        ]

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            with pytest.raises(HTTPException) as exc:
                await form_management_service.publish_survey_form(FORM_ID, GROUP_ID, RESEARCHER_ID, db)

        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_raises_403_for_non_owner(self):
        form = make_form(form_id=FORM_ID, created_by=OTHER_ID)
        db = make_db()

        with patch("app.services.form_management_service.get_form_by_id", AsyncMock(return_value=form)):
            with pytest.raises(HTTPException) as exc:
                await form_management_service.publish_survey_form(FORM_ID, GROUP_ID, RESEARCHER_ID, db)

        assert exc.value.status_code == 403
