from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, extract
from app.models.academic import Announcement
from app.models.student import Student
from app.models.user import User
from app.schemas.extended import AnnouncementCreate, AnnouncementResponse


async def check_and_create_birthday_announcements(db: AsyncSession) -> list[Announcement]:
    """
    Checks if today is any student's birthday.
    If so, idempotently creates an announcement wishing them a happy birthday if not already created this year.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    try:
        students_res = await db.execute(
            select(Student).where(Student.date_of_birth.is_not(None))
        )
        students = students_res.scalars().all()

        birthday_students = [
            s for s in students
            if s.date_of_birth and s.date_of_birth.month == today.month and s.date_of_birth.day == today.day
        ]

        if not birthday_students:
            return []

        # Find default teacher/admin id to author the announcement
        fallback_teacher_id = None
        teacher_res = await db.execute(select(User.id).where(User.role == "teacher").limit(1))
        fallback_teacher_id = teacher_res.scalar()
        if not fallback_teacher_id:
            admin_res = await db.execute(select(User.id).where(User.role == "admin").limit(1))
            fallback_teacher_id = admin_res.scalar()

        created = []
        for s in birthday_students:
            author_id = s.teacher_id or fallback_teacher_id
            if not author_id:
                continue

            title = f"🎂 Happy Birthday, {s.name}! 🎉"

            # Check if this announcement was already posted this year
            existing_res = await db.execute(
                select(Announcement).where(
                    Announcement.title == title,
                    extract("year", Announcement.created_at) == today.year
                )
            )
            if existing_res.scalars().first():
                continue

            ann = Announcement(
                teacher_id=author_id,
                title=title,
                message=(
                    f"Today ({today.strftime('%B %d')}) is {s.name}'s birthday! 🎈 "
                    f"StudyVerse wishes {s.name} a joyous, blessed, and wonderful birthday filled with "
                    f"happiness, success, and great learning! 🎂✨ Join us in wishing {s.name}!"
                ),
                channel="app",
                created_at=now,
            )
            db.add(ann)
            created.append(ann)

        if created:
            await db.commit()

        return created
    except Exception as e:
        print(f"[AnnouncementService] Error checking birthday announcements: {e}")
        return []


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
    # Ensure any birthday announcements for today are created
    await check_and_create_birthday_announcements(db)

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
