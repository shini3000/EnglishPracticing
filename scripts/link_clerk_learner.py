"""Explicit admin-only link of an existing learner to a verified Clerk user ID.

Dry-run by default. No passwords, cookies, name-based matching or history copying.
Run before the account's first authorized visit; never reassign an existing binding.
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path
import re
import sys
from uuid import UUID

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


async def link(conn, learner_id: UUID, user_id: str, apply: bool) -> str:
    async with conn.transaction():
        rows = await conn.fetch(
            "SELECT id, clerk_user_id FROM learners WHERE id = $1 OR clerk_user_id = $2 FOR UPDATE",
            learner_id, user_id,
        )
        target = next((row for row in rows if row["id"] == learner_id), None)
        if target is None:
            raise ValueError("Learner UUID does not exist")
        if any(row["id"] != learner_id for row in rows):
            raise ValueError("Clerk account is already linked to another learner; refusing to merge")
        if target["clerk_user_id"] == user_id:
            return "Already linked; nothing changed"
        if target["clerk_user_id"] is not None:
            raise ValueError("Learner already belongs to another Clerk account")
        if not apply:
            return "Dry-run OK. Verify ownership in Clerk, then repeat with --apply"
        # The unique index also rejects a concurrent first-login binding to another UUID.
        await conn.execute(
            "UPDATE learners SET clerk_user_id = $1 WHERE id = $2 AND clerk_user_id IS NULL",
            user_id, learner_id,
        )
        return "Linked existing learner; UUID and all progress preserved"


async def run(args) -> int:
    load_dotenv(ROOT / ".env")
    dsn = os.environ.get("PROGRESS_DATABASE_URL")
    if not dsn:
        raise ValueError("PROGRESS_DATABASE_URL is required")
    from progress.connection import connect
    conn = await connect(dsn, statement_cache_size=0)
    try:
        print(await link(conn, args.learner_id, args.clerk_user_id, args.apply))
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--learner-id", required=True, type=UUID)
    parser.add_argument("--clerk-user-id", required=True)
    parser.add_argument("--apply", action="store_true", help="Persist the explicitly approved binding")
    arguments = parser.parse_args()
    if not re.fullmatch(r"user_[A-Za-z0-9]+", arguments.clerk_user_id):
        parser.error("Expected a Clerk user_... ID from your application's dashboard")
    try:
        raise SystemExit(asyncio.run(run(arguments)))
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
