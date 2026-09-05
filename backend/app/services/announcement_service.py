from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.academic import Announcement
from app.models.user import User
from app.schemas.extended import AnnouncementCreate, AnnouncementResponse

async def create_announcement(
    db: AsyncSession, teacher: User, data: AnnouncementCreate
) -> AnnouncementResponse:
    if teacher.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can create announcements"
        )
        
    ann = Announcement(
        teacher_id=teacher.id,
        title=data.title,
        message=data.message,
        channel="app"
    )
    db.add(ann)
    await db.flush()
    await db.refresh(ann)
    
    return AnnouncementResponse(
        id=ann.id,
        teacher_id=ann.teacher_id,
        title=ann.title,
        message=ann.message,
        channel=ann.channel,
        created_at=ann.created_at.isoformat()
    )

async def list_announcements(
    db: AsyncSession
) -> list[AnnouncementResponse]:
    result = await db.execute(
        select(Announcement).order_by(Announcement.created_at.desc())
    )
    announcements = result.scalars().all()
    return [
        AnnouncementResponse(
            id=a.id,
            teacher_id=a.teacher_id,
            title=a.title,
            message=a.message,
            channel=a.channel,
            created_at=a.created_at.isoformat()
        )
        for a in announcements
    ]

async def delete_announcement(
    db: AsyncSession, teacher: User, announcement_id: str
) -> dict:
    if teacher.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can delete announcements"
        )
        
    result = await db.execute(
        select(Announcement).where(
            Announcement.id == announcement_id,
            Announcement.teacher_id == teacher.id
        )
    )
    ann = result.scalar_one_or_none()
    if not ann:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found or unauthorized to delete"
        )
        
    await db.delete(ann)
    await db.flush()
    return {"message": "Announcement deleted successfully"}
