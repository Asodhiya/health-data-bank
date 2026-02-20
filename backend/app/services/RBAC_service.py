from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import UserRole,RolePermission,Permission
class RBACService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def user_has_permission(self, user_id: int, perm_code: str) -> bool:
        stmt = select(
            exists(
                select(1)
                .select_from(UserRole)
                .join(RolePermission, RolePermission.role_id == UserRole.role_id)
                .join(Permission, Permission.permission_id == RolePermission.permission_id)
                .where(UserRole.user_id == user_id)
                .where(Permission.code == perm_code)
            )
        )
        result = await self.db.execute(stmt)
        return bool(result.scalar())
                