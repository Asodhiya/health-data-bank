from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User
from app.db.session import get_db
from app.core.dependency import require_permissions
from app.db.queries.Queries import RoleQuery

router = APIRouter()
