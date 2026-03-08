from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Role, User, UserRole, Permission, ParticipantProfile, CaretakerProfile, ResearcherProfile, SignupInvite
from fastapi import HTTPException, status
import uuid
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
    
    async def put_role(self, user_id: uuid, role_name:str):
        ROLE_TO_PROFILE_MODEL = {
        "participant": ParticipantProfile,
        "researcher": ResearcherProfile,
        "caretaker": CaretakerProfile,
                    }
        profile_model = ROLE_TO_PROFILE_MODEL.get(role_name.lower())
        if profile_model:
           profile = profile_model(user_id = user_id)
           self.db.add(profile)

        try:
            await self.db.flush()
        except  IntegrityError:
            raise HTTPException(status_code=409, detail="User-profile role already exists")




    async def get_user_roles(self, user_id: uuid.UUID) -> list[str]:
        result = await self.db.execute(
            select(Role.role_name)
            .join(UserRole, UserRole.role_id == Role.role_id)
            .where(UserRole.user_id == user_id)
        )
        return [row[0].lower() for row in result.fetchall()]

    async def get_invite_by_token_hash(self, token_hash: str):
        result = await self.db.execute(
            select(SignupInvite).where(SignupInvite.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def get_role_by_id(self, role_id: uuid.UUID):
        result = await self.db.execute(
            select(Role).where(Role.role_id == role_id)
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
    

    
