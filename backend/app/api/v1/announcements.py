from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_teacher, get_current_user
from app.models.user import User
from app.schemas.extended import AnnouncementCreate, AnnouncementResponse
from app.services import announcement_service

router = APIRouter(prefix="/announcements", tags=["Announcements"])

@router.post("", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_new_announcement(
    data: AnnouncementCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Create a new broadcast announcement (Teacher only)."""
    return await announcement_service.create_announcement(db, teacher, data)


@router.get("", response_model=list[AnnouncementResponse])
async def get_announcements_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all announcements (Accessible by Teachers and Students)."""
    return await announcement_service.list_announcements(db)


@router.delete("/{announcement_id}")
async def remove_announcement(
    announcement_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a broadcast announcement (Teacher only)."""
    return await announcement_service.delete_announcement(db, teacher, announcement_id)
