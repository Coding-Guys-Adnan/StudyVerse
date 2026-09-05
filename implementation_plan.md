# Implementation Plan — Student Birthday Tracking & Calendar Integration

Add support for recording student Date of Birth (DOB) during student creation and editing, and automatically display birthday events and badges on the calendar for both teachers and students.

---

## User Review Required

> [!IMPORTANT]
> **Database Schema Update**: A new `date_of_birth` column (nullable `DATE`) will be added to the `students` table in SQLite (`studyverse.db`) and SQLAlchemy ORM models.

> [!NOTE]
> **Annual Recurring Calendar Logic**: Student birthdays recur every year on the same month and day. The calendar month aggregation service will dynamically evaluate if a student's birthday falls within the queried month/year and automatically set `is_birthday = True` and inject a Birthday event (with a 🎂 Cake icon) on that date cell.

---

## Open Questions

> [!NOTE]
> None. Requirements are clear.

---

## Proposed Changes

### Database & Backend

#### [MODIFY] [`backend/app/models/student.py`](file:///e:/StudyVerse/backend/app/models/student.py#L30-L38)
- Add `date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)` to `Student` model.

#### [MODIFY] [`backend/app/schemas/student.py`](file:///e:/StudyVerse/backend/app/schemas/student.py)
- Add `date_of_birth: Optional[date] = None` to `StudentCreate`, `StudentUpdate`, and `StudentResponse`.

#### [MODIFY] [`backend/app/schemas/academic.py`](file:///e:/StudyVerse/backend/app/schemas/academic.py#L340-L350)
- Add `is_birthday: bool = False` to `CalendarDayData` schema.

#### [MODIFY] [`backend/app/services/student_service.py`](file:///e:/StudyVerse/backend/app/services/student_service.py)
- Include `date_of_birth` handling in `create_student` and `update_student`.

#### [MODIFY] [`backend/app/services/academic_service.py`](file:///e:/StudyVerse/backend/app/services/academic_service.py#L888-L943)
- In `get_calendar_month`, fetch student's `date_of_birth`. If `date_of_birth` exists and its month matches the queried calendar `month`, set `is_birthday = True` on the day matching `date_of_birth.day` and append a virtual Birthday event into `events`.

#### [MODIFY] [`backend/app/api/v1/portal.py`](file:///e:/StudyVerse/backend/app/api/v1/portal.py#L290-L308)
- In student portal `/portal/calendar`, perform the same recurring birthday evaluation for the logged-in student and mark `is_birthday = True` on their birthday cell.

---

### Frontend

#### [MODIFY] [`frontend/src/lib/students-api.ts`](file:///e:/StudyVerse/frontend/src/lib/students-api.ts) & [`frontend/src/lib/api.ts`](file:///e:/StudyVerse/frontend/src/lib/api.ts)
- Add `date_of_birth?: string | null` to `Student`, `CreateStudentData`, `UpdateStudentData`, `AdminStudent` interfaces.

#### [MODIFY] [`frontend/src/lib/academic-api.ts`](file:///e:/StudyVerse/frontend/src/lib/academic-api.ts) & [`frontend/src/lib/portal-api.ts`](file:///e:/StudyVerse/frontend/src/lib/portal-api.ts)
- Add `is_birthday?: boolean` to `CalendarDayData` interface.

#### [MODIFY] [`frontend/src/app/(teacher)/students/page.tsx`](file:///e:/StudyVerse/frontend/src/app/(teacher)/students/page.tsx)
- Add a "Date of Birth" date picker input (`date_of_birth`) in the Add / Edit Student modal form.
- Display student's Birthday badge in the student roster card.

#### [MODIFY] [`frontend/src/components/calendar/student-calendar.tsx`](file:///e:/StudyVerse/frontend/src/components/calendar/student-calendar.tsx)
- Render a 🎂 Birthday badge and celebration highlight on the calendar grid cell and day detail modal when `dayData?.is_birthday` is true.

#### [MODIFY] [`frontend/src/app/portal/page.tsx`](file:///e:/StudyVerse/frontend/src/app/portal/page.tsx)
- Render 🎂 Birthday celebration banner and badge on the student portal calendar when `dayData?.is_birthday` is true.

---

## Verification Plan

### Automated Verification
1. Run database migration on `studyverse.db`:
   ```sql
   ALTER TABLE students ADD COLUMN date_of_birth DATE;
   ```
2. Run python test script to verify setting `date_of_birth` on a student and retrieving calendar month response with `is_birthday=True`.
3. Run frontend production build:
   ```bash
   cd frontend
   npm run build
   ```

### Manual Verification
1. Teacher Portal: Go to `/students`, click "Add Student" or "Edit Student", set Date of Birth (e.g., August 25).
2. Go to `/students/[id]`, switch calendar to August. Verify the 🎂 Birthday badge appears on August 25.
3. Student Portal: Log in as the student, open `/portal`, switch to August, verify the birthday banner & cake icon appear on their birthday.
