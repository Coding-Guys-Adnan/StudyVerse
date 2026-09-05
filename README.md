# 🎓 StudyVerse - AI-Powered Tuition Management & Student Progress Tracking

StudyVerse is a full-stack platform designed for tuition management, student tracking, syllabus organization, homework assignments, test scheduling, and AI-driven recommendations.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (TypeScript, React, Vanilla CSS / CSS Modules, React Query, Axios)
- **Backend:** FastAPI (Python, SQLAlchemy 2.0 Async, Pydantic v2, Alembic)
- **Database:** 
  - **Local Development:** SQLite (`studyverse.db`)
  - **Production:** Supabase PostgreSQL (`asyncpg` / `psycopg2`)
- **File Storage:**
  - **Local Development:** Local disk (`backend/uploads/`)
  - **Production:** Supabase Storage (`studyverse-uploads` bucket)
- **Authentication:** JWT (JSON Web Tokens) with Role-Based Access Control (Admin, Teacher, Student)

---

## 💻 Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run Alembic migrations (creates SQLite database studyverse.db)
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8005
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

The frontend will run at `http://localhost:3005` and connect to the backend at `http://localhost:8005`.

---

## 🚀 Internet Deployment Guide

Follow these steps to deploy StudyVerse to production for free.

### Step 1: Create GitHub Repository
1. Initialize Git in the project root if not already done:
   ```bash
   git init
   git add .
   git commit -m "Initial StudyVerse commit"
   ```
2. Push your repository to GitHub (ensure `.env` and `studyverse.db` are ignored by `.gitignore`).

---

### Step 2: Set up Supabase (PostgreSQL & Storage)
1. Go to [Supabase](https://supabase.com) and create a free project.
2. Note your **Database Connection String** under `Project Settings -> Database`:
   `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`
3. Go to **Storage**, create a new **Public Bucket** named `studyverse-uploads`.
4. Get your API credentials from `Project Settings -> API`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

### Step 3: Run Database Migrations on Supabase
Run Alembic migrations from your machine pointing to your remote Supabase database:
```bash
cd backend
# Set your Supabase Database URL
set DATABASE_URL=postgresql+psycopg2://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
alembic upgrade head
```

*(Optional: If you have existing development data in `studyverse.db` and local files in `backend/uploads/` that you want to upload to Supabase, run the migration utilities:)*
```bash
set TARGET_DATABASE_URL=postgresql+psycopg2://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
set SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
set SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]

python scripts/migrate_sqlite_to_postgres.py
python scripts/migrate_local_files_to_supabase.py
```

---

### Step 4: Deploy FastAPI Backend to Render
1. Sign in to [Render](https://render.com) and create a new **Web Service**.
2. Connect your GitHub repository.
3. Set the following settings:
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add **Environment Variables** in the Render Dashboard:
   - `DATABASE_URL` = `postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`
   - `SECRET_KEY` = `[YOUR-RANDOM-PRODUCTION-JWT-SECRET]`
   - `FRONTEND_URL` = `https://[YOUR-VERCEL-APP].vercel.app`
   - `SUPABASE_URL` = `https://[YOUR-PROJECT-REF].supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `[YOUR-SUPABASE-SERVICE-ROLE-KEY]`
   - `SUPABASE_BUCKET` = `studyverse-uploads`

---

### Step 5: Deploy Next.js Frontend to Vercel
1. Sign in to [Vercel](https://vercel.com) and import your GitHub repository.
2. Select `frontend` as the **Root Directory**.
3. Add the **Environment Variable**:
   - `NEXT_PUBLIC_API_URL` = `https://[YOUR-RENDER-APP].onrender.com`
4. Click **Deploy**.

---

## 🔒 Verification & Testing Checklist

After deployment, test the following flows:
1. **Authentication:** Register a student account or log in with admin/teacher credentials. Verify JWT token issuance.
2. **CORS:** Ensure browser requests succeed from Vercel to Render without CORS errors.
3. **Student Portal:** Log into the student portal and view assigned teachers, homeworks, and syllabus progress.
4. **Teacher Portal:** Verify teacher can manage students, assign homework, upload syllabus attachments, and record attendance.
5. **Admin Portal:** Check admin management of teachers and student assignments.
6. **File Attachments:** Upload a test PDF/image attachment in syllabus notes and confirm it loads from Supabase Storage (`https://[YOUR-PROJECT-REF].supabase.co/...`).

---

## 📦 Backup, Export & Local Restore System

StudyVerse includes an enterprise-grade, secure Data Backup and Local Restore system. This allows administrators to download complete backups from the production deployment (Supabase PostgreSQL + Supabase Storage) and safely restore them into a local development environment (SQLite + local disk) for offline development, debugging, and recovery.

### 🌟 Key Features
- **Dynamic Table Discovery:** Exports all 18 application tables in topological foreign-key order using SQLAlchemy metadata (`Base.metadata.sorted_tables`).
- **Archive Integrity & Manifest:** Backups include `manifest.json` with schema revision, file hashes (SHA-256), and metadata.
- **Strict Role-Based Authorization:** Accessible exclusively to users with `role == "admin"`. Teachers, students, and unauthenticated users are rejected.
- **Security & Privacy:** Plaintext passwords, API keys, `.env` files, and secrets are strictly excluded. Password hashes are preserved for account login restoration.
- **Safety Backups:** Destructive operations automatically create a timestamped backup of the local database (`studyverse_before_restore_*.db`).
- **Universal URL Normalization:** Rewrites remote Supabase URLs (`https://.../storage/v1/object/public/...`) to local paths (`/uploads/...`), enabling 100% offline functionality.

### 1. Generating & Downloading Backups (Production)
1. Sign in to StudyVerse as an **Admin** (`/login`).
2. Navigate to **Backup & Data** (`/admin/backup`) in the Admin sidebar.
3. Review the live database records count, uploaded file count, and estimated archive size.
4. Click **Download Full Backup** (or choose **Download Database Only** / **Download Files Only**).
5. The browser will securely stream and download `StudyVerse_Backup_[type]_[timestamp].zip`.

### 2. Restoring a Backup Locally (Development)
Use the built-in CLI utility in `backend/`:

```bash
cd backend

# Syntax:
python -m app.cli restore-backup <path-to-zip> [--mode merge|replace] [--yes]
```

#### Restore Modes:
- **`--mode merge` (Default):** Safe, non-destructive upsert. Calculates a merge plan, detects conflicts, updates matching records, and inserts new records without clearing existing data.
  ```bash
  python -m app.cli restore-backup path/to/StudyVerse_Backup_full_2026-09-05.zip --mode merge
  ```
- **`--mode replace`:** Destructive clean restore. Prompts for typing `REPLACE` (or bypass with `--yes`), creates an automatic safety backup of `studyverse.db`, wipes current tables in reverse foreign-key order, and inserts all backup records.
  ```bash
  python -m app.cli restore-backup path/to/StudyVerse_Backup_full_2026-09-05.zip --mode replace
  ```

#### Preflight Checks Performed Automatically:
1. Archive format integrity and path traversal (ZipSlip) defense.
2. Manifest presence, application name, and backup format version compatibility.
3. JSON syntax and table structure validation.
4. Primary key uniqueness and non-nullable field validation.
5. Foreign-key referential integrity validation across exported datasets.
6. SHA-256 checksum verification for every uploaded attachment file.

