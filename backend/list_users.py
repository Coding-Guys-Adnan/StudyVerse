"""List all registered users in the StudyVerse database."""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main():
    engine = create_async_engine("sqlite+aiosqlite:///./studyverse.db")
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at")
        )
        rows = result.fetchall()
        if not rows:
            print("No users found.")
            return

        print()
        print(f"  {'#':<4} {'Email':<35} {'Name':<25} {'Role':<10} {'Created At'}")
        print("  " + "-" * 95)
        for i, r in enumerate(rows, 1):
            print(f"  {i:<4} {r[1]:<35} {r[2]:<25} {r[3]:<10} {r[4]}")
        print(f"\n  Total accounts: {len(rows)}\n")

    await engine.dispose()


asyncio.run(main())
