from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional, Literal


# ─── Syllabus ───────────────────────────────────────────

class SyllabusAttachmentResponse(BaseModel):
    id: str
    checklist_item_id: Optional[str] = None
    chapter_note_id: Optional[str] = None
    filename: str
    stored_path: str
    mime_type: str
    file_size: int
    uploaded_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChecklistItemCreate(BaseModel):
    text: str
    completed: bool = False
    order: int = 0


class ChecklistItemUpdate(BaseModel):
    text: Optional[str] = None
    completed: Optional[bool] = None
    order: Optional[int] = None


class ChecklistItemResponse(BaseModel):
    id: str
    chapter_id: str
    text: str
    completed: bool
    order: int
    created_at: datetime
    updated_at: datetime
    attachments: list[SyllabusAttachmentResponse] = []

    model_config = {"from_attributes": True}


class ChapterNoteCreate(BaseModel):
    text: str


class ChapterNoteUpdate(BaseModel):
    text: str


class ChapterNoteResponse(BaseModel):
    id: str
    chapter_id: str
    text: str
    created_at: datetime
    updated_at: datetime
    attachments: list[SyllabusAttachmentResponse] = []

    model_config = {"from_attributes": True}


class SyllabusChapterCreate(BaseModel):
    title: str
    order: int = 0


class SyllabusChapterUpdate(BaseModel):
    title: Optional[str] = None
    order: Optional[int] = None


class SyllabusChapterResponse(BaseModel):
    id: str
    syllabus_id: str
    title: str
    order: int
    created_at: datetime
    updated_at: datetime
    checklist_items: list[ChecklistItemResponse] = []
    notes: list[ChapterNoteResponse] = []

    model_config = {"from_attributes": True}


class SyllabusCreate(BaseModel):
    subject: str
    chapter: str
    chapter_type: Optional[str] = None
    term: Optional[str] = None
    status: Literal["pending", "teaching", "revision", "completed"] = "pending"
    progress: int = 0
    sort_order: int = 0


class SyllabusUpdate(BaseModel):
    subject: Optional[str] = None
    chapter: Optional[str] = None
    chapter_type: Optional[str] = None
    term: Optional[str] = None
    status: Optional[Literal["pending", "teaching", "revision", "completed"]] = None
    progress: Optional[int] = None
    sort_order: Optional[int] = None


class SyllabusResponse(BaseModel):
    id: str
    student_id: str
    subject: str
    chapter: str
    chapter_type: Optional[str] = None
    term: Optional[str] = None
    status: str
    progress: int
    sort_order: int
    chapters: list[SyllabusChapterResponse] = []

    model_config = {"from_attributes": True}


# ─── Attendance ──────────────────────────────────────────

class AttendanceCreate(BaseModel):
    date: date
    status: Literal["present", "absent", "leave"]


class AttendanceUpdate(BaseModel):
    status: Literal["present", "absent", "leave"]


class AttendanceResponse(BaseModel):
    id: str
    student_id: str
    date: date
    status: str

    model_config = {"from_attributes": True}


# ─── Daily Plans ────────────────────────────────────────

class DailyPlanCreate(BaseModel):
    date: date
    topics_to_teach: Optional[str] = None
    notes: Optional[str] = None


class DailyPlanUpdate(BaseModel):
    topics_to_teach: Optional[str] = None
    notes: Optional[str] = None


class DailyPlanResponse(BaseModel):
    id: str
    student_id: str
    date: date
    topics_to_teach: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Calendar Events ────────────────────────────────────

class CalendarEventCreate(BaseModel):
    event_date: date
    title: str
    description: Optional[str] = None
    event_type: Literal["exam", "class", "reminder", "other"] = "other"


class CalendarEventUpdate(BaseModel):
    event_date: Optional[date] = None
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[Literal["exam", "class", "reminder", "other"]] = None


class CalendarEventResponse(BaseModel):
    id: str
    student_id: str
    event_date: date
    title: str
    description: Optional[str] = None
    event_type: str

    model_config = {"from_attributes": True}


class FeeRecordCreate(BaseModel):
    fee_month: str  # YYYY-MM
    amount: float
    status: Literal["paid", "pending"] = "pending"
    paid_date: Optional[date] = None
    notes: Optional[str] = None
    month: Optional[str] = None
    year: Optional[int] = None


class FeeRecordUpdate(BaseModel):
    amount: Optional[float] = None
    status: Optional[Literal["paid", "pending"]] = None
    paid_date: Optional[date] = None
    notes: Optional[str] = None


class FeeToggleRequest(BaseModel):
    fee_month: str  # YYYY-MM
    status: Literal["paid", "pending"]
    paid_date: Optional[date] = None
    amount: Optional[float] = None


class FeeRecordResponse(BaseModel):
    id: str
    student_id: str
    fee_month: str
    amount: float
    status: str
    paid_date: Optional[date] = None
    notes: Optional[str] = None
    month: Optional[str] = None
    year: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Homework ───────────────────────────────────────────

class HomeworkCreate(BaseModel):
    subject: str
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: Literal["assigned", "completed", "incomplete"] = "assigned"
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None


class HomeworkUpdate(BaseModel):
    subject: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[Literal["assigned", "completed", "incomplete"]] = None
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None


class HomeworkResponse(BaseModel):
    id: str
    student_id: str
    subject: str
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


# ─── Syllabus ───────────────────────────────────────────

class SyllabusCreate(BaseModel):
    subject: str
    chapter: str
    chapter_type: Optional[str] = None
    term: Optional[str] = None
    status: Literal["pending", "teaching", "revision", "completed"] = "pending"
    progress: int = 0
    sort_order: int = 0


class SyllabusUpdate(BaseModel):
    subject: Optional[str] = None
    chapter: Optional[str] = None
    chapter_type: Optional[str] = None
    term: Optional[str] = None
    status: Optional[Literal["pending", "teaching", "revision", "completed"]] = None
    progress: Optional[int] = None
    sort_order: Optional[int] = None





# ─── Tests ──────────────────────────────────────────────

class TestCreate(BaseModel):
    subject: str
    exam_name: str
    exam_type: Literal["school", "tuition"]
    max_marks: float
    obtained_marks: float
    remarks: Optional[str] = None
    exam_date: Optional[date] = None
    question_paper_name: Optional[str] = None
    question_paper_url: Optional[str] = None
    answer_paper_name: Optional[str] = None
    answer_paper_url: Optional[str] = None


class TestUpdate(BaseModel):
    subject: Optional[str] = None
    exam_name: Optional[str] = None
    exam_type: Optional[Literal["school", "tuition"]] = None
    max_marks: Optional[float] = None
    obtained_marks: Optional[float] = None
    remarks: Optional[str] = None
    exam_date: Optional[date] = None
    question_paper_name: Optional[str] = None
    question_paper_url: Optional[str] = None
    answer_paper_name: Optional[str] = None
    answer_paper_url: Optional[str] = None


class TestResponse(BaseModel):
    id: str
    student_id: str
    subject: str
    exam_name: str
    exam_type: str
    max_marks: float
    obtained_marks: float
    remarks: Optional[str] = None
    exam_date: Optional[date] = None
    question_paper_name: Optional[str] = None
    question_paper_url: Optional[str] = None
    answer_paper_name: Optional[str] = None
    answer_paper_url: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


# ─── Calendar Month Data (aggregated) ───────────────────

class CalendarDayData(BaseModel):
    date: date
    attendance: Optional[AttendanceResponse] = None
    daily_plan: Optional[DailyPlanResponse] = None
    homework: list[HomeworkResponse] = []
    events: list[CalendarEventResponse] = []
    fee_status: Optional[str] = None  # "paid" | "pending" | None
    is_birthday: bool = False


class CalendarMonthResponse(BaseModel):
    year: int
    month: int
    days: dict[str, CalendarDayData]  # key is date ISO string
    month_fee_status: Optional[str] = None  # "paid" | "pending" | None
    month_paid_date: Optional[date] = None
    month_fee_amount: Optional[float] = None
    fee_due_day: Optional[int] = None


class PortalFileResponse(BaseModel):
    id: str
    name: str
    url: str
    category: str  # "homework" | "syllabus" | "exams" | "recommendations"
    source_label: str
    file_size: Optional[int] = None
    created_at: str
