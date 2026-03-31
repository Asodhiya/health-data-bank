from fastapi import HTTPException,status
from app.core.security import PasswordHash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select,update
from app.db.models import User
from app.schemas.schemas import UpdatePersonalInfoPayload
from sqlalchemy.exc import IntegrityError

async def update_user(Payload:UpdatePersonalInfoPayload,user:User ,db: AsyncSession):
        

        data = Payload.model_dump(exclude_unset=True)

        if not data:
            raise HTTPException(status_code=400, detail="No fields provided to update")

        values: dict = {}

        # normal fields 
        if "username" in data and data["username"] is not None:
            values["username"] = data["username"]

        if "first_name" in data and data["first_name"] is not None:
            values["first_name"] = data["first_name"]

        if "last_name" in data and data["last_name"] is not None:
            values["last_name"] = data["last_name"]

        if "email" in data and data["email"] is not None:
            values["email"] = data["email"]

        if "phone_number" in data and data["phone_number"] is not None:
            values["phone"] = data["phone_number"]

        if "address" in data and data["address"] is not None:
            values["Address"] = data["address"]

        
        old_password = data.get("old_password")
        new_password = data.get("new_password")

        if new_password is not None:
            # payload validator should already enforce both, but keeping backend-safe too
            if not old_password:
                raise HTTPException(status_code=400, detail="old_password is required")

            # verify old password
            if not PasswordHash.from_str(user.password_hash).verify(old_password):
                raise HTTPException(status_code=400, detail="Old password is incorrect")

            # set new hash
            values["password_hash"] = PasswordHash.from_password(new_password).to_str()

        if not values:
            raise HTTPException(status_code=400, detail="No valid fields provided to update")

        stmt = (
            update(User)
            .where(User.user_id == user.user_id)
            .values(**values)
        )

        try:
            await db.execute(stmt)
            await db.commit()
            return {"detail": "User information updated successfully"}
        except IntegrityError:
            await db.rollback()
            # Usually unique constraints (username/email)
            raise HTTPException(status_code=409, detail="Username or email already exists")
        except Exception:
            await db.rollback()
            raise HTTPException(status_code=500, detail="Failed to update user information")
        