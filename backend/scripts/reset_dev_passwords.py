import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.security import PasswordHash
from app.db.models import User
from app.db.session import AsyncSessionLocal


DEV_PASSWORD = "Test@1234"


async def main() -> None:
    if not settings.DEBUG:
        raise SystemExit("This script only runs in DEBUG mode.")

    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        new_hash = PasswordHash.from_password(DEV_PASSWORD).to_str()

        updated = 0
        for user in users:
            user.password_hash = new_hash
            user.failed_login_attempts = 0
            user.locked_until = None
            user.reset_token_hash = None
            user.reset_token_expires_at = None
            updated += 1

        await db.commit()
        print(f"Reset passwords for {updated} users to {DEV_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
