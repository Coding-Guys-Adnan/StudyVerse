import asyncio
import sys
import argparse
import shutil
import tempfile
from pathlib import Path

from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.user import User
from app.core.security import hash_password
from app.services.restore_service import (
    validate_preflight,
    create_safety_backup,
    calculate_merge_plan,
    restore_database_transactional,
    restore_files,
)


async def create_admin(email: str, password: str, name: str):
    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            if existing.role != "admin":
                existing.role = "admin"
                existing.is_active = True
                existing.password_hash = hash_password(password)
                existing.full_name = name
                await db.commit()
                print(f"[+] User '{email}' updated to ADMIN successfully.")
            else:
                print(f"[!] Admin with email '{email}' already exists.")
            return

        admin_user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=name,
            role="admin",
            is_active=True,
        )
        db.add(admin_user)
        await db.commit()
        print(f"[+] Admin account '{email}' created successfully.")


async def restore_backup(zip_path_str: str, mode: str = "merge", auto_confirm: bool = False):
    zip_path = Path(zip_path_str).resolve()
    temp_dir = Path(tempfile.mkdtemp(prefix="studyverse_restore_"))

    print("\n" + "=" * 60)
    print("      STUDYVERSE BACKUP VALIDATION & RESTORE UTILITY")
    print("=" * 60)
    print(f"[*] Target Backup File: {zip_path}")
    print(f"[*] Restore Mode:       {mode.upper()}")
    print("\n--- PREFLIGHT VALIDATION ---")
    print("[1/5] Checking archive integrity and path safety...")
    print("[2/5] Validating manifest.json and version compatibility...")
    print("[3/5] Validating database structure and primary keys...")
    print("[4/5] Cross-checking foreign-key referential integrity...")
    print("[5/5] Verifying SHA-256 checksums for uploaded files...")

    try:
        is_valid, manifest, errors = validate_preflight(zip_path, temp_dir)

        if not is_valid or errors:
            print("\n" + "!" * 60)
            print("[ERROR] PREFLIGHT VALIDATION FAILED! Cannot proceed with restore.")
            print("!" * 60)
            for err in errors:
                print(f" ❌ {err}")
            shutil.rmtree(temp_dir, ignore_errors=True)
            sys.exit(1)

        print("\n✅ PREFLIGHT PASSED: Backup is valid and ready to restore.")
        print("-" * 60)
        print(f"Application:       {manifest.get('application')}")
        print(f"Backup Version:    {manifest.get('backup_version')}")
        print(f"Created At:        {manifest.get('created_at')}")
        print(f"Source Env:        {manifest.get('environment')} ({manifest.get('database_type')} / {manifest.get('file_storage')})")
        print(f"Schema Revision:   {manifest.get('schema_revision')}")
        print(f"Total Records:     {manifest.get('total_records', 0)}")
        print(f"Total Files:       {manifest.get('files_count', 0)}")
        print("-" * 60)

        tables = manifest.get("tables", {})
        if tables:
            print("Table Summary:")
            for t_name, count in tables.items():
                print(f"  • {t_name:<24}: {count} records")

        async with async_session_maker() as db:
            # Merge Plan
            if mode == "merge":
                print("\n[*] Calculating merge plan against local SQLite database...")
                plan = await calculate_merge_plan(db, temp_dir, manifest)
                print(f"  • Records to Insert:   {plan['total_inserts']}")
                print(f"  • Records to Update:   {plan['total_updates']}")
                print(f"  • Records Unchanged:   {plan['total_unchanged']}")
                if plan["conflicts"]:
                    print("\n[!] Conflicts detected:")
                    for c in plan["conflicts"]:
                        print(f"    - {c}")
                    if not auto_confirm:
                        resp = input("\nProceed with merge despite detected conflicts? (yes/no): ").strip().lower()
                        if resp not in ("yes", "y"):
                            print("[!] Merge aborted by user.")
                            shutil.rmtree(temp_dir, ignore_errors=True)
                            return

            # Replace Mode Safety
            elif mode == "replace":
                safety_path = create_safety_backup()
                if safety_path:
                    print(f"\n[+] Created automatic safety backup of current local database:\n    {safety_path}")

                if not auto_confirm:
                    print("\n" + "!" * 60)
                    print("WARNING: REPLACE MODE IS DESTRUCTIVE!")
                    print("This operation will clear all existing local StudyVerse records")
                    print("and replace them with records from the backup archive.")
                    if safety_path:
                        print(f"Safety copy saved at: {safety_path.name}")
                    print("!" * 60)
                    confirm = input('\nType "REPLACE" to continue with destructive restore: ').strip()
                    if confirm != "REPLACE":
                        print("[!] Operation cancelled by user. Local database unchanged.")
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        return

            # Execute Transactional Restore
            print(f"\n[*] Executing atomic transactional database restore ({mode} mode)...")
            restored_counts = await restore_database_transactional(
                db=db,
                extracted_dir=temp_dir,
                manifest=manifest,
                mode=mode,
            )

            # Restore Files
            print("[*] Restoring uploaded files to backend/uploads/ and normalizing URLs...")
            files_restored = restore_files(temp_dir, manifest)

            print("\n" + "=" * 60)
            print("         RESTORE COMPLETED SUCCESSFULLY! 🎉")
            print("=" * 60)
            print(f"Mode Applied:      {mode.upper()}")
            print(f"Records Restored:  {sum(restored_counts.values())}")
            print(f"Files Restored:    {files_restored}")
            print(f"URL Normalization: Remote Supabase URLs converted to local /uploads/")
            print("\nYou can now start the local StudyVerse app offline:")
            print("  backend:  uvicorn app.main:app --reload --port 8005")
            print("  frontend: npm run dev")
            print("=" * 60 + "\n")

    except Exception as e:
        print("\n" + "!" * 60)
        print(f"[ERROR] Restore failed: {e}")
        print("Database transaction has been completely rolled back.")
        print("!" * 60)
        sys.exit(1)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="StudyVerse CLI Utilities")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # create-admin
    admin_parser = subparsers.add_parser("create-admin", help="Create an Admin account")
    admin_parser.add_argument("--email", required=True, help="Admin email address")
    admin_parser.add_argument("--password", required=True, help="Admin password")
    admin_parser.add_argument("--name", default="System Admin", help="Admin full name")

    # restore-backup
    restore_parser = subparsers.add_parser("restore-backup", help="Restore StudyVerse backup into local environment")
    restore_parser.add_argument("zip_path", help="Path to the StudyVerse_Backup_*.zip archive")
    restore_parser.add_argument(
        "--mode",
        choices=["merge", "replace"],
        default="merge",
        help="Restore strategy: 'merge' (default, safe upsert) or 'replace' (destructive rebuild)",
    )
    restore_parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip interactive confirmation prompt",
    )

    args = parser.parse_args()

    if args.command == "create-admin":
        asyncio.run(create_admin(args.email, args.password, args.name))
    elif args.command == "restore-backup":
        asyncio.run(restore_backup(args.zip_path, mode=args.mode, auto_confirm=args.yes))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
