import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.api.v1.router import api_router

settings = get_settings()

app = FastAPI(
    title="StudyVerse API",
    description="AI Powered Tuition Management & Student Progress Tracking",
    version="1.0.0",
)

# CORS
origins = [
    "http://localhost:3005",
    "http://127.0.0.1:3005",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8005",
    "http://127.0.0.1:8005",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
for origin in settings.cors_origins_list:
    if origin and origin not in origins:
        origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Routes
app.include_router(api_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": "StudyVerse API"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8005))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)
