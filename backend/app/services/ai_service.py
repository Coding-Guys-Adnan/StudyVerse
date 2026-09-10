import os
import io
import re
import base64
import PyPDF2
import docx
from datetime import date, datetime, timezone, timedelta
import google.generativeai as genai
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.config import get_settings
from app.models.academic import AIPlan, Recommendation, Syllabus, Homework, Test, DailyPlan, CalendarEvent
from app.models.student import Student
from app.schemas.extended import (
    AIPlanResponse, RecommendationResponse,
    AIChatMessage, AIChatRequest, AIChatResponse, AIQuotaStatusResponse
)

settings = get_settings()

async def _verify_student_ownership(
    db: AsyncSession, teacher_id: str, student_id: str
) -> Student:
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.teacher_id == teacher_id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    return student

# ─── Recommendations Text Extraction ────────────────────────

def _format_created_at(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def extract_text(file_bytes: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        pdf_file = io.BytesIO(file_bytes)
        reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text
    elif filename.lower().endswith(".docx"):
        docx_file = io.BytesIO(file_bytes)
        doc = docx.Document(docx_file)
        return "\n".join([paragraph.text for paragraph in doc.paragraphs])
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported format. Only PDF and DOCX files are allowed."
        )

async def upload_recommendation_doc(
    db: AsyncSession, teacher_id: str, student_id: str, file: UploadFile
) -> RecommendationResponse:
    await _verify_student_ownership(db, teacher_id, student_id)
    file_bytes = await file.read()
    filename = file.filename or "recommendation_document"
    extracted_text = extract_text(file_bytes, filename)
    
    rec = Recommendation(
        student_id=student_id,
        file_name=filename,
        extracted_text=extracted_text
    )
    db.add(rec)
    await db.flush()
    await db.refresh(rec)
    
    return RecommendationResponse(
        id=rec.id,
        student_id=rec.student_id,
        file_name=rec.file_name,
        extracted_text=rec.extracted_text,
        uploaded_at=rec.uploaded_at.isoformat()
    )

async def list_recommendation_docs(
    db: AsyncSession, teacher_id: str, student_id: str
) -> list[RecommendationResponse]:
    await _verify_student_ownership(db, teacher_id, student_id)
    result = await db.execute(
        select(Recommendation).where(
            Recommendation.student_id == student_id
        ).order_by(Recommendation.uploaded_at.desc())
    )
    recs = result.scalars().all()
    return [
        RecommendationResponse(
            id=r.id,
            student_id=r.student_id,
            file_name=r.file_name,
            extracted_text=r.extracted_text,
            uploaded_at=r.uploaded_at.isoformat()
        )
        for r in recs
    ]

# ─── Academic Term & Multi-Day Distribution Utilities ────────

def extract_term_filter(instructions: str | None) -> str | None:
    """Detects if user instructions specify an academic term or semester (e.g. SEM 1, SEM 2, Unit Test I)."""
    if not instructions:
        return None
    text = instructions.lower()
    
    # SEM 1
    if re.search(r'\b(?:sem\s*1|semester\s*1|term\s*1|1st\s*term|1st\s*sem)\b', text):
        return "sem1"
    # SEM 2
    if re.search(r'\b(?:sem\s*2|semester\s*2|term\s*2|2nd\s*term|2nd\s*sem)\b', text):
        return "sem2"
        
    # UNIT TESTS
    if re.search(r'\b(?:unit\s*test\s*1|unit\s*test\s*i\b|ut\s*1|ut\s*i\b)', text):
        return "unit test i"
    if re.search(r'\b(?:unit\s*test\s*2|unit\s*test\s*ii\b|ut\s*2|ut\s*ii\b)', text):
        return "unit test ii"
    if re.search(r'\b(?:unit\s*test\s*3|unit\s*test\s*iii\b|ut\s*3|ut\s*iii\b)', text):
        return "unit test iii"
    if re.search(r'\b(?:class\s*test|ct)\b', text):
        return "class test"
        
    return None

def matches_term(item_term: str | None, detected_filter: str | None) -> bool:
    if not detected_filter:
        return True
    if not item_term:
        return False
    item_clean = item_term.lower().replace(" ", "")
    filter_clean = detected_filter.lower().replace(" ", "")
    return filter_clean in item_clean or item_clean in filter_clean

def ordinal_date_str(d: date) -> str:
    day = d.day
    if 11 <= (day % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{day}{suffix} {d.strftime('%B %Y')}"

def extract_date_from_heading(text: str, default_date: date) -> date:
    # Pattern 1: '11th September 2026' or '11 Sept 2026'
    m1 = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:,?\s*(\d{4}))?', text)
    if m1:
        day_n = int(m1.group(1))
        month_str = m1.group(2)[:3].capitalize()
        year_n = int(m1.group(3)) if m1.group(3) else default_date.year
        try:
            dt = datetime.strptime(f"{day_n} {month_str} {year_n}", "%d %b %Y")
            return dt.date()
        except Exception:
            pass
    # Pattern 2: 'Sept 11, 2026' or 'September 11, 2026'
    m2 = re.search(r'([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?', text)
    if m2:
        month_str = m2.group(1)[:3].capitalize()
        day_n = int(m2.group(2))
        year_n = int(m2.group(3)) if m2.group(3) else default_date.year
        try:
            dt = datetime.strptime(f"{day_n} {month_str} {year_n}", "%d %b %Y")
            return dt.date()
        except Exception:
            pass
    return default_date

def extract_numbered_summary(day_title: str, day_body: str) -> str:
    numbered_items = []
    for line in day_body.split('\n'):
        line_clean = line.strip()
        m = re.match(r'^\d+\.\s*(.*)', line_clean)
        if m:
            item_text = m.group(1).strip()
            item_text = re.sub(r'\*\*', '', item_text).strip()
            if item_text:
                numbered_items.append(item_text)
            if len(numbered_items) >= 2:
                break
    if numbered_items:
        formatted = " | ".join([f"{i+1}. {item}" for i, item in enumerate(numbered_items)])
        return formatted[:120]
    return day_title[:120] if day_title else "Scheduled Lesson Plan"

def parse_multi_day_plan(plan_text: str, start_date: date) -> dict[date, dict[str, str]]:
    """
    Parses multi-day plans (e.g. '### DAY 1', '### Day 2', '### [DATE: 2026-09-09]', '### 11th September')
    and returns a dict of {date_obj: {'topics_to_teach': str, 'notes': str}}.
    """
    daily_schedules: dict[date, dict[str, str]] = {}
    
    # 1. Check for explicit [DATE: YYYY-MM-DD] tags
    date_tag_pattern = re.compile(
        r'###\s*\[DATE:\s*(\d{4}-\d{2}-\d{2})\]\s*([^\n]*)\n(.*?)(?=(?:###\s*\[DATE:|$))',
        re.DOTALL | re.IGNORECASE
    )
    date_matches = list(date_tag_pattern.finditer(plan_text))
    if date_matches:
        for m in date_matches:
            d_str = m.group(1).strip()
            title = m.group(2).strip('*: –—')
            content = m.group(3).strip()
            try:
                target_date = date.fromisoformat(d_str)
                summary = extract_numbered_summary(title, content)
                daily_schedules[target_date] = {
                    "topics_to_teach": summary,
                    "notes": f"### {title or summary}\n\n{content}"
                }
            except Exception:
                pass
        if daily_schedules:
            return daily_schedules

    # 2. Check for '### DAY 1:', '### Day 2:', '## Day 3', etc.
    day_pattern = re.compile(
        r'(?:^|\n)(#{2,4}\s*(?:📅\s*)?DAY\s*(\d+)[:\s–—]*([^\n]*)\n)(.*?)(?=(?:\n#{2,4}\s*(?:📅\s*)?DAY\s*\d+[:\s–—]|\n##\s+[🎯📝📌A-Z]|$))',
        re.DOTALL | re.IGNORECASE
    )
    day_matches = list(day_pattern.finditer(plan_text))
    if day_matches:
        for m in day_matches:
            day_num = int(m.group(2))
            day_title = m.group(3).strip('*: –—')
            day_body = m.group(4).strip()
            fallback_date = start_date + timedelta(days=(day_num - 1))
            target_date = extract_date_from_heading(day_title, fallback_date)
            summary = extract_numbered_summary(day_title, day_body)
            full_notes = f"### DAY {day_num}: {day_title}\n\n{day_body}"
            daily_schedules[target_date] = {
                "topics_to_teach": summary,
                "notes": full_notes
            }
        if daily_schedules:
            return daily_schedules

    # 3. Check for direct date headings like '### 📅 11th September 2026'
    date_heading_pattern = re.compile(
        r'(?:^|\n)(#{2,4}\s*(?:📅\s*)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+\d{4})?|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?)[:\s–—]*([^\n]*)\n)(.*?)(?=(?:\n#{2,4}\s*(?:📅\s*)?(?:\d{1,2}[a-z]{2}\s+[A-Z]|[A-Z][a-z]+\s+\d{1,2})|\n##\s+[🎯📝📌A-Z]|$))',
        re.DOTALL | re.IGNORECASE
    )
    date_head_matches = list(date_heading_pattern.finditer(plan_text))
    if date_head_matches:
        for m in date_head_matches:
            date_str = m.group(2).strip()
            extra_title = m.group(3).strip('*: –—')
            day_body = m.group(4).strip()
            target_date = extract_date_from_heading(date_str, start_date)
            summary = extract_numbered_summary(f"{date_str} {extra_title}", day_body)
            full_notes = f"### {date_str} {extra_title}\n\n{day_body}"
            daily_schedules[target_date] = {
                "topics_to_teach": summary,
                "notes": full_notes
            }
        if daily_schedules:
            return daily_schedules

    # 4. Single-day fallback: Clean summary without raw markdown blob
    summary = extract_numbered_summary("", plan_text)
    return {
        start_date: {
            "topics_to_teach": summary,
            "notes": plan_text
        }
    }

async def _distribute_plan_to_daily_plans(
    db: AsyncSession, student_id: str, plan_text: str, start_date: date
):
    """
    Parses a generated or updated AI study plan and saves each segregated day
    into the daily_plans table so it is displayed on its specific calendar date.
    """
    if not plan_text:
        return
    schedule_by_date = parse_multi_day_plan(plan_text, start_date)
    for target_date, info in schedule_by_date.items():
        dp_result = await db.execute(
            select(DailyPlan).where(
                DailyPlan.student_id == student_id,
                DailyPlan.date == target_date
            )
        )
        dp = dp_result.scalar_one_or_none()
        if dp:
            dp.topics_to_teach = info["topics_to_teach"]
            dp.notes = info["notes"]
        else:
            dp = DailyPlan(
                student_id=student_id,
                date=target_date,
                topics_to_teach=info["topics_to_teach"],
                notes=info["notes"]
            )
            db.add(dp)
    await db.flush()

# ─── Gemini AI Service ──────────────────────────────────────

async def generate_ai_lesson_plan(
    db: AsyncSession, teacher_id: str, student_id: str, custom_instructions: str | None = None
) -> AIPlanResponse:
    student = await _verify_student_ownership(db, teacher_id, student_id)
    
    # 1. Fetch Student Data to Build Context
    # Syllabus
    syllabus_res = await db.execute(
        select(Syllabus).where(Syllabus.student_id == student_id)
    )
    syllabus_items = syllabus_res.scalars().all()
    
    # Homework
    homework_res = await db.execute(
        select(Homework).where(Homework.student_id == student_id).order_by(Homework.created_at.desc()).limit(10)
    )
    homework_items = homework_res.scalars().all()
    
    # Tests
    tests_res = await db.execute(
        select(Test).where(Test.student_id == student_id).order_by(Test.exam_date.desc().nulls_last()).limit(10)
    )
    tests_items = tests_res.scalars().all()
    
    # Recommendations
    recs_res = await db.execute(
        select(Recommendation).where(Recommendation.student_id == student_id).order_by(Recommendation.uploaded_at.desc()).limit(5)
    )
    recommendations = recs_res.scalars().all()
    
    # Check if teacher requested a specific academic term/semester (e.g. SEM 1, SEM 2, Unit Test)
    term_filter = extract_term_filter(custom_instructions)
    filtered_syllabus_items = []
    if term_filter:
        for s in syllabus_items:
            if matches_term(getattr(s, "term", None), term_filter):
                filtered_syllabus_items.append(s)
    else:
        filtered_syllabus_items = syllabus_items

    # Compile Context Data
    remaining_syllabus = []
    completed_syllabus = []
    for s in filtered_syllabus_items:
        term_label = f" [{s.term}]" if getattr(s, "term", None) else ""
        entry = f"- {s.subject}: '{s.chapter}'{term_label} (Status: {s.status}, Progress: {s.progress}%)"
        if s.status == "completed" or s.progress >= 100:
            completed_syllabus.append(entry)
        else:
            remaining_syllabus.append(entry)
        
    homework_summary = []
    for h in homework_items:
        homework_summary.append(f"- {h.subject}: '{h.title}' | Status: {h.status} | Due: {h.due_date}")
        
    test_summary = []
    weak_areas = []
    for t in tests_items:
        pct = round((t.obtained_marks / t.max_marks) * 100) if t.max_marks > 0 else 0
        test_summary.append(f"- {t.subject} ({t.exam_name}): {t.obtained_marks}/{t.max_marks} ({pct}% accuracy) | Remarks: {t.remarks or 'None'}")
        if pct < 75:
            weak_areas.append(f"- Weak score in {t.subject} ({t.exam_name}): {pct}% accuracy — requires targeted practice/revision.")
        
    recs_summary = []
    for r in recommendations:
        txt = r.extracted_text[:400] + "..." if r.extracted_text and len(r.extracted_text) > 400 else r.extracted_text
        recs_summary.append(f"- Recommendation file '{r.file_name}': {txt}")

    # Determine requested timeframe (e.g., week vs day)
    is_weekly = False
    if custom_instructions:
        ci_lower = custom_instructions.lower()
        if any(w in ci_lower for w in ["week", "7-day", "7 day", "weekly", "schedule", "routine"]) or re.search(r'\bbefore\s+\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+', ci_lower):
            is_weekly = True

    term_notice = ""
    if term_filter:
        term_notice = f"\n⚠️ ACADEMIC TERM FILTER: The teacher specifically requested to make this plan ONLY for '{term_filter.upper()}'. All selected chapters and topics MUST strictly belong to {term_filter.upper()}. Do NOT schedule topics belonging to other semesters or terms.\n"
        
    # Build Prompt
    prompt = f"""You are StudyVerse, a premium personal AI Teaching Assistant for a private tutor.
Your task is to generate a highly tailored, pedagogically sound academic study plan and guide for student '{student.name}'.

Student Profile:
- Name: {student.name}
- Today's Date: {date.today().strftime('%A, %B %d, %Y')}
- Class/Grade: {student.class_grade or 'Not specified'}
- Education Board: {student.board or 'Not specified'}
- Tutor Notes on Student: {student.notes or 'None'}
{term_notice}
📚 REMAINING / PENDING SYLLABUS (Topics to teach or complete):
{chr(10).join(remaining_syllabus) if remaining_syllabus else ("No remaining syllabus recorded matching the requested term filter." if term_filter else "All entered syllabus chapters are marked completed or none recorded.")}

✅ ALREADY COMPLETED SYLLABUS:
{chr(10).join(completed_syllabus) if completed_syllabus else "No completed chapters recorded yet."}

📊 PREVIOUS TEST SCORES & PERFORMANCE:
{chr(10).join(test_summary) if test_summary else "No tests recorded yet."}

⚠️ WEAK AREAS IDENTIFIED FROM TEST MARKS:
{chr(10).join(weak_areas) if weak_areas else "No critically low scores (<75%) detected."}

📝 RECENT HOMEWORK HISTORY:
{chr(10).join(homework_summary) if homework_summary else "No recent homework recorded."}

💡 TUTOR / COUNSELOR RECOMMENDATION NOTES:
{chr(10).join(recs_summary) if recs_summary else "No recommendation files uploaded."}

🎯 TEACHER'S SPECIFIC INSTRUCTIONS FOR THIS PLAN:
{custom_instructions or "No custom instructions provided. Generate an optimal study plan based on remaining syllabus and weakest test subjects."}

CRITICAL RULES & NUMBER-WISE READABILITY STANDARDS:
1. EXECUTIVE SUMMARY BLOCK (At the top):
   Provide a clean Markdown summary table with:
   | Key Metric | Details |
   | :--- | :--- |
   | **Student** | {student.name} ({student.class_grade or 'Grade'} • {student.board or 'Board'}) |
   | **Focus Goal** | Target subjects, chapters, and requested goals |
   | **Schedule Pacing** | e.g. 30–45 Mins / session (Daily or Alternate Days) |
   | **Pedagogical Tactic** | 1-line behavioral/teaching tactic matching student profile |

2. NUMBER-WISE DAY-BY-DAY STRUCTURE (STRICT REQUIREMENT):
   Format EVERY DAY strictly NUMBER-WISE (1., 2., 3., 4...) with clear ordinal dates (e.g. 11th September 2026, 12th September 2026):
   
   Example format:
   ### 📅 DAY 1: 11th September 2026
   1. **Teach [Subject 1] Topic:** <Specific Topic Name & Key Concept, e.g. Teach Math Topic Addition (Story sums & carry-over rules)>
   2. **Teach [Subject 2] Topic:** <Specific Topic Name, e.g. Grammar (Nouns & Pronouns identification)>
   3. **Session Practice / Oral Drill:** <3 rapid oral quiz questions or quick interactive problem-solving>
   4. **Assigned Homework:** <Bite-sized practice tasks (3-5 problems max)>

   ---

   ### 📅 DAY 2: 12th September 2026 (or next scheduled date)
   1. **Teach [Subject 1] Topic:** <Specific Topic Name & Concept>
   2. **Teach [Subject 2] Topic:** <Specific Topic Name>
   3. **Session Practice / Oral Drill:** <Interactive practice drill>
   4. **Assigned Homework:** <Specific bite-sized homework>

   ---

3. CLEANLINESS & READABILITY RULES:
   - EVERY session MUST use the numbered format (1., 2., 3., 4...).
   - Do NOT write dense or unbroken paragraphs. Keep each numbered item crisp, high-impact, and immediately actionable for the tutor.
   - Use bold text for key terms and subjects (**Teach Math:** Addition).
   - Use clean Markdown horizontal dividers (`---`) between days for high-contrast visual separation.
"""

    generated_text = None
    quota_exceeded = False
    quota_notice = None
    
    # 2. Call Gemini API if Key is Available
    if settings.GEMINI_API_KEY:
        models_to_try = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]
        for m_name in models_to_try:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel(m_name)
                response = model.generate_content(prompt)
                if response and response.text:
                    generated_text = response.text
                    break
            except Exception as e:
                err_str = str(e)
                print(f"Gemini API Error with model {m_name}: {err_str}")
                if "429" in err_str or "resource" in err_str.lower() or "quota" in err_str.lower():
                    quota_exceeded = True
                    quota_notice = "⚠️ Gemini API Quota Reached: Daily free limit or per-minute rate limit exceeded. Switched to offline Smart Assistant."
            
    # 3. Smart Rules-Based Fallback Generator
    if not generated_text:
        # Construct fallback plan using actual database records
        teaching_chapter = "General Topic"
        teaching_subject = "Mathematics"
        for s in syllabus_items:
            if s.status in ["teaching", "revision"]:
                teaching_chapter = s.chapter
                teaching_subject = s.subject
                break
        else:
            for s in syllabus_items:
                if s.status == "pending" or s.progress < 100:
                    teaching_chapter = s.chapter
                    teaching_subject = s.subject
                    break
        
        weak_subject = "Mathematics"
        weak_topic = "core concepts"
        lowest_score = 100
        for t in tests_items:
            pct = round((t.obtained_marks / t.max_marks) * 100) if t.max_marks > 0 else 100
            if pct < lowest_score:
                lowest_score = pct
                weak_subject = t.subject
                weak_topic = f"{t.exam_name} concepts"
                
        if is_weekly:
            generated_text = f"""### 📅 AI Study Guide for {student.name}

#### 🎯 Overview & Goals
| Metric | Details |
| :--- | :--- |
| **Student** | {student.name} ({student.class_grade or 'Grade'} • {student.board or 'Board'}) |
| **Priority Syllabus** | {teaching_subject} — {teaching_chapter} |
| **Remedial Focus** | {weak_subject} ({lowest_score}% in recent exam) |

---

### 📅 DAY 1: {ordinal_date_str(date.today())}
1. **Teach {teaching_subject} Topic:** {teaching_chapter} foundational definitions & core rules
2. **Teach {weak_subject} Topic:** Review {weak_topic} & clarify doubts from recent test
3. **Session Practice Drill:** 5 guided examples solved step-by-step
4. **Assigned Homework:** First 3 practice questions from textbook

---

### 📅 DAY 2: {ordinal_date_str(date.today() + timedelta(days=1))}
1. **Teach {teaching_subject} Topic:** Intermediate exercises & word problems
2. **Teach Grammar / Revision Topic:** Oral quiz on yesterday's concepts
3. **Session Practice Drill:** Rapid-fire 5-minute timed challenge
4. **Assigned Homework:** Solve 4 practice problems in notebook

---

### 📅 DAY 3: {ordinal_date_str(date.today() + timedelta(days=2))}
1. **Teach {teaching_subject} Topic:** Tricky problem types and carry-over methods
2. **Teach {weak_subject} Topic:** Remedial problem solving addressing past errors
3. **Session Practice Drill:** Student explains 2 problems back out loud
4. **Assigned Homework:** 4 mixed revision problems

---

### 📅 DAY 4: {ordinal_date_str(date.today() + timedelta(days=3))}
1. **Teach {teaching_subject} Topic:** Chapter recap and formula mastery
2. **Teach Grammar / Vocabulary Topic:** Sentence structures & grammar rules
3. **Session Practice Drill:** Mini 15-minute diagnostic quiz
4. **Assigned Homework:** Review and correct all quiz mistakes
"""
        else:
            if custom_instructions:
                teaching_chapter = custom_instructions
                
            generated_text = f"""### 📅 AI Study Plan for {student.name}

#### 🎯 Session Overview
| Metric | Details |
| :--- | :--- |
| **Student** | {student.name} ({student.class_grade or 'Grade'} • {student.board or 'Board'}) |
| **Primary Topic** | {teaching_subject} — {teaching_chapter} |
| **Remedial Focus** | {weak_subject} ({weak_topic}) |

---

### 📅 DAY 1: {ordinal_date_str(date.today())}
1. **Teach {teaching_subject} Topic:** {teaching_chapter} — Explain core concepts & step-by-step rules
2. **Teach {weak_subject} Topic:** {weak_topic} — Review weak test areas and clear doubts
3. **Session Practice Drill:** 5 interactive practice questions solved together
4. **Assigned Homework:** 5 targeted practice sums/questions from textbook
"""

    # 4. Save to Database
    ai_plan = AIPlan(
        student_id=student_id,
        plan_date=date.today(),
        generated_plan=generated_text,
        edited_plan=generated_text,
        prompt_used=prompt
    )
    db.add(ai_plan)
    await db.flush()
    await db.refresh(ai_plan)
    
    # Automatically segregate and distribute daily plans across calendar dates
    await _distribute_plan_to_daily_plans(db, student_id, ai_plan.generated_plan, ai_plan.plan_date)
    
    if quota_exceeded:
        rem_res = await db.execute(
            select(CalendarEvent).where(
                CalendarEvent.student_id == student_id,
                CalendarEvent.event_date == date.today(),
                CalendarEvent.title.like("%Quota%")
            )
        )
        if not rem_res.scalar_one_or_none():
            cal_rem = CalendarEvent(
                student_id=student_id,
                event_date=date.today(),
                title="⚠️ Gemini Quota Reached",
                description="Your free Gemini API quota limit was reached. StudyVerse generated your study plan using the offline Smart Assistant.",
                event_type="reminder"
            )
            db.add(cal_rem)
            await db.flush()

    return AIPlanResponse(
        id=ai_plan.id,
        student_id=ai_plan.student_id,
        plan_date=ai_plan.plan_date,
        generated_plan=ai_plan.generated_plan,
        edited_plan=ai_plan.edited_plan,
        prompt_used=ai_plan.prompt_used,
        created_at=_format_created_at(ai_plan.created_at),
        quota_exceeded=quota_exceeded,
        quota_notice=quota_notice
    )

async def update_ai_lesson_plan(
    db: AsyncSession, teacher_id: str, student_id: str, plan_id: str, edited_plan: str
) -> AIPlanResponse:
    await _verify_student_ownership(db, teacher_id, student_id)
    
    result = await db.execute(
        select(AIPlan).where(
            AIPlan.id == plan_id,
            AIPlan.student_id == student_id
        )
    )
    ai_plan = result.scalar_one_or_none()
    if not ai_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Plan not found"
        )
        
    ai_plan.edited_plan = edited_plan
    await db.flush()
    await db.refresh(ai_plan)
    
    # Automatically segregate and distribute daily plans across calendar dates
    await _distribute_plan_to_daily_plans(db, student_id, ai_plan.edited_plan, ai_plan.plan_date)
        
    return AIPlanResponse(
        id=ai_plan.id,
        student_id=ai_plan.student_id,
        plan_date=ai_plan.plan_date,
        generated_plan=ai_plan.generated_plan,
        edited_plan=ai_plan.edited_plan,
        prompt_used=ai_plan.prompt_used,
        created_at=_format_created_at(ai_plan.created_at)
    )

async def list_ai_plans(
    db: AsyncSession, teacher_id: str, student_id: str
) -> list[AIPlanResponse]:
    await _verify_student_ownership(db, teacher_id, student_id)
    result = await db.execute(
        select(AIPlan).where(
            AIPlan.student_id == student_id
        ).order_by(AIPlan.created_at.desc())
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
            created_at=_format_created_at(p.created_at)
        )
        for p in plans
    ]


async def delete_ai_lesson_plan(
    db: AsyncSession, teacher_id: str, student_id: str, plan_id: str
) -> dict[str, str]:
    await _verify_student_ownership(db, teacher_id, student_id)
    result = await db.execute(
        select(AIPlan).where(
            AIPlan.id == plan_id,
            AIPlan.student_id == student_id,
        )
    )
    ai_plan = result.scalar_one_or_none()
    if not ai_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Plan not found",
        )
    await db.delete(ai_plan)
    await db.flush()
    return {"message": "Plan deleted successfully"}


async def clear_all_ai_plans(
    db: AsyncSession, teacher_id: str, student_id: str
) -> dict[str, str]:
    await _verify_student_ownership(db, teacher_id, student_id)
    await db.execute(
        delete(AIPlan).where(AIPlan.student_id == student_id)
    )
    await db.flush()
    return {"message": "All plan history cleared successfully"}


# ─── Chatbot & Quota Monitoring Service ─────────────────────

def generate_teacher_fallback_reply(message: str, student: Student) -> str:
    msg = message.lower()
    name = student.name
    grade = student.class_grade or "Class 3"
    
    if any(w in msg for w in ["energy", "sleepy", "tired", "focus", "bored"]):
        return f"""### 💡 Energy Management & Focus Strategies for {name}
1. **20-5 Rhythm:** Keep direct instruction under 20 minutes. Follow up immediately with 3 minutes of physical movement (stretches, star jumps, high-fives).
2. **Tactile Interaction:** Switch from passive listening to using whiteboards, magnetic letters, or math counters.
3. **Oral 'Teach Back':** Since {name} is talkative and cheerful, ask him to 'teach' the concept back to you like a superhero tutor!
4. **Reward Pacing:** Break tasks into small 5-problem sprints with verbal praise."""

    elif any(w in msg for w in ["math", "subtraction", "multiplication", "table", "sum", "shapes"]):
        return f"""### 🧮 Mathematics Teaching Strategy for {grade} ({name})
1. **Real-World Scenarios:** Frame problems as fun stories (e.g., sharing toys, collecting stickers, chocolates and dragons).
2. **Visual Representation:** Use base-ten blocks, drawn grids, or jump-counting on number lines.
3. **Subtraction with Regrouping:** Use the 'borrow from the neighbor' story where the tens column shares a basket with units.
4. **Multiplication Rhythms:** Practice tables with rhythmic clapping or jump-stepping to make skip-counting memorable."""

    elif any(w in msg for w in ["english", "grammar", "tense", "past", "present", "writing", "sentence"]):
        return f"""### 📚 English Language Remediation Strategy ({grade})
1. **Spoken First, Written Second:** Have {name} speak 3–4 sentences out loud before picking up a pencil.
2. **Verb Tense Transformers:** Write root verbs on flashcards and play 'Yesterday vs Today' (*Today I jump ➔ Yesterday I jumped*).
3. **Buggy Sentence Hunt:** Write silly sentences with incorrect tenses and invite {name} to play 'Inspector' to fix them.
4. **Paragraph Scaffolding:** Use a 3-part sandwich format: 1 Topic sentence, 2 Detail sentences, 1 Conclusion sentence."""

    elif any(w in msg for w in ["science", "plant", "insect", "animal"]):
        return f"""### 🔬 Science Teaching & Revision Tips ({grade})
1. **Hands-on Observation:** Use real leaves, diagrams, or mini-whiteboard drawings rather than memorizing definitions.
2. **Fun Mnemonics:** For insects: *Head, Thorax, Abdomen* (tap head, chest, stomach) and count 6 legs.
3. **Interactive Quizzing:** Rapid-fire 60-second quiz show format to tap into {name}'s cheerful personality."""

    else:
        return f"""### 🌟 Tutor Guidance for {name} ({grade})
Here are recommended pedagogical steps for this topic:
- **Concept Primer:** Introduce with a real-life analogy before opening textbooks.
- **Guided Practice:** Solve 2 examples collaboratively; walk through intermediate steps verbally.
- **Check for Understanding:** Ask {name} to explain the core rule in his own words.
- **Micro-Homework:** Assign 3 targeted questions to reinforce confidence without fatigue.

*(Note: Response generated via StudyVerse Smart Assistant)*"""


def generate_student_fallback_reply(message: str, student: Student) -> str:
    msg = message.lower()
    name = student.name
    
    if any(w in msg for w in ["hi", "hello", "hey", "who are you"]):
        return f"Hello {name}! 🌟 I'm your StudyBuddy AI tutor! I'm here to help you learn, solve tricky problems, and have fun studying. What would you like to explore today? 🚀"
        
    elif any(w in msg for w in ["subtraction", "minus", "subtract"]):
        return f"Let's master subtraction together! 🧮 Think of subtraction as 'giving away' or 'taking away'.\n\nFor example, if you have 15 tasty cookies 🍪 and you share 7 cookies with your friend, how many are left? You can count backwards from 15: 14, 13, 12, 11, 10, 9, 8! You have 8 cookies left! 🎉 Would you like to try another one?"

    elif any(w in msg for w in ["multiplication", "multiply", "table"]):
        return f"Multiplication is like fast addition! ⚡\n\nFor example, 4 × 3 just means 4 groups of 3 (or 3 + 3 + 3 + 3 = 12)! Which multiplication table are you practicing today? Let's recite it together! 👏"

    elif any(w in msg for w in ["past tense", "tense", "present"]):
        return f"Tenses tell us *when* something happened! ⏰\n\n- **Present:** Happening today! (*I play with a ball ⚽*)\n- **Past:** Happened yesterday! (*I played with a ball yesterday!*)\n\nTry this: What is the past tense of *eat*? (Hint: Yesterday I ____ an apple 🍎!)"

    elif any(w in msg for w in ["insect", "plant", "science"]):
        return f"Science is super exciting! 🌿 Did you know all insects have **6 legs** and their bodies have 3 parts: **Head**, **Thorax**, and **Abdomen**! 🐜 Do you have a favorite insect or plant?"

    else:
        return f"That's a wonderful question, {name}! 💡 Let's break it down step-by-step:\n1. First, think about what we already know about this topic.\n2. Next, try explaining it with a simple everyday example!\n\nTell me a little more about what you're working on, and we will solve it together! 🚀"


async def teacher_ai_chat(
    db: AsyncSession, teacher_id: str, student_id: str, message: str, history: list[AIChatMessage],
    file_data: str | None = None, mime_type: str | None = None, file_name: str | None = None
) -> AIChatResponse:
    student = await _verify_student_ownership(db, teacher_id, student_id)
    
    # Gather student context
    syllabus_res = await db.execute(select(Syllabus).where(Syllabus.student_id == student_id))
    syllabus_items = syllabus_res.scalars().all()
    pending = [f"{s.subject}: {s.chapter} ({s.progress}%)" for s in syllabus_items if s.status != "completed" and s.progress < 100]
    
    tests_res = await db.execute(select(Test).where(Test.student_id == student_id).order_by(Test.exam_date.desc().nulls_last()).limit(5))
    tests = tests_res.scalars().all()
    recent_tests = [f"{t.subject}: {t.obtained_marks}/{t.max_marks}" for t in tests]
    
    system_instruction = f"""You are StudyVerse AI Teaching Consultant, an expert pedagogical advisor assisting a private tutor who teaches student '{student.name}'.
Student Profile:
- Class / Grade: {student.class_grade or 'Not specified'}
- Board: {student.board or 'Not specified'}
- Tutor Notes on Student: {student.notes or 'None'}
- Pending Syllabus Topics: {', '.join(pending[:8]) if pending else 'None recorded'}
- Recent Test Scores: {', '.join(recent_tests) if recent_tests else 'None recorded'}

Your role:
- Provide clear, actionable, expert pedagogical guidance.
- Answer questions on curriculum (ICSE/CBSE), lesson planning, concept explanations, engaging activities, breaking down tricky topics, and handling behavioral patterns (e.g., student energy management).
- If the tutor shares an image or document (e.g., worksheet, test paper, student notes, handwriting sample), analyze it thoroughly and provide targeted pedagogical breakdown and advice.
- Keep responses structured, encouraging, practical, and directly applicable in tutoring sessions."""

    conv_text = f"System Context:\n{system_instruction}\n\nRecent Conversation History:\n"
    for msg in history[-6:]:
        role_label = "Tutor" if msg.role == "user" else "AI Consultant"
        conv_text += f"{role_label}: {msg.content}\n"
    conv_text += f"Tutor: {message}\nAI Consultant:"
    
    multimodal_parts = []
    if file_data and mime_type:
        try:
            raw_b64 = file_data.split(",")[-1] if "," in file_data else file_data
            file_bytes = base64.b64decode(raw_b64)
            multimodal_parts.append({
                "mime_type": mime_type,
                "data": file_bytes
            })
        except Exception as e:
            print(f"Error decoding attachment in teacher chat: {e}")

    response_text = None
    quota_exceeded = False
    quota_notice = None
    
    if settings.GEMINI_API_KEY:
        models_to_try = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]
        for m_name in models_to_try:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel(m_name)
                prompt_input = multimodal_parts + [conv_text] if multimodal_parts else conv_text
                res = model.generate_content(prompt_input)
                if res and res.text:
                    response_text = res.text
                    break
            except Exception as e:
                err_str = str(e)
                print(f"Chatbot Gemini error with {m_name}: {err_str}")
                if "429" in err_str or "resource" in err_str.lower() or "quota" in err_str.lower():
                    quota_exceeded = True
                    quota_notice = "⚠️ Gemini API Quota Reached: Daily free limit or per-minute rate limit exceeded. Switched to offline Smart Assistant."

    if not response_text:
        response_text = generate_teacher_fallback_reply(message, student)
        if file_name:
            response_text = f"📎 *[Received attachment: {file_name}]*\n\n" + response_text
        
    return AIChatResponse(
        response=response_text,
        quota_exceeded=quota_exceeded,
        quota_notice=quota_notice
    )


async def student_ai_chat(
    db: AsyncSession, student: Student, message: str, history: list[AIChatMessage],
    file_data: str | None = None, mime_type: str | None = None, file_name: str | None = None
) -> AIChatResponse:
    grade = student.class_grade or "Class 3"
    board = student.board or "ICSE"
    
    system_instruction = f"""You are StudyBuddy AI, a friendly, encouraging, and patient learning tutor for student '{student.name}' who is in {grade} ({board}).
Rules:
- Be cheerful, supportive, and use simple, child-friendly language.
- Explain concepts using fun real-world examples, analogies, and step-by-step guidance.
- If the student uploads an image (e.g. photo of a textbook question, math sum, or worksheet), read the question carefully and guide them through solving it step-by-step with hints rather than just giving the final answer.
- Keep answers engaging and concise (avoid overwhelmingly long walls of text).
- Use cute emojis (🌟, 🚀, 📚, 💡, 👏) to keep the student motivated."""

    conv_text = f"System Context:\n{system_instruction}\n\nRecent Conversation History:\n"
    for msg in history[-6:]:
        role_label = student.name if msg.role == "user" else "StudyBuddy"
        conv_text += f"{role_label}: {msg.content}\n"
    conv_text += f"{student.name}: {message}\nStudyBuddy:"
    
    multimodal_parts = []
    if file_data and mime_type:
        try:
            raw_b64 = file_data.split(",")[-1] if "," in file_data else file_data
            file_bytes = base64.b64decode(raw_b64)
            multimodal_parts.append({
                "mime_type": mime_type,
                "data": file_bytes
            })
        except Exception as e:
            print(f"Error decoding attachment in student chat: {e}")

    response_text = None
    quota_exceeded = False
    quota_notice = None
    
    if settings.GEMINI_API_KEY:
        models_to_try = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]
        for m_name in models_to_try:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                model = genai.GenerativeModel(m_name)
                prompt_input = multimodal_parts + [conv_text] if multimodal_parts else conv_text
                res = model.generate_content(prompt_input)
                if res and res.text:
                    response_text = res.text
                    break
            except Exception as e:
                err_str = str(e)
                print(f"Student Chatbot Gemini error with {m_name}: {err_str}")
                if "429" in err_str or "resource" in err_str.lower() or "quota" in err_str.lower():
                    quota_exceeded = True
                    quota_notice = "⚠️ Gemini API Quota Reached: Daily free limit or per-minute rate limit exceeded. Switched to offline Smart Assistant."

    if not response_text:
        response_text = generate_student_fallback_reply(message, student)
        if file_name:
            response_text = f"📎 *[Received attachment: {file_name}]*\n\n" + response_text
        
    return AIChatResponse(
        response=response_text,
        quota_exceeded=quota_exceeded,
        quota_notice=quota_notice
    )


async def check_gemini_quota_status() -> AIQuotaStatusResponse:
    if not settings.GEMINI_API_KEY:
        return AIQuotaStatusResponse(
            is_configured=False,
            is_active=False,
            message="GEMINI_API_KEY is not configured in backend/.env",
            quota_exceeded=False
        )
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-3.6-flash")
        res = model.generate_content("Ping")
        if res and res.text:
            return AIQuotaStatusResponse(
                is_configured=True,
                is_active=True,
                model_name="gemini-3.6-flash",
                message="✅ Gemini API is active, connected, and healthy.",
                quota_exceeded=False
            )
    except Exception as e:
        err_str = str(e)
        is_quota = "429" in err_str or "resource" in err_str.lower() or "quota" in err_str.lower()
        if is_quota:
            return AIQuotaStatusResponse(
                is_configured=True,
                is_active=False,
                model_name="gemini-3.6-flash",
                message="⚠️ Gemini Quota Limit Reached (429): Google's free tier rate limit or daily allowance is reached. Resets daily.",
                quota_exceeded=True
            )
        return AIQuotaStatusResponse(
            is_configured=True,
            is_active=False,
            model_name="gemini-3.6-flash",
            message=f"Gemini Notice: {err_str[:120]}",
            quota_exceeded=False
        )
