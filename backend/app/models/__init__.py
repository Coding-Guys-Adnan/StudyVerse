from app.models.user import User
from app.models.student import Student
from app.models.student_teacher import StudentTeacher
from app.models.academic import (
    Attendance,
    DailyPlan,
    CalendarEvent,
    FeeRecord,
    Homework,
    Syllabus,
    SyllabusChapter,
    ChecklistItem,
    ChapterNote,
    SyllabusAttachment,
    Test,
    SyllabusDocument,
    Recommendation,
    AIPlan,
    Announcement,
)

__all__ = [
    "User",
    "Student",
    "StudentTeacher",
    "Attendance",
    "DailyPlan",
    "CalendarEvent",
    "FeeRecord",
    "Homework",
    "Syllabus",
    "SyllabusChapter",
    "ChecklistItem",
    "ChapterNote",
    "SyllabusAttachment",
    "Test",
    "SyllabusDocument",
    "Recommendation",
    "AIPlan",
    "Announcement",
]

