from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Role, User,UserRole,Permission
from fastapi import HTTPException, status

from sqlalchemy.exc import IntegrityError
class RoleQuery:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user(self, username: str):
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def get_role(self, role_name: str):
        result = await self.db.execute(
            select(Role).where(Role.role_name == role_name)
        )
        return result.scalar_one_or_none()
    
    async def get_permission(self, code: str):
        result = await self.db.execute(
            select(Permission).where(Permission.code == code)
        )
        return result.scalar_one_or_none()
    
    async def assign_role_to_user(self, user_record, role_record):
        user_role = UserRole(
            user_id=user_record.user_id,
            role_id=role_record.role_id
        )

        self.db.add(user_role)

        try:
            await self.db.flush()  
        except IntegrityError:
            raise HTTPException(status_code=409, detail="User role already exists")

       
        await self.db.refresh(user_role)

        return {"detail": "role successfully given"}