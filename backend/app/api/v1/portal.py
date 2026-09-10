from fastapi import APIRouter, Depends, Query, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, extract, func
from calendar import monthrange
from datetime import date
from app.core.database import get_db
from app.core.deps import get_current_student
from app.models.user import User
from app.models.student import Student
from sqlalchemy.orm import selectinload
from app.models.academic import (
    Attendance, DailyPlan, CalendarEvent, FeeRecord, Homework,
    Syllabus, Test, SyllabusChapter, ChecklistItem, ChapterNote,
    SyllabusAttachment, SyllabusDocument
)
from app.schemas.student import StudentResponse
from app.schemas.student_teacher import StudentEffectivePermissionsResponse
from app.services.permission_service import (
    require_student_permission,
    get_student_effective_permissions,
)
from app.services import storage_service
from app.schemas.academic import (
    HomeworkResponse,
    HomeworkCreate,
    HomeworkUpdate,
    SyllabusResponse,
    SyllabusCreate,
    SyllabusUpdate,
    SyllabusChapterCreate,
    SyllabusChapterUpdate,
    SyllabusChapterResponse,
    ChecklistItemCreate,
    ChecklistItemUpdate,
    ChecklistItemResponse,
    ChapterNoteCreate,
    ChapterNoteResponse,
    SyllabusAttachmentResponse,
    CalendarEventCreate,
    CalendarEventUpdate,
    TestResponse,
    TestCreate,
    TestUpdate,
    FeeRecordResponse,
    CalendarMonthResponse,
    CalendarDayData,
    AttendanceResponse,
    DailyPlanResponse,
    CalendarEventResponse,
    PortalFileResponse,
)

router = APIRouter(prefix="/portal", tags=["Student Portal"])


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

# ─── Student Profile & Permissions ───────────────────────

@router.get("/profile", response_model=StudentResponse)
async def get_portal_profile(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve logged-in student's own profile."""
    student = await _get_student_for_user(db, current_student)
    from app.services.student_service import _student_to_response
    return _student_to_response(student)


@router.get("/permissions", response_model=StudentEffectivePermissionsResponse)
async def get_portal_permissions(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve logged-in student's effective and per-teacher permissions."""
    student = await _get_student_for_user(db, current_student)
    effective_perms, teacher_perms = await get_student_effective_permissions(db, student.id)
    return StudentEffectivePermissionsResponse(
        student_id=student.id,
        effective_permissions=effective_perms,
        teacher_permissions=teacher_perms,
    )


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


@router.post("/homework", response_model=HomeworkResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_homework(
    data: HomeworkCreate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Create a student personal homework assignment (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "homework", "can_edit")
    hw = Homework(
        student_id=student.id,
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


@router.put("/homework/{homework_id}", response_model=HomeworkResponse)
async def update_portal_homework(
    homework_id: str,
    data: HomeworkUpdate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Update homework assignment (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "homework", "can_edit")
    res = await db.execute(
        select(Homework).where(
            Homework.id == homework_id,
            Homework.student_id == student.id,
        )
    )
    hw = res.scalar_one_or_none()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(hw, field, val)
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


@router.delete("/homework/{homework_id}")
async def delete_portal_homework(
    homework_id: str,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Delete homework assignment (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "homework", "can_edit")
    res = await db.execute(
        select(Homework).where(
            Homework.id == homework_id,
            Homework.student_id == student.id,
        )
    )
    hw = res.scalar_one_or_none()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
    await db.delete(hw)
    await db.flush()
    return {"message": "Homework deleted successfully"}


@router.post("/homework/upload")
async def upload_portal_homework_attachment(
    file: UploadFile = File(...),
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Upload an attachment for a homework task (Requires can_import)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "homework", "can_import")
    contents = await file.read()
    stored_path = await storage_service.upload_file_bytes(
        file.filename or "homework_attachment",
        contents,
        file.content_type or "application/octet-stream",
        folder="homework",
    )
    return {"filename": file.filename, "url": stored_path}


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

    chap_res = await db.execute(
        select(SyllabusChapter).where(SyllabusChapter.id == item.chapter_id)
    )
    chapter = chap_res.scalar_one_or_none()
    if chapter:
        syl_res = await db.execute(
            select(Syllabus).where(Syllabus.id == chapter.syllabus_id)
        )
        syl = syl_res.scalar_one_or_none()
        if syl:
            items_res = await db.execute(
                select(ChecklistItem)
                .join(SyllabusChapter, ChecklistItem.chapter_id == SyllabusChapter.id)
                .where(SyllabusChapter.syllabus_id == syl.id)
            )
            all_items = items_res.scalars().all()
            if all_items:
                comp_count = sum(1 for ci in all_items if ci.completed)
                calc_prog = round((comp_count / len(all_items)) * 100)
                syl.progress = calc_prog
                if calc_prog == 100:
                    syl.status = "completed"
                elif calc_prog > 0:
                    syl.status = "teaching"
                else:
                    syl.status = "pending"
                await db.flush()

    return {"message": "Toggled item status", "completed": item.completed}


@router.post("/syllabus", response_model=SyllabusResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_syllabus(
    data: SyllabusCreate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Create syllabus topic (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    entry = Syllabus(
        student_id=student.id,
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
    chap = SyllabusChapter(
        syllabus_id=entry.id,
        title=data.chapter,
        order=0,
    )
    db.add(chap)
    await db.flush()
    res = await db.execute(
        select(Syllabus).options(*_syllabus_options()).where(Syllabus.id == entry.id)
    )
    return SyllabusResponse.model_validate(res.scalar_one())


@router.put("/syllabus/{syllabus_id}", response_model=SyllabusResponse)
async def update_portal_syllabus(
    syllabus_id: str,
    data: SyllabusUpdate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Update syllabus entry (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(Syllabus).options(*_syllabus_options()).where(
            Syllabus.id == syllabus_id,
            Syllabus.student_id == student.id,
        )
    )
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Syllabus entry not found")
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(entry, k, v)
    await db.flush()
    return SyllabusResponse.model_validate(entry)


@router.delete("/syllabus/{syllabus_id}")
async def delete_portal_syllabus(
    syllabus_id: str,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Delete syllabus entry (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(Syllabus).where(
            Syllabus.id == syllabus_id,
            Syllabus.student_id == student.id,
        )
    )
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Syllabus entry not found")
    await db.delete(entry)
    await db.flush()
    return {"message": "Syllabus entry deleted"}


@router.post("/syllabus/{syllabus_id}/chapters", response_model=SyllabusChapterResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_syllabus_chapter(
    syllabus_id: str,
    data: SyllabusChapterCreate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Add chapter under syllabus topic (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(Syllabus).where(Syllabus.id == syllabus_id, Syllabus.student_id == student.id)
    )
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Syllabus entry not found")
    chap = SyllabusChapter(
        syllabus_id=syllabus_id,
        title=data.title,
        order=data.order,
    )
    db.add(chap)
    await db.flush()
    await db.refresh(chap)
    return SyllabusChapterResponse.model_validate(chap)


@router.put("/syllabus/chapters/{chapter_id}", response_model=SyllabusChapterResponse)
async def update_portal_syllabus_chapter(
    chapter_id: str,
    data: SyllabusChapterUpdate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Update syllabus chapter (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(SyllabusChapter)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id)
        .where(SyllabusChapter.id == chapter_id, Syllabus.student_id == student.id)
    )
    chap = res.scalar_one_or_none()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if data.title is not None:
        chap.title = data.title
    if data.order is not None:
        chap.order = data.order
    await db.flush()
    await db.refresh(chap)
    return SyllabusChapterResponse.model_validate(chap)


@router.delete("/syllabus/chapters/{chapter_id}")
async def delete_portal_syllabus_chapter(
    chapter_id: str,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Delete syllabus chapter (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(SyllabusChapter)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id)
        .where(SyllabusChapter.id == chapter_id, Syllabus.student_id == student.id)
    )
    chap = res.scalar_one_or_none()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found")
    await db.delete(chap)
    await db.flush()
    return {"message": "Chapter deleted"}


@router.post("/syllabus/chapters/{chapter_id}/items", response_model=ChecklistItemResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_checklist_item(
    chapter_id: str,
    data: ChecklistItemCreate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Add checklist item under chapter (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(SyllabusChapter)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id)
        .where(SyllabusChapter.id == chapter_id, Syllabus.student_id == student.id)
    )
    chap = res.scalar_one_or_none()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found")
    item = ChecklistItem(
        chapter_id=chap.id,
        text=data.text,
        completed=data.completed,
        order=data.order,
    )
    db.add(item)
    await db.flush()
    loaded = await db.execute(
        select(ChecklistItem).options(selectinload(ChecklistItem.attachments)).where(ChecklistItem.id == item.id)
    )
    return ChecklistItemResponse.model_validate(loaded.scalar_one())


@router.put("/syllabus/items/{item_id}", response_model=ChecklistItemResponse)
async def update_portal_checklist_item_details(
    item_id: str,
    data: ChecklistItemUpdate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Update checklist item text/order (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(ChecklistItem)
        .join(SyllabusChapter, ChecklistItem.chapter_id == SyllabusChapter.id)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id)
        .where(ChecklistItem.id == item_id, Syllabus.student_id == student.id)
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
    loaded = await db.execute(
        select(ChecklistItem).options(selectinload(ChecklistItem.attachments)).where(ChecklistItem.id == item.id)
    )
    return ChecklistItemResponse.model_validate(loaded.scalar_one())


@router.delete("/syllabus/items/{item_id}")
async def delete_portal_checklist_item(
    item_id: str,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Delete checklist item (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(ChecklistItem)
        .join(SyllabusChapter, ChecklistItem.chapter_id == SyllabusChapter.id)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id)
        .where(ChecklistItem.id == item_id, Syllabus.student_id == student.id)
    )
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    await db.delete(item)
    await db.flush()
    return {"message": "Checklist item deleted"}


@router.post("/syllabus/chapters/{chapter_id}/notes", response_model=ChapterNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_chapter_note(
    chapter_id: str,
    data: ChapterNoteCreate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Add note under chapter (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(SyllabusChapter)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id)
        .where(SyllabusChapter.id == chapter_id, Syllabus.student_id == student.id)
    )
    chap = res.scalar_one_or_none()
    if not chap:
        raise HTTPException(status_code=404, detail="Chapter not found")
    note = ChapterNote(chapter_id=chap.id, text=data.text)
    db.add(note)
    await db.flush()
    loaded = await db.execute(
        select(ChapterNote).options(selectinload(ChapterNote.attachments)).where(ChapterNote.id == note.id)
    )
    return ChapterNoteResponse.model_validate(loaded.scalar_one())


@router.delete("/syllabus/notes/{note_id}")
async def delete_portal_chapter_note(
    note_id: str,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Delete note under chapter (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_edit")
    res = await db.execute(
        select(ChapterNote)
        .join(SyllabusChapter, ChapterNote.chapter_id == SyllabusChapter.id)
        .join(Syllabus, SyllabusChapter.syllabus_id == Syllabus.id)
        .where(ChapterNote.id == note_id, Syllabus.student_id == student.id)
    )
    note = res.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.flush()
    return {"message": "Note deleted"}


@router.post("/syllabus/attachments", response_model=SyllabusAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_portal_syllabus_attachment(
    checklist_item_id: str | None = Query(None),
    chapter_note_id: str | None = Query(None),
    file: UploadFile = File(...),
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Upload syllabus attachment (Requires can_import)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_import")
    if not checklist_item_id and not chapter_note_id:
        raise HTTPException(status_code=400, detail="Must provide checklist_item_id or chapter_note_id")

    contents = await file.read()
    stored_path = await storage_service.upload_file_bytes(
        file.filename or "attachment", contents, file.content_type or "application/octet-stream", folder="syllabus"
    )
    att = SyllabusAttachment(
        checklist_item_id=checklist_item_id,
        chapter_note_id=chapter_note_id,
        filename=file.filename or "attachment",
        stored_path=stored_path,
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(contents),
        uploaded_by=current_student.id,
    )
    db.add(att)
    await db.flush()
    await db.refresh(att)
    return SyllabusAttachmentResponse.model_validate(att)


@router.post("/syllabus/import", response_model=list[SyllabusResponse], status_code=status.HTTP_201_CREATED)
async def import_portal_syllabus(
    items: list[SyllabusCreate],
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Batch import syllabus items (Requires can_import)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "syllabus", "can_import")
    created_list = []
    for data in items:
        entry = Syllabus(
            student_id=student.id,
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
        chap = SyllabusChapter(syllabus_id=entry.id, title=data.chapter, order=0)
        db.add(chap)
        await db.flush()
        res = await db.execute(
            select(Syllabus).options(*_syllabus_options()).where(Syllabus.id == entry.id)
        )
        created_list.append(SyllabusResponse.model_validate(res.scalar_one()))
    return created_list


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


@router.post("/tests", response_model=TestResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_test(
    data: TestCreate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Log test score (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "tests", "can_edit")
    t = Test(
        student_id=student.id,
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
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return TestResponse(
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


@router.put("/tests/{test_id}", response_model=TestResponse)
async def update_portal_test(
    test_id: str,
    data: TestUpdate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Update test score (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "tests", "can_edit")
    res = await db.execute(
        select(Test).where(
            Test.id == test_id,
            Test.student_id == student.id,
        )
    )
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Test record not found")
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(t, k, v)
    await db.flush()
    await db.refresh(t)
    return TestResponse(
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


@router.delete("/tests/{test_id}")
async def delete_portal_test(
    test_id: str,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Delete test record (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "tests", "can_edit")
    res = await db.execute(
        select(Test).where(
            Test.id == test_id,
            Test.student_id == student.id,
        )
    )
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Test record not found")
    await db.delete(t)
    await db.flush()
    return {"message": "Test record deleted"}


@router.post("/tests/upload")
async def upload_portal_test_paper(
    file: UploadFile = File(...),
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Upload exam question paper or answer sheet (Requires can_import)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "tests", "can_import")
    contents = await file.read()
    stored_path = await storage_service.upload_file_bytes(
        file.filename or "exam_paper", contents, file.content_type or "application/octet-stream", folder="exams"
    )
    return {"filename": file.filename, "url": stored_path}


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

    # Check all students' birthdays for this month so classmates can see them
    all_students_res = await db.execute(
        select(Student).where(Student.date_of_birth.is_not(None))
    )
    all_active_students = all_students_res.scalars().all()

    # Group students with birthdays in this month by day
    birthdays_by_day: dict[int, list[Student]] = {}
    for s in all_active_students:
        if s.date_of_birth and s.date_of_birth.month == month:
            birthdays_by_day.setdefault(s.date_of_birth.day, []).append(s)

    # Trigger automatic birthday announcements check
    from app.services.announcement_service import check_and_create_birthday_announcements
    await check_and_create_birthday_announcements(db)

    # Build response days
    _, num_days = monthrange(year, month)
    days = {}

    for day_num in range(1, num_days + 1):
        d = date(year, month, day_num)
        key = d.isoformat()
        day_events = list(events_map.get(key, []))

        # Check if any student has a birthday on this day
        birthday_students_today = birthdays_by_day.get(day_num, [])
        is_own_birthday = any(s.id == student_id for s in birthday_students_today)

        for b_student in birthday_students_today:
            if b_student.id == student_id:
                day_events.append(
                    CalendarEventResponse(
                        id=f"birthday-{b_student.id}-{key}",
                        student_id=student_id,
                        event_date=d,
                        title=f"🎂 Happy Birthday {b_student.name}!",
                        description="Wishing you a fantastic birthday! 🎉",
                        event_type="reminder",
                        created_at=d.isoformat(),
                    )
                )
            else:
                day_events.append(
                    CalendarEventResponse(
                        id=f"birthday-{b_student.id}-{key}",
                        student_id=b_student.id,
                        event_date=d,
                        title=f"🎂 {b_student.name}'s Birthday",
                        description=f"Wishing {b_student.name} a very Happy Birthday! 🎉",
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
            is_birthday=is_own_birthday,
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


@router.post("/calendar/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_portal_calendar_event(
    data: CalendarEventCreate,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Create a personal calendar event / study reminder (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "calendar", "can_edit")
    ev = CalendarEvent(
        student_id=student.id,
        event_date=data.event_date,
        title=data.title,
        description=data.description,
        event_type=data.event_type,
    )
    db.add(ev)
    await db.flush()
    await db.refresh(ev)
    return CalendarEventResponse.model_validate(ev)


@router.delete("/calendar/events/{event_id}")
async def delete_portal_calendar_event(
    event_id: str,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Delete a personal calendar event (Requires can_edit)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "calendar", "can_edit")
    res = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.student_id == student.id,
        )
    )
    ev = res.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(ev)
    await db.flush()
    return {"message": "Event deleted"}


# ─── AI Plans (Phase 9) ────────────────────────────────

from app.schemas.extended import (
    AIPlanResponse,
    AIChatRequest,
    AIChatResponse,
    AIQuotaStatusResponse,
)
from app.models.academic import AIPlan
from app.services import ai_service

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
            created_at=ai_service._format_created_at(p.created_at)
        )
        for p in plans
    ]


@router.post("/ai/chat", response_model=AIChatResponse)
async def student_chat_with_ai(
    data: AIChatRequest,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Chat with StudyBuddy AI about concepts, homework doubts, and study topics."""
    student = await _get_student_for_user(db, current_student)
    return await ai_service.student_ai_chat(
        db, student, data.message, data.history,
        file_data=data.file_data, mime_type=data.mime_type, file_name=data.file_name
    )


@router.get("/ai/quota", response_model=AIQuotaStatusResponse)
async def get_student_quota_status(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Check AI tutor availability."""
    return await ai_service.check_gemini_quota_status()


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


@router.post("/files/upload")
async def upload_portal_file(
    file: UploadFile = File(...),
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Upload study resource directly to repository (Requires can_import)."""
    student = await _get_student_for_user(db, current_student)
    await require_student_permission(db, student, "files", "can_import")
    contents = await file.read()
    stored_path = await storage_service.upload_file_bytes(
        file.filename or "student_resource",
        contents,
        file.content_type or "application/octet-stream",
        folder="resources",
    )
    doc = SyllabusDocument(
        teacher_id=student.teacher_id or current_student.id,
        student_id=student.id,
        file_name=file.filename or "student_resource",
        file_url=stored_path,
        file_size=len(contents),
        parsed_chapters_count=0,
    )
    db.add(doc)
    await db.flush()
    return {
        "id": f"syl-doc-{doc.id}",
        "name": doc.file_name,
        "url": doc.file_url,
        "file_size": doc.file_size,
    }

