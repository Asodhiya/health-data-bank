from fastapi import Depends, HTTPException, Request, status

from app.core.security import decode_access_token
from app.services.auth_service import get_user_by_id
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.RBAC_service import RBACService
from typing import Callable

async def check_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(401, detail="Not authenticated")

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, detail="Invalid token")

    user = await get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(401, detail="User not found")

    return user


async def get_rbac_service(db: AsyncSession = Depends(get_db)) :
    return RBACService(db)
    

def require_permissions(*required: str) -> Callable:
    async def guard(user = Depends(check_current_user), rbac: RBACService = Depends(get_rbac_service)) :
        missing = []
        for p in required:
            has = await (rbac.user_has_permission(user.user_id, p))
            if not has:
                missing.append(p)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {missing}"
            )
    return guard