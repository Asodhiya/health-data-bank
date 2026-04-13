import asyncio
from pathlib import Path

from sqlalchemy import select, text

from app.core import permissions as permission_constants
from app.core.config import settings
from app.db.base import Base
from app.db.db import engine
from app.db.models import Permission, Role, RolePermission
from app.db.session import AsyncSessionLocal
from app.seeds.data_element_seed import seed_profile_data_elements
from app.seeds.onboarding_seed import seed_onboarding_data

import app.db.models  # noqa: F401


ROLE_PERMISSION_MAP = {
    "admin": None,  # None means all permissions
    "researcher": {
        permission_constants.FORM_VIEW,
        permission_constants.FORM_CREATE,
        permission_constants.FORM_GET,
        permission_constants.FORM_UPDATE,
        permission_constants.FORM_DELETE,
        permission_constants.FORM_PUBLISH,
        permission_constants.FORM_UNPUBLISH,
        permission_constants.GOAL_TEMPLATE_VIEW,
        permission_constants.GOAL_TEMPLATE_CREATE,
        permission_constants.GOAL_TEMPLATE_EDIT,
        permission_constants.ELEMENT_VIEW,
        permission_constants.ELEMENT_CREATE,
        permission_constants.ELEMENT_DELETE,
        permission_constants.ELEMENT_MAP,
        permission_constants.STATS_VIEW,
    },
    "caretaker": {
        permission_constants.CARETAKER_READ,
        permission_constants.GROUP_READ,
        permission_constants.STATS_VIEW,
    },
    "participant": {
        permission_constants.GOAL_VIEW_ALL,
        permission_constants.GOAL_ADD,
        permission_constants.GOAL_EDIT,
        permission_constants.GOAL_DELETE,
        permission_constants.SURVEY_LIST_ASSIGNED,
        permission_constants.SURVEY_READ,
        permission_constants.SURVEY_SUBMIT,
        permission_constants.STATS_VIEW,
        permission_constants.ONBOARDING_READ,
        permission_constants.ONBOARDING_SUBMIT,
    },
}


def _all_permission_codes() -> list[str]:
    return sorted(
        value
        for name, value in vars(permission_constants).items()
        if name.isupper() and isinstance(value, str)
    )


def _latest_revision() -> str:
    versions_dir = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    revisions = []
    for path in versions_dir.glob("*.py"):
        if path.name.startswith("__"):
            continue
        revisions.append(path.stem.split("_", 1)[0])
    if not revisions:
        raise RuntimeError("No Alembic revisions found.")
    return sorted(revisions)[-1]


async def _create_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS alembic_version (
                    version_num VARCHAR(32) NOT NULL PRIMARY KEY
                )
                """
            )
        )


async def _seed_roles_and_permissions() -> None:
    permission_codes = _all_permission_codes()
    async with AsyncSessionLocal() as db:
        existing_permissions = {
            permission.code: permission
            for permission in (
                await db.execute(select(Permission))
            ).scalars().all()
        }

        for code in permission_codes:
            if code not in existing_permissions:
                permission = Permission(code=code, description=code)
                db.add(permission)
                await db.flush()
                existing_permissions[code] = permission

        existing_roles = {
            role.role_name.lower(): role
            for role in (await db.execute(select(Role))).scalars().all()
        }

        for role_name in ROLE_PERMISSION_MAP:
            if role_name not in existing_roles:
                role = Role(role_name=role_name)
                db.add(role)
                await db.flush()
                existing_roles[role_name] = role

        for role_name, allowed_codes in ROLE_PERMISSION_MAP.items():
            role = existing_roles[role_name]
            role_permission_rows = (
                await db.execute(
                    select(RolePermission.permission_id).where(RolePermission.role_id == role.role_id)
                )
            ).scalars().all()
            existing_ids = set(role_permission_rows)

            target_codes = permission_codes if allowed_codes is None else sorted(allowed_codes)
            for code in target_codes:
                permission = existing_permissions[code]
                if permission.permission_id not in existing_ids:
                    db.add(RolePermission(role_id=role.role_id, permission_id=permission.permission_id))

        await db.commit()

        await seed_onboarding_data(db)
        await seed_profile_data_elements(db)


async def _stamp_head() -> None:
    revision = _latest_revision()
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
            {"revision": revision},
        )


async def main() -> None:
    if not settings.DEBUG:
        raise SystemExit("bootstrap_local_db.py only runs in DEBUG mode.")

    await _create_schema()
    await _seed_roles_and_permissions()
    await _stamp_head()
    print("Local database schema created, seeded, and stamped to Alembic head.")


if __name__ == "__main__":
    asyncio.run(main())
