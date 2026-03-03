from fastapi import APIRouter, HTTPException, status,Response,Depends
from app.schemas.schemas import Role_schema,Permissions_schema,Role_user_link,Link_role_permission_schema
from app.services.role_service import addroles,viewroles,add_permissions,link_user_roles,link_role_permisson
from app.db.session import get_db
from app.db.models import Role
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependency import require_permissions
router = APIRouter()


@router.post("/add_roles")
async def add_roles(Payload: Role_schema,db: AsyncSession = Depends(get_db)):
    role = await(addroles(Payload,db))
    return role

@router.get("/view_roles",dependencies=[Depends(require_permissions("role:read_all"))])
async def view_roles( db: AsyncSession = Depends(get_db)):
    roles = await(viewroles(db))
    return roles


@router.post("/post_permission")
async def post_permission(Payload: Permissions_schema, db: AsyncSession= Depends(get_db)):
    user_role = await(add_permissions(Payload,db))
    return user_role



@router.post("/linkrole")
async def give_role(Payload: Role_user_link, db:AsyncSession = Depends(get_db)):
    userrole = await(link_user_roles(Payload,db))
    return userrole

@router.post("/linkpermission")
async def role_permission(Payload:Link_role_permission_schema,db: AsyncSession = Depends(get_db)):
    role_perm = await(link_role_permisson(Payload,db))
    return role_perm