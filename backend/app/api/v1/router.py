from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.students import router as students_router, dashboard_router
from app.api.v1.academic import router as academic_router
from app.api.v1.ai import router as ai_router
from app.api.v1.announcements import router as announcements_router
from app.api.v1.portal import router as portal_router
from app.api.v1.teachers import router as teachers_router
from app.api.v1.admin import router as admin_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(students_router)
api_router.include_router(dashboard_router)
api_router.include_router(academic_router)
api_router.include_router(ai_router)
api_router.include_router(announcements_router)
api_router.include_router(portal_router)
api_router.include_router(teachers_router)
api_router.include_router(admin_router)



