import os
import io
import PyPDF2
import docx
from datetime import date, datetime, timezone
import google.generativeai as genai
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import get_settings
from app.models.academic import AIPlan, Recommendation, Syllabus, Homework, Test, DailyPlan
from app.models.student import Student
from app.schemas.extended import AIPlanResponse, RecommendationResponse

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
    
    # Compile Context Data
    syllabus_summary = []
    for s in syllabus_items:
        syllabus_summary.append(f"- {s.subject} | {s.chapter} | Status: {s.status} | Progress: {s.progress}%")
        
    homework_summary = []
    for h in homework_items:
        homework_summary.append(f"- Subject: {h.subject} | Title: {h.title} | Status: {h.status} | Due: {h.due_date}")
        
    test_summary = []
    for t in tests_items:
        pct = round((t.obtained_marks / t.max_marks) * 100) if t.max_marks > 0 else 0
        test_summary.append(f"- Subject: {t.subject} | Exam: {t.exam_name} | Type: {t.exam_type} | Score: {t.obtained_marks}/{t.max_marks} ({pct}%) | Remarks: {t.remarks or 'None'}")
        
    recs_summary = []
    for r in recommendations:
        txt = r.extracted_text[:400] + "..." if r.extracted_text and len(r.extracted_text) > 400 else r.extracted_text
        recs_summary.append(f"- Recommendation file '{r.file_name}': {txt}")
        
    # Build Prompt
    prompt = f"""You are StudyVerse, a premium personal AI Teaching Assistant for a single tutor.
Your goal is to generate a highly tailored, custom study/lesson plan for today for student '{student.name}'.

Student Grade/Class: {student.class_grade or 'Not specified'}
Student Board: {student.board or 'Not specified'}
Additional Notes about Student: {student.notes or 'None'}

Syllabus & Current Study Progress:
{chr(10).join(syllabus_summary) if syllabus_summary else "No syllabus entries recorded."}

Recent Homework Assignments:
{chr(10).join(homework_summary) if homework_summary else "No homework assigned recently."}

Recent Test Results & Marks:
{chr(10).join(test_summary) if test_summary else "No tests logged recently."}

Extracted Teacher/Counselor Recommendations & Guidelines:
{chr(10).join(recs_summary) if recs_summary else "No recommendation files uploaded."}

Custom Teacher Instructions/Guidelines for Today:
{custom_instructions or "None"}

Please output a comprehensive, structured lesson plan in markdown format. It MUST include these exact sections:
### AI Lesson Plan for Today

#### 🎯 Today's Topic
(Specify the specific subject and topic to teach today based on syllabus progress, weak areas, or custom instructions)

#### 📝 Recommended Homework
(Suggest a practical homework assignment related to today's topic, formatted as a numbered list)

#### 🔄 Revision Topic
(Suggest a topic for quick review/revision based on weak test scores or old syllabus status)

#### ⚠️ Weak Areas to Address
(Identify areas of weakness indicated by low test marks, parent notes, or incomplete homeworks, and provide advice on how to address them)

#### 💡 Teaching Tips
(Give specific, actionable pedagogical advice or teaching methods for the tutor to explain today's topic effectively to this student)

#### ⏱ Estimated Time
(Estimate duration for teaching and practice)
"""

    generated_text = None
    
    # 2. Call Gemini API if Key is Available
    if settings.GEMINI_API_KEY:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            generated_text = response.text
        except Exception as e:
            # Fallback to smart generator if API fails
            print(f"Gemini API Error: {e}")
            
    # 3. Smart Rules-Based Fallback Generator
    if not generated_text:
        # Let's dynamically construct a realistic plan using student's actual database records
        # Identify current teaching topic from syllabus
        teaching_chapter = "General Topic"
        teaching_subject = "Mathematics"
        for s in syllabus_items:
            if s.status in ["teaching", "revision"]:
                teaching_chapter = s.chapter
                teaching_subject = s.subject
                break
        else:
            for s in syllabus_items:
                if s.status == "pending":
                    teaching_chapter = s.chapter
                    teaching_subject = s.subject
                    break
        
        # Identify weak area from test marks
        weak_subject = "Mathematics"
        weak_topic = "basic concepts"
        lowest_score = 100
        for t in tests_items:
            pct = round((t.obtained_marks / t.max_marks) * 100) if t.max_marks > 0 else 100
            if pct < lowest_score:
                lowest_score = pct
                weak_subject = t.subject
                weak_topic = f"{t.exam_name} concepts"
                
        # Custom instructions overrides
        if custom_instructions:
            teaching_chapter = custom_instructions
            
        generated_text = f"""### AI Lesson Plan for Today

#### 🎯 Today's Topic
*{teaching_subject} — {teaching_chapter}*

#### 📝 Recommended Homework
1. Solve 5 problems based on today's practice worksheet on {teaching_chapter}.
2. Summarize key formulas and solve one complex word problem.

#### 🔄 Revision Topic
*Review of {weak_subject} ({weak_topic}) since accuracy was {lowest_score}% in recent exam.*

#### ⚠️ Weak Areas to Address
*Ensure alignment with basic rules of {weak_subject}. Walk through step-by-step calculations. Watch for arithmetic or step-by-step structuring errors.*

#### 💡 Teaching Tips
*Break down the concepts visually first. Ask the student to explain the solution back to you to check their conceptual clarity before introducing advanced worksheets.*

#### ⏱ Estimated Time
*50 minutes teaching + 20 minutes practice.*"""

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
    
    return AIPlanResponse(
        id=ai_plan.id,
        student_id=ai_plan.student_id,
        plan_date=ai_plan.plan_date,
        generated_plan=ai_plan.generated_plan,
        edited_plan=ai_plan.edited_plan,
        prompt_used=ai_plan.prompt_used,
        created_at=ai_plan.created_at.isoformat()
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
    
    # Automatically apply / save this to Today's Daily Plan if it matches today's date
    if ai_plan.plan_date == date.today():
        # Let's save this as the DailyPlan for today
        dp_result = await db.execute(
            select(DailyPlan).where(
                DailyPlan.student_id == student_id,
                DailyPlan.date == date.today()
            )
        )
        dp = dp_result.scalar_one_or_none()
        
        # Clean markdown formatting to store in daily plans
        clean_topics = f"AI Plan: {ai_plan.edited_plan}"
        
        if dp:
            dp.topics_to_teach = clean_topics
        else:
            dp = DailyPlan(
                student_id=student_id,
                date=date.today(),
                topics_to_teach=clean_topics
            )
            db.add(dp)
        await db.flush()
        
    return AIPlanResponse(
        id=ai_plan.id,
        student_id=ai_plan.student_id,
        plan_date=ai_plan.plan_date,
        generated_plan=ai_plan.generated_plan,
        edited_plan=ai_plan.edited_plan,
        prompt_used=ai_plan.prompt_used,
        created_at=ai_plan.created_at.isoformat()
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
            created_at=p.created_at.isoformat()
        )
        for p in plans
    ]
