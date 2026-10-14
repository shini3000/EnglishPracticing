"""Live transactional storage check. All synthetic evidence is rolled back."""
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from progress.connection import connect
from progress.learning import save_learning_projection


async def main():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    conn = await connect(os.environ["PROGRESS_DATABASE_URL"])
    transaction = conn.transaction()
    await transaction.start()
    try:
        learner = await conn.fetchval(
            "INSERT INTO learners (display_name) VALUES ('Temporary storage check') RETURNING id")
        room = "storage-check-" + uuid.uuid4().hex
        events = [
            {"kind": "vocabulary", "element": "listen to", "date": "2026-01-01"},
            *[{"kind": "retrieval", "item_type": "vocabulary", "element": "listen to",
               "date": day, "result": "unaided", "attempt_type": "transfer",
               "observed": True, "context": context, "evidence": evidence}
              for day, context, evidence in [
                  ("2026-01-01", "music", "I listen to music."),
                  ("2026-01-03", "work", "I listen to my colleagues."),
                  ("2026-01-08", "travel", "I listen to announcements."),
              ]],
        ]
        for event in events:
            event_id = uuid.uuid4()
            await conn.execute(
                "INSERT INTO practice_journal (id,learner_id,room_name,entry) VALUES ($1,$2,$3,$4::jsonb)",
                event_id, learner, room, json.dumps(event))
            # Repeat transmission must not duplicate evidence.
            await conn.execute(
                """INSERT INTO practice_journal (id,learner_id,room_name,entry)
                   VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO NOTHING""",
                event_id, learner, room, json.dumps(event))
        items = await save_learning_projection(conn, learner, date(2026, 1, 10))
        assert items[0]["state"] == "CONSOLIDADA", items[0]["state"]
        assert items[0]["attempt_count"] == 3
        snapshot = await conn.fetchval("SELECT snapshot FROM learner_learning_items WHERE learner_id=$1", learner)
        assert json.loads(snapshot)["span_days"] == 7
        print("PASS: real database stores evidence and progressive states without duplicates.")
    finally:
        await transaction.rollback()
        await conn.close()
        print("Synthetic checks rolled back; no test learner or practice retained.")


if __name__ == "__main__":
    asyncio.run(main())
