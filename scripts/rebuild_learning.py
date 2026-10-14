"""Rebuild derived learning states without modifying historical journal evidence."""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import asyncpg
from dotenv import load_dotenv
from progress.learning import save_learning_projection
from progress.connection import connect


async def main():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    dsn = os.getenv("PROGRESS_DATABASE_URL")
    if not dsn:
        print("PROGRESS_DATABASE_URL is not configured.")
        return 1
    conn = await connect(dsn, statement_cache_size=0, timeout=10)
    try:
        learners = await conn.fetch("SELECT DISTINCT learner_id FROM practice_journal")
        count = 0
        for row in learners:
            async with conn.transaction():
                await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", str(row["learner_id"]))
                items = await save_learning_projection(conn, row["learner_id"],
                    datetime.now(timezone(timedelta(hours=-5))).date())
                count += len(items)
        print(f"Rebuilt {count} learning items from existing evidence; history unchanged.")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
