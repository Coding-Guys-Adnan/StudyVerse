from fastapi import APIRouter, Depends, Query, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.models.user import User
from datetime import date
from app.schemas.academic import (
    AttendanceCreate, AttendanceResponse,
    DailyPlanCreate, DailyPlanResponse,
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse,
    FeeRecordCreate, FeeRecordUpdate, FeeRecordResponse, FeeToggleRequest,
    HomeworkCreate, HomeworkUpdate, HomeworkResponse,
    SyllabusCreate, SyllabusUpdate, SyllabusResponse,
    SyllabusChapterCreate, SyllabusChapterUpdate, SyllabusChapterResponse,
    ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemResponse,
    ChapterNoteCreate, ChapterNoteUpdate, ChapterNoteResponse,
    SyllabusAttachmentResponse,
    TestCreate, TestUpdate, TestResponse,
    CalendarMonthResponse,
)
from app.services import academic_service

router = APIRouter(prefix="/students/{student_id}", tags=["Academic & Calendar"])

# ─── Calendar Month aggregation ─────────────────────────

@router.get("/calendar", response_model=CalendarMonthResponse)
async def get_calendar_month(
    student_id: str,
    year: int = Query(..., description="Year"),
    month: int = Query(..., description="Month (1-12)"),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full month calendar data, aggregated with attendance, events, daily plans, homework."""
    return await academic_service.get_calendar_month(db, teacher, student_id, year, month)


# ─── Attendance ──────────────────────────────────────────

@router.post("/attendance", response_model=AttendanceResponse)
async def mark_attendance(
    student_id: str,
    data: AttendanceCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Mark attendance for a specific date (creates or updates)."""
    return await academic_service.upsert_attendance(db, teacher, student_id, data)


@router.delete("/attendance", status_code=status.HTTP_200_OK)
async def remove_attendance(
    student_id: str,
    attendance_date: date = Query(...),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Remove attendance for a specific date."""
    return await academic_service.delete_attendance(db, teacher, student_id, attendance_date)


# ─── Daily Plans ────────────────────────────────────────

@router.post("/daily-plans", response_model=DailyPlanResponse)
async def save_daily_plan(
    student_id: str,
    data: DailyPlanCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Save topics to teach / notes for a specific day."""
    return await academic_service.upsert_daily_plan(db, teacher, student_id, data)


# ─── Calendar Events ────────────────────────────────────

@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def add_calendar_event(
    student_id: str,
    data: CalendarEventCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Create a new calendar event (exam, class, reminder, other) for a student."""
    return await academic_service.create_calendar_event(db, teacher, student_id, data)


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
async def update_calendar_event(
    student_id: str,
    event_id: str,
    data: CalendarEventUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update calendar event details."""
    return await academic_service.update_calendar_event(db, teacher, student_id, event_id, data)


@router.delete("/events/{event_id}")
async def delete_calendar_event(
    student_id: str,
    event_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a calendar event."""
    return await academic_service.delete_calendar_event(db, teacher, student_id, event_id)


# ─── Fee Records ────────────────────────────────────────

@router.post("/fees", response_model=FeeRecordResponse, status_code=status.HTTP_201_CREATED)
async def add_fee_record(
    student_id: str,
    data: FeeRecordCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Add a fee record for a student."""
    return await academic_service.create_fee_record(db, teacher, student_id, data)


@router.put("/fees/{fee_id}", response_model=FeeRecordResponse)
async def update_fee_record(
    student_id: str,
    fee_id: str,
    data: FeeRecordUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update status, amount, date, or notes of a fee record."""
    return await academic_service.update_fee_record(db, teacher, student_id, fee_id, data)


@router.post("/fees/toggle", response_model=FeeRecordResponse)
async def toggle_fee_status(
    student_id: str,
    data: FeeToggleRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Toggle fee status (paid/pending) for a student's month, creating or updating the record."""
    return await academic_service.upsert_fee_record(db, teacher, student_id, data)


@router.get("/fees", response_model=list[FeeRecordResponse])
async def get_fee_records(
    student_id: str,
    year: int | None = Query(None),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get all fee records for a student."""
    return await academic_service.list_fee_records(db, teacher, student_id, year)


# ─── Homework ───────────────────────────────────────────

@router.post("/homework", response_model=HomeworkResponse, status_code=status.HTTP_201_CREATED)
async def create_homework_task(
    student_id: str,
    data: HomeworkCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Create homework assignment for a student."""
    return await academic_service.create_homework(db, teacher, student_id, data)


@router.put("/homework/{homework_id}", response_model=HomeworkResponse)
async def update_homework_task(
    student_id: str,
    homework_id: str,
    data: HomeworkUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update homework details or status (completed/incomplete)."""
    return await academic_service.update_homework(db, teacher, student_id, homework_id, data)


@router.delete("/homework/{homework_id}")
async def delete_homework_task(
    student_id: str,
    homework_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete homework assignment."""
    return await academic_service.delete_homework(db, teacher, student_id, homework_id)


@router.get("/homework", response_model=list[HomeworkResponse])
async def get_homework(
    student_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get all homework assignments for a student."""
    return await academic_service.list_homework(db, teacher, student_id)


# ─── Syllabus ───────────────────────────────────────────

@router.post("/syllabus", response_model=SyllabusResponse, status_code=status.HTTP_201_CREATED)
async def create_syllabus_item(
    student_id: str,
    data: SyllabusCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Add a new chapter/item to a student's syllabus."""
    return await academic_service.create_syllabus(db, teacher, student_id, data)


@router.put("/syllabus/{syllabus_id}", response_model=SyllabusResponse)
async def update_syllabus_item(
    student_id: str,
    syllabus_id: str,
    data: SyllabusUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update progress, status, sorting order of a syllabus item."""
    return await academic_service.update_syllabus(db, teacher, student_id, syllabus_id, data)


@router.delete("/syllabus/{syllabus_id}")
async def delete_syllabus_item(
    student_id: str,
    syllabus_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Remove a syllabus item."""
    return await academic_service.delete_syllabus(db, teacher, student_id, syllabus_id)


@router.get("/syllabus", response_model=list[SyllabusResponse])
async def get_student_syllabus(
    student_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """List a student's syllabus checklist."""
    return await academic_service.list_syllabus(db, teacher, student_id)


# ─── Chapters ───────────────────────────────────────────

@router.post("/syllabus/{syllabus_id}/chapters", response_model=SyllabusChapterResponse, status_code=status.HTTP_201_CREATED)
async def create_syllabus_chapter(
    student_id: str,
    syllabus_id: str,
    data: SyllabusChapterCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Add a new chapter under a syllabus subject."""
    return await academic_service.create_syllabus_chapter(db, teacher, student_id, syllabus_id, data)


@router.put("/syllabus/chapters/{chapter_id}", response_model=SyllabusChapterResponse)
async def update_syllabus_chapter(
    student_id: str,
    chapter_id: str,
    data: SyllabusChapterUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update a chapter's title or order."""
    return await academic_service.update_syllabus_chapter(db, teacher, student_id, chapter_id, data)


@router.delete("/syllabus/chapters/{chapter_id}")
async def delete_syllabus_chapter(
    student_id: str,
    chapter_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a syllabus chapter."""
    return await academic_service.delete_syllabus_chapter(db, teacher, student_id, chapter_id)


# ─── Checklist Items ─────────────────────────────────────

@router.post("/syllabus/chapters/{chapter_id}/items", response_model=ChecklistItemResponse, status_code=status.HTTP_201_CREATED)
async def create_checklist_item(
    student_id: str,
    chapter_id: str,
    data: ChecklistItemCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Add a new custom checklist item under a chapter."""
    return await academic_service.create_checklist_item(db, teacher, student_id, chapter_id, data)


@router.put("/syllabus/items/{item_id}", response_model=ChecklistItemResponse)
async def update_checklist_item(
    student_id: str,
    item_id: str,
    data: ChecklistItemUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update text or completion status of a checklist item."""
    return await academic_service.update_checklist_item(db, teacher, student_id, item_id, data)


@router.delete("/syllabus/items/{item_id}")
async def delete_checklist_item(
    student_id: str,
    item_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a checklist item."""
    return await academic_service.delete_checklist_item(db, teacher, student_id, item_id)


# ─── Chapter Notes ───────────────────────────────────────

@router.post("/syllabus/chapters/{chapter_id}/notes", response_model=ChapterNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_chapter_note(
    student_id: str,
    chapter_id: str,
    data: ChapterNoteCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Add a custom multiline note to a chapter."""
    return await academic_service.create_chapter_note(db, teacher, student_id, chapter_id, data)


@router.put("/syllabus/notes/{note_id}", response_model=ChapterNoteResponse)
async def update_chapter_note(
    student_id: str,
    note_id: str,
    data: ChapterNoteUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update custom text of a chapter note."""
    return await academic_service.update_chapter_note(db, teacher, student_id, note_id, data)


@router.delete("/syllabus/notes/{note_id}")
async def delete_chapter_note(
    student_id: str,
    note_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a chapter note."""
    return await academic_service.delete_chapter_note(db, teacher, student_id, note_id)


# ─── Syllabus Attachments ────────────────────────────────

@router.post("/syllabus/attachments", response_model=SyllabusAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_syllabus_attachment(
    student_id: str,
    checklist_item_id: str = Query(None),
    chapter_note_id: str = Query(None),
    file: UploadFile = File(...),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Upload PDF, JPG, JPEG, PNG attachment for a checklist item or chapter note."""
    return await academic_service.upload_syllabus_attachment(
        db, teacher, student_id, file, checklist_item_id=checklist_item_id, chapter_note_id=chapter_note_id
    )


@router.delete("/syllabus/attachments/{attachment_id}")
async def delete_syllabus_attachment(
    student_id: str,
    attachment_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a syllabus attachment."""
    return await academic_service.delete_syllabus_attachment(db, teacher, student_id, attachment_id)


# ─── Tests ──────────────────────────────────────────────

@router.post("/tests", response_model=TestResponse, status_code=status.HTTP_201_CREATED)
async def create_test_record(
    student_id: str,
    data: TestCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Log an exam/test score for a student."""
    return await academic_service.create_test(db, teacher, student_id, data)


@router.put("/tests/{test_id}", response_model=TestResponse)
async def update_test_record(
    student_id: str,
    test_id: str,
    data: TestUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update exam score details."""
    return await academic_service.update_test(db, teacher, student_id, test_id, data)


@router.delete("/tests/{test_id}")
async def delete_test_record(
    student_id: str,
    test_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Remove test score record."""
    return await academic_service.delete_test(db, teacher, student_id, test_id)


@router.get("/tests", response_model=list[TestResponse])
async def get_test_records(
    student_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get list of exams/tests logged for a student."""
    return await academic_service.list_tests(db, teacher, student_id)


# ─── Syllabus Documents (Phase 5) ──────────────────────

from fastapi import UploadFile, File
from app.schemas.extended import SyllabusDocumentResponse, SyllabusDocumentUploadResponse
from app.services import syllabus_service

@router.post("/syllabus/upload", response_model=SyllabusDocumentUploadResponse)
async def upload_syllabus(
    student_id: str,
    file: UploadFile = File(...),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Upload PDF/DOCX syllabus document and extract chapters."""
    return await syllabus_service.upload_syllabus_doc(db, teacher.id, student_id, file)


@router.get("/syllabus/documents", response_model=list[SyllabusDocumentResponse])
async def list_syllabus_documents(
    student_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded syllabus documents for a student."""
    return await syllabus_service.list_syllabus_docs(db, teacher.id, student_id)

