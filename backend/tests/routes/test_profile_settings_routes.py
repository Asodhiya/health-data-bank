import sys
import types
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.caretaker_response_schema import CaretakerProfileUpdate
from app.schemas.filter_data_schema import ParticipantProfileUpdate
from app.schemas.researcher_schema import ResearcherProfileUpdate
from app.schemas.admin_schema import AdminProfileUpdate


def _load_route_module(filename: str, module_name: str):
    path = Path(__file__).resolve().parents[2] / "app" / "api" / "routes" / filename
    spec = spec_from_file_location(module_name, path)
    module = module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def _install_fake_multipart():
    multipart_module = types.ModuleType("multipart")
    multipart_module.__version__ = "0.0-test"
    multipart_submodule = types.ModuleType("multipart.multipart")
    multipart_submodule.parse_options_header = lambda value: ("form-data", {})
    sys.modules.setdefault("multipart", multipart_module)
    sys.modules.setdefault("multipart.multipart", multipart_submodule)


_install_fake_multipart()
caretaker_routes = _load_route_module("Caretakers.py", "test_caretaker_routes")
participant_routes = _load_route_module("participants_only.py", "test_participant_routes")
researcher_routes = _load_route_module("researcher.py", "test_researcher_routes")
admin_routes = _load_route_module("admin_only.py", "test_admin_routes")


@pytest.mark.anyio
async def test_participant_profile_update_saves_profile_fields_and_address():
    user = SimpleNamespace(user_id=uuid4(), Address="Old Address")
    profile = SimpleNamespace(
        dob=None,
        gender=None,
        pronouns=None,
        primary_language=None,
        country_of_origin=None,
        occupation_status=None,
        living_arrangement=None,
        highest_education_level=None,
        dependents=None,
        marital_status=None,
        program_enrolled_at=None,
    )
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=profile)
    db.refresh = AsyncMock()

    payload = ParticipantProfileUpdate(
        dob="2000-01-02",
        gender="Female",
        pronouns="She/Her",
        primary_language="English",
        country_of_origin="Canada",
        occupation_status="Student",
        living_arrangement="With Family",
        highest_education_level="Undergraduate",
        dependents=2,
        marital_status="Single",
        address="New Address",
    )

    result = await participant_routes.update_participant_profile(payload, db=db, current_user=user)

    assert str(profile.dob) == "2000-01-02"
    assert profile.gender == "Female"
    assert profile.pronouns == "She/Her"
    assert profile.primary_language == "English"
    assert profile.country_of_origin == "Canada"
    assert profile.occupation_status == "Student"
    assert profile.living_arrangement == "With Family"
    assert profile.highest_education_level == "Undergraduate"
    assert profile.dependents == 2
    assert profile.marital_status == "Single"
    assert user.Address == "New Address"
    assert result["address"] == "New Address"
    db.commit.assert_awaited_once()
    assert db.refresh.await_count == 2


@pytest.mark.anyio
async def test_caretaker_profile_update_saves_all_editable_fields():
    user = SimpleNamespace(user_id=uuid4())
    profile = SimpleNamespace(
        title=None,
        credentials=None,
        organization=None,
        department=None,
        specialty=None,
        bio=None,
        working_hours_start=None,
        working_hours_end=None,
        contact_preference=None,
        available_days=None,
        onboarding_completed=False,
    )
    result_proxy = MagicMock()
    result_proxy.scalar_one_or_none.return_value = profile

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_proxy)
    db.refresh = AsyncMock()

    payload = CaretakerProfileUpdate(
        title="Dr.",
        credentials="RN",
        organization="Health Bank",
        department="Wellness",
        specialty="Coaching",
        bio="Helping participants stay on track.",
        working_hours_start="09:00",
        working_hours_end="17:00",
        contact_preference="email",
        available_days=["Mon", "Tue"],
    )

    result = await caretaker_routes.update_caretaker_profile(payload, db=db, current_user=user)

    assert result.title == "Dr."
    assert result.credentials == "RN"
    assert result.organization == "Health Bank"
    assert result.department == "Wellness"
    assert result.specialty == "Coaching"
    assert result.bio == "Helping participants stay on track."
    assert result.working_hours_start == "09:00"
    assert result.working_hours_end == "17:00"
    assert result.contact_preference == "email"
    assert result.available_days == ["Mon", "Tue"]
    assert result.onboarding_completed is True
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_researcher_profile_update_saves_all_editable_fields():
    user = SimpleNamespace(user_id=uuid4())
    profile = SimpleNamespace(
        title=None,
        credentials=None,
        organization=None,
        department=None,
        specialty=None,
        bio=None,
        onboarding_completed=False,
    )
    result_proxy = MagicMock()
    result_proxy.scalar_one_or_none.return_value = profile

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_proxy)
    db.refresh = AsyncMock()

    payload = ResearcherProfileUpdate(
        title="Dr.",
        credentials="PhD",
        organization="UPEI",
        department="Health Sciences",
        specialty="Population Health",
        bio="Researching outcomes.",
    )

    result = await researcher_routes.update_researcher_profile(payload, db=db, current_user=user)

    assert result.title == "Dr."
    assert result.credentials == "PhD"
    assert result.organization == "UPEI"
    assert result.department == "Health Sciences"
    assert result.specialty == "Population Health"
    assert result.bio == "Researching outcomes."
    assert result.onboarding_completed is True
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_admin_profile_update_saves_all_editable_fields():
    user = SimpleNamespace(user_id=uuid4())
    profile = SimpleNamespace(
        title=None,
        role_title=None,
        department=None,
        organization=None,
        bio=None,
        contact_preference=None,
        onboarding_completed=False,
    )
    result_proxy = MagicMock()
    result_proxy.scalar_one_or_none.return_value = profile

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_proxy)
    db.refresh = AsyncMock()

    payload = AdminProfileUpdate(
        title="Ms.",
        role_title="Platform Admin",
        department="Operations",
        organization="Health Data Bank",
        bio="Platform administrator.",
        contact_preference="email",
    )

    result = await admin_routes.update_admin_profile(payload, user=user, db=db)

    assert result.title == "Ms."
    assert result.role_title == "Platform Admin"
    assert result.department == "Operations"
    assert result.organization == "Health Data Bank"
    assert result.bio == "Platform administrator."
    assert result.contact_preference == "email"
    assert result.onboarding_completed is True
    db.commit.assert_awaited_once()
