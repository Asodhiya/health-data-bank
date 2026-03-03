from fastapi import HTTPException, status, Depends
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Role,Permission,RolePermission,User,UserRole
from app.schemas.schemas import Role_schema,Permissions_schema,Role_user_link,Link_role_permission_schema
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.db.queries.RoleQuery import RoleQuery


async def addroles(Payload : Role_schema, db:AsyncSession):

    """
    Create a new role in the system.

    This asynchronous function checks whether a role with the given
    name already exists. If it does, a 409 Conflict error is raised.
    Otherwise, a new Role record is created, committed, and refreshed.

    Args:
        Payload (Role_schema): Payload containing the role name to be created.
        db (AsyncSession): An active asynchronous SQLAlchemy database session.

    Raises:
        HTTPException:
            - 409 Conflict if a role with the same name already exists.
            - 409 Conflict if a database integrity error occurs during commit.

    Returns:
        Role: The newly created Role object.
    """
    res = await (db.execute(select(Role).where(Role.role_name == Payload.role_name)))
    role =  res.scalar_one_or_none()

    if role:
        raise HTTPException(
            status_code= 409,
            detail= "Role already exists"
        )
    new_role = Role(
        role_name = Payload.role_name
    )

    db.add(new_role)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Role already exists")

    await db.refresh(new_role)
    return new_role



async def viewroles(db:AsyncSession):
    """
    Retrieve all roles from the database.

    This asynchronous function queries the Role table and returns
    all available role records.

    Args:
        db (AsyncSession): An active asynchronous SQLAlchemy database session.

    Returns:
        List[Role]: A list of Role objects retrieved from the database.
    """
    res = await (db.execute(select(Role)))
    roles = res.scalars().all()
    return roles




async def link_user_roles(Payload:Role_user_link, db:AsyncSession):
    """
    Link a user to a role in the system.

    This asynchronous function validates the existence of the specified
    role and user, then creates a mapping between them in the UserRole
    association table. If the role or user does not exist, or if the
    relationship already exists, an appropriate HTTP error is raised.

    Args:
        Payload (Role_schema): Payload containing the role name to be assigned.
        Payload2 (UserSignup): Payload containing the username of the user.
        db (AsyncSession): An active asynchronous SQLAlchemy database session.

    Raises:
        HTTPException:
            - 404 Not Found if the role does not exist.
            - 404 Not Found if the user does not exist.
            - 404 Not Found if the user is already linked to the role.

    Returns:
        UserRole: The newly created user-role association record.
    """
    role_query = RoleQuery(db)
    user_record= await role_query.get_user(Payload.username)
    if not user_record:
        raise HTTPException(status_code= 404, detail="User doesnot exist")
    
    role_record = await role_query.get_role(Payload.role_name)

    if not role_record:
        raise HTTPException(status_code= 404, detail="Role doesnot exist")
   
    user_role = UserRole(
        user_id = user_record.user_id,
        role_id = role_record.role_id
    )
    
    try:
        await role_query.assign_role_to_user(user_record, role_record)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="User role already exists")

    await db.refresh(user_role)
    return "detail: role sucessfully given"
    






async def add_permissions(Payload : Permissions_schema, db:AsyncSession):
    """
    Create and store a new permission in the database.

    This asynchronous function checks whether a permission with the given
    code already exists. If it does, a 409 Conflict error is raised.
    Otherwise, a new Permission record is created, committed, and refreshed.

    Args:
        Payload (Permissions_schema): The request payload containing
            the permission code and description.
        db (AsyncSession): An active asynchronous SQLAlchemy database session.

    Raises:
        HTTPException: 
            - 409 Conflict if a permission with the same code already exists.
            - 409 Conflict if a database integrity error occurs during commit.

    Returns:
        Permission: The newly created and persisted Permission object.
    """
    res = await (db.execute(select(Permission).where(Permission.code == Payload.code)))
    permission =  res.scalar_one_or_none()

    if permission:
        raise HTTPException(
            status_code= 409,
            detail= "Permission already exists"
        )
    
    new_permisison = Permission(
        code = Payload.code,
        description = Payload.description
    )

    db.add(new_permisison)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Permission already exisit")

    await db.refresh(new_permisison)
    return new_permisison


async def view_permissions(db:AsyncSession):
    """
    Retrieve all permission records from the database.

    This asynchronous function queries the database for all entries
    in the Permission table and returns them as a list.

    Args:
        db (AsyncSession): An active asynchronous SQLAlchemy database session.

    Returns:
        List[Permission]: A list of Permission objects retrieved from the database.
    """
    res = await (db.execute(select(Permission)))
    permissions = res.scalars().all()
    return permissions


async def link_role_permisson(Payload: Link_role_permission_schema, db:AsyncSession):

    """
    Link (assign) a permission to a role.

    This function is used by admin-only RBAC endpoints to create an association
    between an existing role and an existing permission.

    Admins provide human-readable identifiers (permission code and role name)
    instead of internal database UUIDs. The function resolves these identifiers
    and inserts a new row into the role_permissions join table.

    Steps:
    1. Look up the role by role_name.
    2. Look up the permission by permission code.
    3. Create a role-permission association.
    4. Commit the transaction.

    Raises:
        HTTPException (404):
            - If the role does not exist
            - If the permission does not exist

        HTTPException (409):
            - If the role already has the permission linked

    Returns:
        RolePermission:
            The newly created role-permission association.
    """

    # 1) Find role by name
    role_query = RoleQuery(db)
    role_record = await role_query.get_role(Payload.role_name)
    if not role_record:
        raise HTTPException(status_code= 404,detail="Role doesnot exist")
    
    # 1) Find permission by code
    permission = await role_query.get_permission(Payload.code)
    if not permission:
        raise HTTPException(status_code= 404,detail="Permission doesnot exist")
    
    #creating and adding a new role permission
    role_permission = RolePermission(
        role_id = role_record.role_id,
        permission_id = permission.permission_id
    )

    db.add(role_permission)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Permission already exisit")

    await db.refresh(role_permission)
    return role_permission
    

    


    

async def unlink_role_permission(Payload:Role_schema,Payload2:Permissions_schema,db:AsyncSession):

    """
    Unlink (remove) a permission from a role.

    This function is used by admin-only RBAC endpoints to remove an existing
    association between a role and a permission.

    Admins provide human-readable identifiers (role name and permission code)
    instead of internal database UUIDs. The function resolves these identifiers
    to database records and deletes the corresponding row from the
    role_permissions join table.

    Steps:
    1. Look up the role by role_name.
    2. Look up the permission by permission code.
    3. Verify that the role-permission association exists.
    4. Delete the association from the role_permissions table.
    5. Commit the transaction.

    Raises:
        HTTPException (404):
            - If the role does not exist
            - If the permission does not exist
            - If the role does not have the specified permission linked

    Returns:
        RolePermission:
            The deleted role-permission association (optional; returned for
            confirmation or logging purposes).
    """

     # 1) Find role by name
    role_res = await db.execute(select(Role).where(Role.role_name == Payload.role_name))
    role = role_res.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role does not exist")

    # 2) Find permission by code
    perm_res = await db.execute(select(Permission).where(Permission.code == Payload2.code))
    perm = perm_res.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission does not exist")
    
    #3 Deleting the role and permisison link from Role permission table

    res= await(db.execute(select(RolePermission).where(RolePermission.permission_id == perm.permission_id and RolePermission.role_id == role.role_id)))
    role_permission = res.scalar_one_or_none
    if not role_permission:
        raise HTTPException(status_code= 404, detail="Role permission doesnot exist")
    db.delete(role_permission)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Role permission doesnot exisit")

    await db.refresh(role_permission)
    return role_permission 