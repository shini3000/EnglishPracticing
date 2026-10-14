"""Local durable retry queue for practice evidence when Postgres is unavailable."""
import json
import sqlite3
from contextlib import closing
from pathlib import Path


class PendingEvidence:
    def __init__(self, path: Path | None = None):
        self.path = path or Path(__file__).resolve().parents[1] / ".data" / "practice-pending.sqlite3"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute("CREATE TABLE IF NOT EXISTS pending (id TEXT PRIMARY KEY, learner TEXT, entry TEXT)")

    def add(self, learner_id: str, entry: dict):
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.execute("INSERT OR IGNORE INTO pending VALUES (?,?,?)",
                         (entry["event_id"], learner_id, json.dumps(entry)))

    def read(self, learner_id: str) -> list[dict]:
        with closing(sqlite3.connect(self.path)) as conn:
            rows = conn.execute("SELECT entry FROM pending WHERE learner=? ORDER BY rowid", (learner_id,))
            return [json.loads(row[0]) for row in rows]

    def acknowledge(self, learner_id: str, ids: list[str]):
        with closing(sqlite3.connect(self.path)) as conn, conn:
            conn.executemany("DELETE FROM pending WHERE learner=? AND id=?",
                             [(learner_id, event_id) for event_id in ids])
