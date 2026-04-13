"""
Bootstrap the first admin account from environment variables.

Add these to your .env before first startup:

    FIRST_ADMIN_EMAIL=admin@example.com
    FIRST_ADMIN_PASSWORD=changeme123
    FIRST_ADMIN_USERNAME=admin
    FIRST_ADMIN_FIRST_NAME=Admin
    FIRST_ADMIN_LAST_NAME=User

Runs on every startup but does nothing if:
  - any admin already exists, OR
  - FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD are not set.
"""
import os
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import PasswordHash
from app.db.models import User, Role, UserRole

logger = logging.getLogger(__name__)


async def seed_first_admin(db: AsyncSession) -> None:
    email = os.getenv("FIRST_ADMIN_EMAIL", "").strip()
    password = os.getenv("FIRST_ADMIN_PASSWORD", "").strip()

    if not email or not password:
        return

    # Skip if any admin already exists
    existing = await db.scalar(
        select(User.user_id)
        .join(UserRole, UserRole.user_id == User.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(Role.role_name == "admin")
        .limit(1)
    )
    if existing:
        return

    username = os.getenv("FIRST_ADMIN_USERNAME", "admin").strip()
    first_name = os.getenv("FIRST_ADMIN_FIRST_NAME", "Admin").strip()
    last_name = os.getenv("FIRST_ADMIN_LAST_NAME", "User").strip()

    # Guard against email/username already taken by a non-admin
    taken = await db.scalar(
        select(User.user_id).where(
            (User.email == email) | (User.username == username)
        )
    )
    if taken:
        logger.warning(
            "Admin bootstrap skipped: email or username already taken (%s / %s).",
            email, username,
        )
        return

    admin_role = await db.scalar(
        select(Role).where(Role.role_name == "admin")
    )
    if not admin_role:
        logger.warning("Admin bootstrap skipped: 'admin' role not found — rbac seed must run first.")
        return

    user = User(
        username=username,
        email=email,
        password_hash=PasswordHash.from_password(password).to_str(),
        first_name=first_name,
        last_name=last_name,
        status=True,
    )
    db.add(user)
    await db.flush()

    db.add(UserRole(user_id=user.user_id, role_id=admin_role.role_id))
    await db.commit()

    logger.info("First admin account created: %s (%s %s)", email, first_name, last_name)
