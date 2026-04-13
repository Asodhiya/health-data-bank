"""
Production database setup script.
Run this ONCE on a fresh database to create all tables, seed roles/permissions,
and stamp Alembic to head.

For subsequent deployments, use: alembic upgrade head
"""
import asyncio
from pathlib import Path

from sqlalchemy import select, text

from app.core import permissions as permission_constants
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


async def _is_fresh_db() -> bool:
    async with engine.connect() as conn:
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version')"
        ))
        return not result.scalar()


async def _create_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"
        ))


async def _seed_roles_and_permissions() -> None:
    permission_codes = _all_permission_codes()
    async with AsyncSessionLocal() as db:
        existing_permissions = {
            p.code: p
            for p in (await db.execute(select(Permission))).scalars().all()
        }
        for code in permission_codes:
            if code not in existing_permissions:
                perm = Permission(code=code, description=code)
                db.add(perm)
                await db.flush()
                existing_permissions[code] = perm

        existing_roles = {
            r.role_name.lower(): r
            for r in (await db.execute(select(Role))).scalars().all()
        }
        for role_name in ROLE_PERMISSION_MAP:
            if role_name not in existing_roles:
                role = Role(role_name=role_name)
                db.add(role)
                await db.flush()
                existing_roles[role_name] = role

        for role_name, allowed_codes in ROLE_PERMISSION_MAP.items():
            role = existing_roles[role_name]
            existing_ids = set(
                (await db.execute(
                    select(RolePermission.permission_id).where(RolePermission.role_id == role.role_id)
                )).scalars().all()
            )
            target_codes = permission_codes if allowed_codes is None else sorted(allowed_codes)
            for code in target_codes:
                perm = existing_permissions[code]
                if perm.permission_id not in existing_ids:
                    db.add(RolePermission(role_id=role.role_id, permission_id=perm.permission_id))

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
    fresh = await _is_fresh_db()
    if not fresh:
        print("Database already initialized. Run 'alembic upgrade head' for new migrations.")
        return

    print("Fresh database detected — creating schema...")
    await _create_schema()
    print("Seeding roles and permissions...")
    await _seed_roles_and_permissions()
    await _stamp_head()
    print("Done. Database is ready.")


if __name__ == "__main__":
    asyncio.run(main())
