"""
Seed roles, permissions, and role-permission links.
Runs at startup — skips any row that already exists.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import Role, Permission, RolePermission
from app.core import permissions as P

# ── Role → permission mapping ────────────────────────────────────────────────
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": [
        P.BACKUP_CREATE,
        P.CARETAKER_ASSIGN, P.CARETAKER_READ, P.CARETAKER_WRITE,
        P.ELEMENT_CREATE, P.ELEMENT_DELETE, P.ELEMENT_MAP, P.ELEMENT_VIEW,
        P.FORM_CREATE, P.FORM_DELETE, P.FORM_GET, P.FORM_PUBLISH,
        P.FORM_UNPUBLISH, P.FORM_UPDATE, P.FORM_VIEW,
        P.GOAL_ADD, P.GOAL_DELETE, P.GOAL_VIEW_ALL, P.GOAL_EDIT,
        P.GOAL_TEMPLATE_CREATE, P.GOAL_TEMPLATE_EDIT, P.GOAL_TEMPLATE_VIEW,
        P.GROUP_DELETE, P.GROUP_READ, P.GROUP_WRITE,
        P.ONBOARDING_EDIT, P.ONBOARDING_READ, P.ONBOARDING_SUBMIT,
        P.ROLE_READ_ALL, P.SEND_INVITE, P.STATS_VIEW,
        P.SURVEY_LIST_ASSIGNED, P.SURVEY_READ, P.SURVEY_SUBMIT,
        P.USER_DELETE, P.USER_READ, P.USER_WRITE,
    ],
    "caretaker": [
        P.CARETAKER_READ, P.CARETAKER_WRITE,
        P.GOAL_VIEW_ALL,
        P.GROUP_READ,
        P.SEND_INVITE,
        P.STATS_VIEW,
    ],
    "participant": [
        P.GOAL_ADD, P.GOAL_DELETE, P.GOAL_VIEW_ALL, P.GOAL_EDIT,
        P.ONBOARDING_READ, P.ONBOARDING_SUBMIT,
        P.STATS_VIEW,
        P.SURVEY_LIST_ASSIGNED, P.SURVEY_READ, P.SURVEY_SUBMIT,
    ],
    "researcher": [
        P.ELEMENT_CREATE, P.ELEMENT_DELETE, P.ELEMENT_MAP, P.ELEMENT_VIEW,
        P.FORM_CREATE, P.FORM_DELETE, P.FORM_GET, P.FORM_PUBLISH,
        P.FORM_UNPUBLISH, P.FORM_UPDATE, P.FORM_VIEW,
        P.GOAL_TEMPLATE_CREATE, P.GOAL_TEMPLATE_EDIT, P.GOAL_TEMPLATE_VIEW,
        P.STATS_VIEW,
    ],
}


async def seed_rbac(db: AsyncSession) -> None:
    """Create roles, permissions, and link them. Idempotent."""

    # 1) Collect every unique permission code
    all_codes = {code for codes in ROLE_PERMISSIONS.values() for code in codes}

    # 2) Ensure all Permission rows exist
    existing_perms_result = await db.execute(select(Permission))
    existing_perms = {p.code: p for p in existing_perms_result.scalars().all()}

    for code in all_codes:
        if code not in existing_perms:
            perm = Permission(code=code)
            db.add(perm)
            existing_perms[code] = perm

    await db.flush()  # assign IDs before linking

    # 3) Ensure all Role rows exist
    existing_roles_result = await db.execute(select(Role))
    existing_roles = {r.role_name: r for r in existing_roles_result.scalars().all()}

    for role_name in ROLE_PERMISSIONS:
        if role_name not in existing_roles:
            role = Role(role_name=role_name)
            db.add(role)
            existing_roles[role_name] = role

    await db.flush()

    # 4) Ensure all RolePermission links exist
    existing_links_result = await db.execute(select(RolePermission))
    existing_links = {
        (rp.role_id, rp.permission_id) for rp in existing_links_result.scalars().all()
    }

    for role_name, codes in ROLE_PERMISSIONS.items():
        role = existing_roles[role_name]
        for code in codes:
            perm = existing_perms[code]
            if (role.role_id, perm.permission_id) not in existing_links:
                db.add(RolePermission(role_id=role.role_id, permission_id=perm.permission_id))

    await db.commit()
