"""
Service layer for all calendar-related operations:
attendance, daily plans, calendar events, fee records, homework.

All operations are scoped to a student that belongs to the teacher.
"""

from datetime import date, datetime, timezone
import os
import uuid
from calendar import monthrange
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, extract
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status, UploadFile
from app.services import storage_service
from app.models.student import Student
from app.models.academic import (
    Attendance, DailyPlan, CalendarEvent, FeeRecord, Homework, Syllabus, Test,
    SyllabusChapter, ChecklistItem, ChapterNote, SyllabusAttachment,
)
from app.models.user import User
from app.schemas.academic import (
    AttendanceCreate, AttendanceUpdate, AttendanceResponse,
    DailyPlanCreate, DailyPlanUpdate, DailyPlanResponse,
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse,
    FeeRecordCreate, FeeRecordUpdate, FeeRecordResponse, FeeToggleRequest,
    HomeworkCreate, HomeworkUpdate, HomeworkResponse,
    SyllabusCreate, SyllabusUpdate, SyllabusResponse,
    SyllabusChapterCreate, SyllabusChapterUpdate, SyllabusChapterResponse,
    ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemResponse,
    ChapterNoteCreate, ChapterNoteUpdate, ChapterNoteResponse,
    SyllabusAttachmentResponse,
    TestCreate, TestUpdate, TestResponse,
    CalendarDayData, CalendarMonthResponse,
)


# ─── Helpers ─────────────────────────────────────────────

async def _verify_student_ownership(
    db: AsyncSession, teacher: User, student_id: str
) -> Student:
    """Ensure the student belongs to this teacher."""
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.teacher_id == teacher.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    return student


# ─── Attendance ──────────────────────────────────────────

async def upsert_attendance(
    db: AsyncSession, teacher: User, student_id: str, data: AttendanceCreate
) -> AttendanceResponse:
    await _verify_student_ownership(db, teacher, student_id)

    # Check for existing attendance on this date
    result = await db.execute(
        select(Attendance).where(
            Attendance.student_id == student_id,
            Attendance.date == data.date,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.status = data.status
        await db.flush()
        await db.refresh(existing)
        return AttendanceResponse.model_validate(existing)

    record = Attendance(student_id=student_id, date=data.date, status=data.status)
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return AttendanceResponse.model_validate(record)


async def delete_attendance(
    db: AsyncSession, teacher: User, student_id: str, attendance_date: date
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Attendance).where(
            Attendance.student_id == student_id,
            Attendance.date == attendance_date,
        )
    )
    record = result.scalar_one_or_none()
    if record:
        await db.delete(record)
        await db.flush()
    return {"message": "Attendance removed"}


async def list_attendance(
    db: AsyncSession, teacher: User, student_id: str,
    year: int, month: int
) -> list[AttendanceResponse]:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Attendance).where(
            Attendance.student_id == student_id,
            extract("year", Attendance.date) == year,
            extract("month", Attendance.date) == month,
        ).order_by(Attendance.date.asc())
    )
    return [AttendanceResponse.model_validate(r) for r in result.scalars().all()]


# ─── Daily Plans ────────────────────────────────────────

async def upsert_daily_plan(
    db: AsyncSession, teacher: User, student_id: str, data: DailyPlanCreate
) -> DailyPlanResponse:
    await _verify_student_ownership(db, teacher, student_id)

    result = await db.execute(
        select(DailyPlan).where(
            DailyPlan.student_id == student_id,
            DailyPlan.date == data.date,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        if data.topics_to_teach is not None:
            existing.topics_to_teach = data.topics_to_teach
        if data.notes is not None:
            existing.notes = data.notes
        if data.actually_taught is not None:
            existing.actually_taught = data.actually_taught
        await db.flush()
        await db.refresh(existing)
        return DailyPlanResponse.model_validate(existing)

    plan = DailyPlan(
        student_id=student_id,
        date=data.date,
        topics_to_teach=data.topics_to_teach,
        notes=data.notes,
        actually_taught=data.actually_taught,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    return DailyPlanResponse.model_validate(plan)


async def list_daily_plans(
    db: AsyncSession, teacher: User, student_id: str,
    year: int, month: int
) -> list[DailyPlanResponse]:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(DailyPlan).where(
            DailyPlan.student_id == student_id,
            extract("year", DailyPlan.date) == year,
            extract("month", DailyPlan.date) == month,
        ).order_by(DailyPlan.date.asc())
    )
    return [DailyPlanResponse.model_validate(r) for r in result.scalars().all()]


# ─── Calendar Events ────────────────────────────────────

async def create_calendar_event(
    db: AsyncSession, teacher: User, student_id: str, data: CalendarEventCreate
) -> CalendarEventResponse:
    await _verify_student_ownership(db, teacher, student_id)
    event = CalendarEvent(
        student_id=student_id,
        event_date=data.event_date,
        title=data.title,
        description=data.description,
        event_type=data.event_type,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return CalendarEventResponse.model_validate(event)


async def update_calendar_event(
    db: AsyncSession, teacher: User, student_id: str,
    event_id: str, data: CalendarEventUpdate
) -> CalendarEventResponse:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.student_id == student_id,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    await db.flush()
    await db.refresh(event)
    return CalendarEventResponse.model_validate(event)


async def delete_calendar_event(
    db: AsyncSession, teacher: User, student_id: str, event_id: str
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.student_id == student_id,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.flush()
    return {"message": "Event deleted"}


async def list_calendar_events(
    db: AsyncSession, teacher: User, student_id: str,
    year: int, month: int
) -> list[CalendarEventResponse]:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.student_id == student_id,
            extract("year", CalendarEvent.event_date) == year,
            extract("month", CalendarEvent.event_date) == month,
        ).order_by(CalendarEvent.event_date.asc())
    )
    return [CalendarEventResponse.model_validate(r) for r in result.scalars().all()]


# ─── Fee Records ────────────────────────────────────────

async def create_fee_record(
    db: AsyncSession, teacher: User, student_id: str, data: FeeRecordCreate
) -> FeeRecordResponse:
    student = await _verify_student_ownership(db, teacher, student_id)
    
    # Check if record already exists for (student_id, fee_month)
    result = await db.execute(
        select(FeeRecord).where(
            FeeRecord.student_id == student_id,
            FeeRecord.fee_month == data.fee_month,
        )
    )
    existing = result.scalar_one_or_none()
    
    # Derive month name and year if not given
    yr = data.year
    mo = data.month
    if not yr or not mo:
        try:
            parts = data.fee_month.split("-")
            yr = int(parts[0])
            mo_num = int(parts[1])
            month_names = [
                "", "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ]
            mo = month_names[mo_num]
        except Exception:
            pass

    if existing:
        existing.amount = data.amount
        existing.status = data.status
        existing.paid_date = data.paid_date
        existing.notes = data.notes
        existing.month = mo
        existing.year = yr
        await db.flush()
        await db.refresh(existing)
        return FeeRecordResponse.model_validate(existing)

    record = FeeRecord(
        student_id=student_id,
        fee_month=data.fee_month,
        month=mo,
        year=yr,
        amount=data.amount,
        status=data.status,
        paid_date=data.paid_date,
        notes=data.notes,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return FeeRecordResponse.model_validate(record)


async def upsert_fee_record(
    db: AsyncSession, teacher: User, student_id: str, data: FeeToggleRequest
) -> FeeRecordResponse:
    student = await _verify_student_ownership(db, teacher, student_id)
    
    # Check if fee record exists for this student and fee_month
    result = await db.execute(
        select(FeeRecord).where(
            FeeRecord.student_id == student_id,
            FeeRecord.fee_month == data.fee_month,
        )
    )
    record = result.scalar_one_or_none()
    
    # Derive month name and year from fee_month (YYYY-MM)
    try:
        parts = data.fee_month.split("-")
        yr = int(parts[0])
        mo_num = int(parts[1])
        month_names = [
            "", "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        mo_name = month_names[mo_num] if 1 <= mo_num <= 12 else "Unknown"
    except Exception:
        yr = date.today().year
        mo_name = "Unknown"

    if record:
        record.status = data.status
        if data.status == "paid":
            record.paid_date = data.paid_date or date.today()
        else:
            record.paid_date = None
        if data.amount is not None:
            record.amount = data.amount
        elif record.amount == 0.0 and getattr(student, "monthly_fees", None):
            record.amount = student.monthly_fees
        record.month = mo_name
        record.year = yr
    else:
        amount = data.amount if data.amount is not None else (getattr(student, "monthly_fees", None) or 0.0)
        record = FeeRecord(
            student_id=student_id,
            fee_month=data.fee_month,
            amount=amount,
            status=data.status,
            paid_date=data.paid_date if data.status == "paid" else None,
            month=mo_name,
            year=yr,
        )
        db.add(record)

    await db.flush()
    await db.refresh(record)
    return FeeRecordResponse.model_validate(record)


async def update_fee_record(
    db: AsyncSession, teacher: User, student_id: str,
    fee_id: str, data: FeeRecordUpdate
) -> FeeRecordResponse:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(FeeRecord).where(
            FeeRecord.id == fee_id,
            FeeRecord.student_id == student_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Fee record not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)
    await db.flush()
    await db.refresh(record)
    return FeeRecordResponse.model_validate(record)


async def list_fee_records(
    db: AsyncSession, teacher: User, student_id: str,
    year: int | None = None
) -> list[FeeRecordResponse]:
    await _verify_student_ownership(db, teacher, student_id)
    query = select(FeeRecord).where(FeeRecord.student_id == student_id)
    if year:
        query = query.where(
            (FeeRecord.year == year) | (FeeRecord.fee_month.startswith(f"{year:04d}-"))
        )
    query = query.order_by(FeeRecord.fee_month.desc())
    result = await db.execute(query)
    return [FeeRecordResponse.model_validate(r) for r in result.scalars().all()]


# ─── Homework ───────────────────────────────────────────

async def create_homework(
    db: AsyncSession, teacher: User, student_id: str, data: HomeworkCreate
) -> HomeworkResponse:
    await _verify_student_ownership(db, teacher, student_id)
    hw = Homework(
        student_id=student_id,
        subject=data.subject,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        status=data.status,
        attachment_name=data.attachment_name,
        attachment_url=data.attachment_url,
    )
    db.add(hw)
    await db.flush()
    await db.refresh(hw)
    return HomeworkResponse(
        id=hw.id, student_id=hw.student_id, subject=hw.subject,
        title=hw.title, description=hw.description, due_date=hw.due_date,
        status=hw.status,
        attachment_name=getattr(hw, "attachment_name", None),
        attachment_url=getattr(hw, "attachment_url", None),
        created_at=hw.created_at.isoformat(),
    )


async def update_homework(
    db: AsyncSession, teacher: User, student_id: str,
    homework_id: str, data: HomeworkUpdate
) -> HomeworkResponse:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Homework).where(
            Homework.id == homework_id,
            Homework.student_id == student_id,
        )
    )
    hw = result.scalar_one_or_none()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(hw, field, value)
    await db.flush()
    await db.refresh(hw)
    return HomeworkResponse(
        id=hw.id, student_id=hw.student_id, subject=hw.subject,
        title=hw.title, description=hw.description, due_date=hw.due_date,
        status=hw.status,
        attachment_name=getattr(hw, "attachment_name", None),
        attachment_url=getattr(hw, "attachment_url", None),
        created_at=hw.created_at.isoformat(),
    )


async def delete_homework(
    db: AsyncSession, teacher: User, student_id: str, homework_id: str
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Homework).where(
            Homework.id == homework_id,
            Homework.student_id == student_id,
        )
    )
    hw = result.scalar_one_or_none()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
    await db.delete(hw)
    await db.flush()
    return {"message": "Homework deleted"}


async def list_homework(
    db: AsyncSession, teacher: User, student_id: str,
    year: int | None = None, month: int | None = None
) -> list[HomeworkResponse]:
    await _verify_student_ownership(db, teacher, student_id)
    query = select(Homework).where(Homework.student_id == student_id)
    if year and month:
        query = query.where(
            extract("year", Homework.due_date) == year,
            extract("month", Homework.due_date) == month,
        )
    query = query.order_by(Homework.created_at.desc())
    result = await db.execute(query)
    records = result.scalars().all()
    return [
        HomeworkResponse(
            id=hw.id, student_id=hw.student_id, subject=hw.subject,
            title=hw.title, description=hw.description, due_date=hw.due_date,
            status=hw.status,
            attachment_name=getattr(hw, "attachment_name", None),
            attachment_url=getattr(hw, "attachment_url", None),
            created_at=hw.created_at.isoformat(),
        )
        for hw in records
    ]


# ─── Syllabus ───────────────────────────────────────────

def _syllabus_options():
    return [
        selectinload(Syllabus.chapters).options(
            selectinload(SyllabusChapter.checklist_items).options(
                selectinload(ChecklistItem.attachments)
            ),
            selectinload(SyllabusChapter.notes).options(
                selectinload(ChapterNote.attachments)
            ),
        )
    ]


async def create_syllabus(
    db: AsyncSession, teacher: User, student_id: str, data: SyllabusCreate
) -> SyllabusResponse:
    await _verify_student_ownership(db, teacher, student_id)
    entry = Syllabus(
        student_id=student_id,
        subject=data.subject,
        chapter=data.chapter,
        chapter_type=data.chapter_type,
        term=data.term,
        status=data.status,
        progress=data.progress,
        sort_order=data.sort_order,
    )
    db.add(entry)
    await db.flush()

    # Auto-create initial default chapter matching chapter title
    chap = SyllabusChapter(
        syllabus_id=entry.id,
        title=data.chapter,
        order=0
    )
    db.add(chap)
    await db.flush()

    res = await db.execute(
        select(Syllabus).options(*_syllabus_options()).where(Syllabus.id == entry.id)
    )
    loaded_entry = res.scalar_one()
    return SyllabusResponse.model_validate(loaded_entry)


async def update_syllabus(
    db: AsyncSession, teacher: User, student_id: str,
    syllabus_id: str, data: SyllabusUpdate
) -> SyllabusResponse:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Syllabus).options(*_syllabus_options()).where(
            Syllabus.id == syllabus_id,
            Syllabus.student_id == student_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Syllabus entry not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)
    await db.flush()

    res = await db.execute(
        select(Syllabus).options(*_syllabus_options()).where(Syllabus.id == syllabus_id)
    )
    return SyllabusResponse.model_validate(res.scalar_one())


async def delete_syllabus(
    db: AsyncSession, teacher: User, student_id: str, syllabus_id: str
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Syllabus).where(
            Syllabus.id == syllabus_id,
            Syllabus.student_id == student_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Syllabus entry not found")
    await db.delete(entry)
    await db.flush()
    return {"message": "Syllabus entry deleted"}


async def _get_or_create_chapter_for_syllabus(db: AsyncSession, target_id: str) -> SyllabusChapter:
    # First check if target_id is already a chapter ID
    res = await db.execute(select(SyllabusChapter).where(SyllabusChapter.id == target_id))
    chap = res.scalar_one_or_none()
    if chap:
        return chap

    # Otherwise check if target_id is a syllabus ID
    res_s = await db.execute(select(Syllabus).where(Syllabus.id == target_id))
    s_entry = res_s.scalar_one_or_none()
    if s_entry:
        res_chap = await db.execute(select(SyllabusChapter).where(SyllabusChapter.syllabus_id == s_entry.id))
        existing_chap = res_chap.scalars().first()
        if existing_chap:
            return existing_chap
        new_chap = SyllabusChapter(
            syllabus_id=s_entry.id,
            title=s_entry.chapter,
            order=0
        )
        db.add(new_chap)
        await db.flush()
        return new_chap

    raise HTTPException(status_code=404, detail="Syllabus chapter or entry not found")


async def list_syllabus(
    db: AsyncSession, teacher: User, student_id: str
) -> list[SyllabusResponse]:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Syllabus)
        .options(*_syllabus_options())
        .where(Syllabus.student_id == student_id)
        .order_by(Syllabus.sort_order.asc(), Syllabus.id.asc())
    )
    syllabus_entries = result.scalars().all()
    created_any = False
    for entry in syllabus_entries:
        if not entry.chapters:
            chap = SyllabusChapter(
                syllabus_id=entry.id,
                title=entry.chapter,
                order=0
            )
            db.add(chap)
            created_any = True
    if created_any:
        await db.flush()
        result = await db.execute(
            select(Syllabus)
            .options(*_syllabus_options())
            .where(Syllabus.student_id == student_id)
            .order_by(Syllabus.sort_order.asc(), Syllabus.id.asc())
        )
        syllabus_entries = result.scalars().all()

    return [SyllabusResponse.model_validate(r) for r in syllabus_entries]


# ─── Relational Syllabus Chapters ───────────────────────

async def create_syllabus_chapter(
    db: AsyncSession, teacher: User, student_id: str, syllabus_id: str, data: SyllabusChapterCreate
) -> SyllabusChapterResponse:
    await _verify_student_ownership(db, teacher, student_id)
    chap = SyllabusChapter(
        syllabus_id=syllabus_id,
        title=data.title,
        order=data.order
    )
    db.add(chap)
    await db.flush()
    res = await db.execute(
        select(SyllabusChapter)
        .options(
            selectinload(SyllabusChapter.checklist_items).options(selectinload(ChecklistItem.attachments)),
            selectinload(SyllabusChapter.notes).options(selectinload(ChapterNote.attachments))
        )
        .where(SyllabusChapter.id == chap.id)
    )
    return SyllabusChapterResponse.model_validate(res.scalar_one())


async def update_syllabus_chapter(
    db: AsyncSession, teacher: User, student_id: str, chapter_id: str, data: SyllabusChapterUpdate
) -> SyllabusChapterResponse:
    await _verify_student_ownership(db, teacher, student_id)
    res = await db.execute(
        select(SyllabusChapter)
        .options(
            selectinload(SyllabusChapter.checklist_items).options(selectinload(ChecklistItem.attachments)),
            selectinload(SyllabusChapter.notes).options(selectinload(ChapterNote.attachments))
        )
        .where(SyllabusChapter.id == chapter_id)
    )
    chap = res.scalar_one_or_none()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    if data.title is not None:
        chap.title = data.title
    if data.order is not None:
        chap.order = data.order
    await db.flush()
    return SyllabusChapterResponse.model_validate(chap)


async def delete_syllabus_chapter(
    db: AsyncSession, teacher: User, student_id: str, chapter_id: str
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    res = await db.execute(select(SyllabusChapter).where(SyllabusChapter.id == chapter_id))
    chap = res.scalar_one_or_none()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found")
    await db.delete(chap)
    await db.flush()
    return {"message": "Chapter deleted"}


# ─── Checklist Items ─────────────────────────────────────

async def create_checklist_item(
    db: AsyncSession, teacher: User, student_id: str, chapter_id: str, data: ChecklistItemCreate
) -> ChecklistItemResponse:
    await _verify_student_ownership(db, teacher, student_id)
    chap = await _get_or_create_chapter_for_syllabus(db, chapter_id)
    item = ChecklistItem(
        chapter_id=chap.id,
        text=data.text,
        completed=data.completed,
        order=data.order
    )
    db.add(item)
    await db.flush()
    res = await db.execute(
        select(ChecklistItem).options(selectinload(ChecklistItem.attachments)).where(ChecklistItem.id == item.id)
    )
    return ChecklistItemResponse.model_validate(res.scalar_one())


async def update_checklist_item(
    db: AsyncSession, teacher: User, student_id: str, item_id: str, data: ChecklistItemUpdate
) -> ChecklistItemResponse:
    await _verify_student_ownership(db, teacher, student_id)
    res = await db.execute(
        select(ChecklistItem).options(selectinload(ChecklistItem.attachments)).where(ChecklistItem.id == item_id)
    )
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    
    if data.text is not None:
        item.text = data.text
    if data.completed is not None:
        item.completed = data.completed
    if data.order is not None:
        item.order = data.order
    await db.flush()
    return ChecklistItemResponse.model_validate(item)


async def delete_checklist_item(
    db: AsyncSession, teacher: User, student_id: str, item_id: str
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    res = await db.execute(select(ChecklistItem).where(ChecklistItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    await db.delete(item)
    await db.flush()
    return {"message": "Checklist item deleted"}


# ─── Chapter Notes ───────────────────────────────────────

async def create_chapter_note(
    db: AsyncSession, teacher: User, student_id: str, chapter_id: str, data: ChapterNoteCreate
) -> ChapterNoteResponse:
    await _verify_student_ownership(db, teacher, student_id)
    chap = await _get_or_create_chapter_for_syllabus(db, chapter_id)
    note = ChapterNote(
        chapter_id=chap.id,
        text=data.text
    )
    db.add(note)
    await db.flush()
    res = await db.execute(
        select(ChapterNote).options(selectinload(ChapterNote.attachments)).where(ChapterNote.id == note.id)
    )
    return ChapterNoteResponse.model_validate(res.scalar_one())


async def update_chapter_note(
    db: AsyncSession, teacher: User, student_id: str, note_id: str, data: ChapterNoteUpdate
) -> ChapterNoteResponse:
    await _verify_student_ownership(db, teacher, student_id)
    res = await db.execute(
        select(ChapterNote).options(selectinload(ChapterNote.attachments)).where(ChapterNote.id == note_id)
    )
    note = res.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Chapter note not found")
    note.text = data.text
    await db.flush()
    return ChapterNoteResponse.model_validate(note)


async def delete_chapter_note(
    db: AsyncSession, teacher: User, student_id: str, note_id: str
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    res = await db.execute(select(ChapterNote).where(ChapterNote.id == note_id))
    note = res.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Chapter note not found")
    await db.delete(note)
    await db.flush()
    return {"message": "Chapter note deleted"}


# ─── Syllabus Attachments ────────────────────────────────

async def upload_syllabus_attachment(
    db: AsyncSession, teacher: User, student_id: str, file: UploadFile,
    checklist_item_id: str | None = None, chapter_note_id: str | None = None
) -> SyllabusAttachmentResponse:
    await _verify_student_ownership(db, teacher, student_id)
    
    contents = await file.read()
    filename = file.filename or "attachment"
    mime = file.content_type or "application/octet-stream"

    stored_path = await storage_service.upload_file_bytes(
        filename=filename,
        contents=contents,
        content_type=mime,
        folder="syllabus"
    )
    
    attachment = SyllabusAttachment(
        checklist_item_id=checklist_item_id,
        chapter_note_id=chapter_note_id,
        filename=filename,
        stored_path=stored_path,
        mime_type=mime,
        file_size=len(contents),
        uploaded_by=teacher.id
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)
    return SyllabusAttachmentResponse.model_validate(attachment)


async def delete_syllabus_attachment(
    db: AsyncSession, teacher: User, student_id: str, attachment_id: str
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    res = await db.execute(select(SyllabusAttachment).where(SyllabusAttachment.id == attachment_id))
    att = res.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    await storage_service.delete_file_by_path(att.stored_path)
        
    await db.delete(att)
    await db.flush()
    return {"message": "Attachment deleted"}


# ─── Tests ──────────────────────────────────────────────

async def create_test(
    db: AsyncSession, teacher: User, student_id: str, data: TestCreate
) -> TestResponse:
    await _verify_student_ownership(db, teacher, student_id)
    test = Test(
        student_id=student_id,
        subject=data.subject,
        exam_name=data.exam_name,
        exam_type=data.exam_type,
        max_marks=data.max_marks,
        obtained_marks=data.obtained_marks,
        remarks=data.remarks,
        exam_date=data.exam_date,
        question_paper_name=data.question_paper_name,
        question_paper_url=data.question_paper_url,
        answer_paper_name=data.answer_paper_name,
        answer_paper_url=data.answer_paper_url,
    )
    db.add(test)
    await db.flush()
    await db.refresh(test)
    return TestResponse(
        id=test.id, student_id=test.student_id, subject=test.subject,
        exam_name=test.exam_name, exam_type=test.exam_type,
        max_marks=test.max_marks, obtained_marks=test.obtained_marks,
        remarks=test.remarks, exam_date=test.exam_date,
        question_paper_name=getattr(test, "question_paper_name", None),
        question_paper_url=getattr(test, "question_paper_url", None),
        answer_paper_name=getattr(test, "answer_paper_name", None),
        answer_paper_url=getattr(test, "answer_paper_url", None),
        created_at=test.created_at.isoformat(),
    )


async def update_test(
    db: AsyncSession, teacher: User, student_id: str,
    test_id: str, data: TestUpdate
) -> TestResponse:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Test).where(
            Test.id == test_id,
            Test.student_id == student_id,
        )
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(test, field, value)
    await db.flush()
    await db.refresh(test)
    return TestResponse(
        id=test.id, student_id=test.student_id, subject=test.subject,
        exam_name=test.exam_name, exam_type=test.exam_type,
        max_marks=test.max_marks, obtained_marks=test.obtained_marks,
        remarks=test.remarks, exam_date=test.exam_date,
        question_paper_name=getattr(test, "question_paper_name", None),
        question_paper_url=getattr(test, "question_paper_url", None),
        answer_paper_name=getattr(test, "answer_paper_name", None),
        answer_paper_url=getattr(test, "answer_paper_url", None),
        created_at=test.created_at.isoformat(),
    )


async def delete_test(
    db: AsyncSession, teacher: User, student_id: str, test_id: str
) -> dict:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Test).where(
            Test.id == test_id,
            Test.student_id == student_id,
        )
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    await db.delete(test)
    await db.flush()
    return {"message": "Test deleted"}


async def list_tests(
    db: AsyncSession, teacher: User, student_id: str
) -> list[TestResponse]:
    await _verify_student_ownership(db, teacher, student_id)
    result = await db.execute(
        select(Test).where(Test.student_id == student_id)
        .order_by(Test.exam_date.desc().nulls_last(), Test.created_at.desc())
    )
    records = result.scalars().all()
    return [
        TestResponse(
            id=t.id, student_id=t.student_id, subject=t.subject,
            exam_name=t.exam_name, exam_type=t.exam_type,
            max_marks=t.max_marks, obtained_marks=t.obtained_marks,
            remarks=t.remarks, exam_date=t.exam_date,
            question_paper_name=getattr(t, "question_paper_name", None),
            question_paper_url=getattr(t, "question_paper_url", None),
            answer_paper_name=getattr(t, "answer_paper_name", None),
            answer_paper_url=getattr(t, "answer_paper_url", None),
            created_at=t.created_at.isoformat(),
        )
        for t in records
    ]


# ─── Calendar Month (Aggregated) ────────────────────────

async def get_calendar_month(
    db: AsyncSession, teacher: User, student_id: str,
    year: int, month: int
) -> CalendarMonthResponse:
    """Aggregate all calendar data for a student in a given month."""
    student = await _verify_student_ownership(db, teacher, student_id)

    # Get all data for the month in parallel queries
    attendance_list = await list_attendance(db, teacher, student_id, year, month)
    plans_list = await list_daily_plans(db, teacher, student_id, year, month)
    events_list = await list_calendar_events(db, teacher, student_id, year, month)
    homework_list = await list_homework(db, teacher, student_id, year, month)
    fee_list = await list_fee_records(db, teacher, student_id, year)

    # Build lookup maps
    attendance_map = {a.date.isoformat(): a for a in attendance_list}
    plans_map = {p.date.isoformat(): p for p in plans_list}
    events_map: dict[str, list] = {}
    for e in events_list:
        key = e.event_date.isoformat()
        events_map.setdefault(key, []).append(e)
    homework_map: dict[str, list] = {}
    for h in homework_list:
        if h.due_date:
            key = h.due_date.isoformat()
            homework_map.setdefault(key, []).append(h)

    # Fee status for the month
    target_fee_month = f"{year:04d}-{month:02d}"
    month_names = [
        "", "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    month_name = month_names[month]
    matched_fee = None
    for f in fee_list:
        if (getattr(f, "fee_month", None) == target_fee_month) or (f.month and f.month.lower() == month_name.lower() and f.year == year):
            matched_fee = f
            break

    month_fee_status = matched_fee.status if matched_fee else None
    month_paid_date = matched_fee.paid_date if matched_fee else None
    month_fee_amount = matched_fee.amount if matched_fee else None
    fee_due_day = getattr(student, "fee_due_day", None)

    # Check birthdays for students for this month
    teacher_students_res = await db.execute(
        select(Student).where(
            Student.date_of_birth.is_not(None)
        )
    )
    all_students_with_dob = teacher_students_res.scalars().all()
    birthdays_by_day: dict[int, list[Student]] = {}
    for s in all_students_with_dob:
        if s.date_of_birth and s.date_of_birth.month == month:
            birthdays_by_day.setdefault(s.date_of_birth.day, []).append(s)

    # Build days
    _, num_days = monthrange(year, month)
    days: dict[str, CalendarDayData] = {}

    for day_num in range(1, num_days + 1):
        d = date(year, month, day_num)
        key = d.isoformat()
        day_events = list(events_map.get(key, []))

        # Check birthdays
        birthday_students_today = birthdays_by_day.get(day_num, [])
        is_this_student_birthday = any(s.id == student_id for s in birthday_students_today)

        for b_student in birthday_students_today:
            day_events.append(
                CalendarEventResponse(
                    id=f"birthday-{b_student.id}-{key}",
                    student_id=b_student.id,
                    event_date=d,
                    title=f"🎂 {b_student.name}'s Birthday",
                    description=f"Happy Birthday {b_student.name}! 🎉",
                    event_type="reminder",
                    created_at=d.isoformat(),
                )
            )

        # Set fee_status ONLY on the exact day it was paid
        day_fee_status = "paid" if (month_fee_status == "paid" and month_paid_date == d) else None

        days[key] = CalendarDayData(
            date=d,
            attendance=attendance_map.get(key),
            daily_plan=plans_map.get(key),
            homework=homework_map.get(key, []),
            events=day_events,
            fee_status=day_fee_status,
            is_birthday=is_this_student_birthday,
        )

    return CalendarMonthResponse(
        year=year,
        month=month,
        days=days,
        month_fee_status=month_fee_status,
        month_paid_date=month_paid_date,
        month_fee_amount=month_fee_amount,
        fee_due_day=fee_due_day,
    )
