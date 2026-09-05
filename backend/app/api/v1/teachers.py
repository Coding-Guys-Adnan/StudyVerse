from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.models.user import User


class AvailableTeacherResponse(BaseModel):
    id: str
    full_name: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get("/available", response_model=list[AvailableTeacherResponse])
async def get_available_teachers(db: AsyncSession = Depends(get_db)):
    """
    Get list of active available teachers for student registration/selection.
    Returns ONLY safe public fields (id, full_name, avatar_url).
    """
    result = await db.execute(
        select(User)
        .where(
            User.role == "teacher",
            User.is_active == True,
        )
        .order_by(User.full_name.asc())
    )
    teachers = result.scalars().all()
    return [
        AvailableTeacherResponse(
            id=t.id,
            full_name=t.full_name,
            avatar_url=None,
        )
        for t in teachers
    ]
