from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, extract, func
from calendar import monthrange
from datetime import date
from app.core.database import get_db
from app.core.deps import get_current_student
from app.models.user import User
from app.models.student import Student
from sqlalchemy.orm import selectinload
from app.models.academic import Attendance, DailyPlan, CalendarEvent, FeeRecord, Homework, Syllabus, Test, SyllabusChapter, ChecklistItem, ChapterNote, SyllabusAttachment, SyllabusDocument
from app.schemas.student import StudentResponse
from app.schemas.academic import (
    HomeworkResponse,
    SyllabusResponse,
    TestResponse,
    FeeRecordResponse,
    CalendarMonthResponse,
    CalendarDayData,
    AttendanceResponse,
    DailyPlanResponse,
    CalendarEventResponse,
    PortalFileResponse,
)

router = APIRouter(prefix="/portal", tags=["Student Portal"])

async def _get_student_for_user(db: AsyncSession, user: User) -> Student:
    # 1. First resolve using Student.user_id == authenticated_user.id
    result = await db.execute(select(Student).where(Student.user_id == user.id))
    student = result.scalar_one_or_none()
    if student:
        return student

    # 2. Recovery / linking mechanism using email (case-insensitive)
    if user.email:
        email_matches = await db.execute(
            select(Student).where(func.lower(Student.email) == func.lower(user.email))
        )
        matching_students = email_matches.scalars().all()
        if len(matching_students) > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple student profiles found for this email address. Please contact your teacher or administrator to resolve this link."
            )
        elif len(matching_students) == 1:
            student = matching_students[0]
            student.user_id = user.id
            db.add(student)
            await db.commit()
            await db.refresh(student)
            return student

    # 3. If no matching Student exists
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No student profile is linked to this account."
    )

# ─── Student Profile ───────────────────────────────────

@router.get("/profile", response_model=StudentResponse)
async def get_portal_profile(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve logged-in student's own profile."""
    student = await _get_student_for_user(db, current_student)
    from app.services.student_service import _student_to_response
    return _student_to_response(student)


# ─── Homework ──────────────────────────────────────────

@router.get("/homework", response_model=list[HomeworkResponse])
async def get_portal_homework(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve logged-in student's homework assignments (Read-only)."""
    student = await _get_student_for_user(db, current_student)
    result = await db.execute(
        select(Homework)
        .where(Homework.student_id == student.id)
        .order_by(Homework.created_at.desc())
    )
    records = result.scalars().all()
    return [
        HomeworkResponse(
            id=hw.id, student_id=hw.student_id, subject=hw.subject,
            title=hw.title, description=hw.description, due_date=hw.due_date,
            status=hw.status, created_at=hw.created_at.isoformat(),
        )
        for hw in records
    ]


# ─── Syllabus ──────────────────────────────────────────

@router.get("/syllabus", response_model=list[SyllabusResponse])
async def get_portal_syllabus(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve logged-in student's syllabus checklist."""
    student = await _get_student_for_user(db, current_student)
    result = await db.execute(
        select(Syllabus)
        .options(
            selectinload(Syllabus.chapters).options(
                selectinload(SyllabusChapter.checklist_items).options(
                    selectinload(ChecklistItem.attachments)
                ),
                selectinload(SyllabusChapter.notes).options(
                    selectinload(ChapterNote.attachments)
                ),
            )
        )
        .where(Syllabus.student_id == student.id)
        .order_by(Syllabus.sort_order.asc(), Syllabus.subject.asc())
    )
    return result.scalars().all()


@router.put("/syllabus/items/{item_id}/toggle")
async def toggle_portal_checklist_item(
    item_id: str,
    completed: bool = Query(...),
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Toggle completion of a checklist item from student portal."""
    student = await _get_student_for_user(db, current_student)
    res = await db.execute(
        select(ChecklistItem)
        .join(SyllabusChapter, ChecklistItem.chapter_id == SyllabusChapter.id)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id)
        .where(ChecklistItem.id == item_id, Syllabus.student_id == student.id)
    )
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    item.completed = completed
    await db.flush()
    return {"message": "Toggled item status", "completed": item.completed}


# ─── Test Marks ────────────────────────────────────────

@router.get("/tests", response_model=list[TestResponse])
async def get_portal_tests(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve logged-in student's test scores (Read-only)."""
    student = await _get_student_for_user(db, current_student)
    result = await db.execute(
        select(Test)
        .where(Test.student_id == student.id)
        .order_by(Test.exam_date.desc().nulls_last(), Test.created_at.desc())
    )
    records = result.scalars().all()
    return [
        TestResponse(
            id=t.id, student_id=t.student_id, subject=t.subject,
            exam_name=t.exam_name, exam_type=t.exam_type,
            max_marks=t.max_marks, obtained_marks=t.obtained_marks,
            remarks=t.remarks, exam_date=t.exam_date,
            question_paper_name=t.question_paper_name,
            question_paper_url=t.question_paper_url,
            answer_paper_name=t.answer_paper_name,
            answer_paper_url=t.answer_paper_url,
            created_at=t.created_at.isoformat(),
        )
        for t in records
    ]


# ─── Fees ──────────────────────────────────────────────

@router.get("/fees", response_model=list[FeeRecordResponse])
async def get_portal_fees(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve logged-in student's fee history (Read-only)."""
    student = await _get_student_for_user(db, current_student)
    result = await db.execute(
        select(FeeRecord)
        .where(FeeRecord.student_id == student.id)
        .order_by(FeeRecord.fee_month.desc())
    )
    return result.scalars().all()


# ─── Calendar Month (Aggregated) ────────────────────────

@router.get("/calendar", response_model=CalendarMonthResponse)
async def get_portal_calendar(
    year: int = Query(..., description="Year"),
    month: int = Query(..., description="Month (1-12)"),
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full month calendar details for logged-in student (Read-only)."""
    student = await _get_student_for_user(db, current_student)
    student_id = student.id

    # 1. Fetch attendance
    att_res = await db.execute(
        select(Attendance).where(
            Attendance.student_id == student_id,
            extract("year", Attendance.date) == year,
            extract("month", Attendance.date) == month,
        ).order_by(Attendance.date.asc())
    )
    attendance_list = [AttendanceResponse.model_validate(r) for r in att_res.scalars().all()]

    # 2. Fetch daily plans
    dp_res = await db.execute(
        select(DailyPlan).where(
            DailyPlan.student_id == student_id,
            extract("year", DailyPlan.date) == year,
            extract("month", DailyPlan.date) == month,
        ).order_by(DailyPlan.date.asc())
    )
    plans_list = [DailyPlanResponse.model_validate(r) for r in dp_res.scalars().all()]

    # 3. Fetch events
    ev_res = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.student_id == student_id,
            extract("year", CalendarEvent.event_date) == year,
            extract("month", CalendarEvent.event_date) == month,
        ).order_by(CalendarEvent.event_date.asc())
    )
    events_list = [CalendarEventResponse.model_validate(r) for r in ev_res.scalars().all()]

    # 4. Fetch homework
    hw_res = await db.execute(
        select(Homework).where(
            Homework.student_id == student_id,
            extract("year", Homework.due_date) == year,
            extract("month", Homework.due_date) == month,
        ).order_by(Homework.created_at.desc())
    )
    homework_list = [
        HomeworkResponse(
            id=hw.id, student_id=hw.student_id, subject=hw.subject,
            title=hw.title, description=hw.description, due_date=hw.due_date,
            status=hw.status, created_at=hw.created_at.isoformat(),
        )
        for hw in hw_res.scalars().all()
    ]

    target_fee_month = f"{year:04d}-{month:02d}"
    fee_res = await db.execute(
        select(FeeRecord).where(
            FeeRecord.student_id == student_id,
            (FeeRecord.year == year) | (FeeRecord.fee_month == target_fee_month)
        )
    )
    fee_list = fee_res.scalars().all()

    # Build maps
    attendance_map = {a.date.isoformat(): a for a in attendance_list}
    plans_map = {p.date.isoformat(): p for p in plans_list}
    
    events_map = {}
    for e in events_list:
        key = e.event_date.isoformat()
        events_map.setdefault(key, []).append(e)
        
    homework_map = {}
    for h in homework_list:
        if h.due_date:
            key = h.due_date.isoformat()
            homework_map.setdefault(key, []).append(h)

    # Fee status matching the specific month
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

    # Check student birthday for this month
    dob = getattr(student, "date_of_birth", None)
    birthday_day = dob.day if (dob and dob.month == month) else None

    # Build response days
    _, num_days = monthrange(year, month)
    days = {}

    for day_num in range(1, num_days + 1):
        d = date(year, month, day_num)
        key = d.isoformat()
        day_events = list(events_map.get(key, []))
        is_birthday = (birthday_day == day_num)

        if is_birthday:
            day_events.append(
                CalendarEventResponse(
                    id=f"birthday-{key}",
                    student_id=student_id,
                    event_date=d,
                    title=f"🎂 Happy Birthday {student.name}!",
                    description=f"Wishing you a fantastic birthday! 🎉",
                    event_type="reminder",
                    created_at=d.isoformat(),
                )
            )

        # Set fee_status ONLY on exact paid date
        day_fee_status = "paid" if (month_fee_status == "paid" and month_paid_date == d) else None

        days[key] = CalendarDayData(
            date=d,
            attendance=attendance_map.get(key),
            daily_plan=plans_map.get(key),
            homework=homework_map.get(key, []),
            events=day_events,
            fee_status=day_fee_status,
            is_birthday=is_birthday,
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


# ─── AI Plans (Phase 9) ────────────────────────────────

from app.schemas.extended import AIPlanResponse
from app.models.academic import AIPlan

@router.get("/ai/plans", response_model=list[AIPlanResponse])
async def get_portal_ai_plans(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve logged-in student's AI lesson plans (Read-only)."""
    student = await _get_student_for_user(db, current_student)
    result = await db.execute(
        select(AIPlan)
        .where(AIPlan.student_id == student.id)
        .order_by(AIPlan.created_at.desc())
    )
    plans = result.scalars().all()
    return [
        AIPlanResponse(
            id=p.id,
            student_id=p.student_id,
            plan_date=p.plan_date,
            generated_plan=p.generated_plan,
            edited_plan=p.edited_plan,
            prompt_used=p.prompt_used,
            created_at=p.created_at.isoformat()
        )
        for p in plans
    ]


# ─── Files Manager (Aggregated Student Files) ──────────

@router.get("/files", response_model=list[PortalFileResponse])
async def get_portal_files(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all aggregated files shared with or uploaded for the logged-in student."""
    student = await _get_student_for_user(db, current_student)
    files: list[PortalFileResponse] = []

    # 1. Homework Attachments
    hw_res = await db.execute(
        select(Homework).where(
            Homework.student_id == student.id,
            Homework.attachment_url.isnot(None)
        )
    )
    for hw in hw_res.scalars().all():
        if hw.attachment_url:
            files.append(
                PortalFileResponse(
                    id=f"hw-{hw.id}",
                    name=hw.attachment_name or f"Homework - {hw.subject}",
                    url=hw.attachment_url,
                    category="homework",
                    source_label=f"Homework: {hw.subject} - {hw.title}",
                    created_at=hw.created_at.isoformat()
                )
            )

    # 2. Test Question Papers & Answer Sheets
    test_res = await db.execute(
        select(Test).where(Test.student_id == student.id)
    )
    for t in test_res.scalars().all():
        if t.question_paper_url:
            files.append(
                PortalFileResponse(
                    id=f"test-qp-{t.id}",
                    name=t.question_paper_name or f"Question Paper ({t.subject})",
                    url=t.question_paper_url,
                    category="exams",
                    source_label=f"Exam: {t.subject} - {t.exam_name} (Question Paper)",
                    created_at=t.created_at.isoformat()
                )
            )
        if t.answer_paper_url:
            files.append(
                PortalFileResponse(
                    id=f"test-ap-{t.id}",
                    name=t.answer_paper_name or f"Answer Sheet ({t.subject})",
                    url=t.answer_paper_url,
                    category="exams",
                    source_label=f"Exam: {t.subject} - {t.exam_name} (Answer Sheet)",
                    created_at=t.created_at.isoformat()
                )
            )

    # 3. Syllabus Attachments (Checklist Items & Chapter Notes)
    syllabus_attachments_res = await db.execute(
        select(SyllabusAttachment)
        .join(ChecklistItem, SyllabusAttachment.checklist_item_id == ChecklistItem.id, isouter=True)
        .join(ChapterNote, SyllabusAttachment.chapter_note_id == ChapterNote.id, isouter=True)
        .join(SyllabusChapter, (ChecklistItem.chapter_id == SyllabusChapter.id) | (ChapterNote.chapter_id == SyllabusChapter.id), isouter=True)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id, isouter=True)
        .where(Syllabus.student_id == student.id)
    )
    for att in syllabus_attachments_res.scalars().all():
        file_url = att.stored_path
        if not file_url.startswith("data:") and not file_url.startswith("http") and not file_url.startswith("/"):
            file_url = f"/uploads/syllabus/{att.stored_path}"

        files.append(
            PortalFileResponse(
                id=f"syl-att-{att.id}",
                name=att.filename,
                url=file_url,
                category="syllabus",
                source_label="Syllabus Chapter Resource",
                file_size=att.file_size,
                created_at=att.created_at.isoformat()
            )
        )

    # 4. Syllabus Documents
    syllabus_docs_res = await db.execute(
        select(SyllabusDocument).where(SyllabusDocument.student_id == student.id)
    )
    for doc in syllabus_docs_res.scalars().all():
        files.append(
            PortalFileResponse(
                id=f"syl-doc-{doc.id}",
                name=doc.file_name,
                url=doc.file_url,
                category="syllabus",
                source_label="Center Syllabus Document",
                file_size=doc.file_size,
                created_at=doc.created_at.isoformat()
            )
        )

    # Sort files newest first
    files.sort(key=lambda x: x.created_at, reverse=True)
    return files

