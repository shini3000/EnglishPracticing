"""Measured practice state and append-only per-learner evidence."""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta, timezone

import asyncpg
from livekit.agents import function_tool

logger = logging.getLogger(__name__)
DAILY_STEPS = [
    ("Preparación", 5), ("Recuperación sin leer", 15),
    ("Conversación espontánea", 20), ("Selección", 5),
    ("Gramática aplicada", 20), ("Enlace e instrucciones", 2),
    ("Primera escucha", 6), ("Segunda escucha", 6),
    ("Shadowing", 8), ("Paraphrasing", 8),
    ("Conversación principal", 25), ("Taller léxico", 15),
    ("Grabación y registro", 10),
]
DIAGNOSTIC_STEPS = [
    ("Presentación y presente", 4), ("Pasado y -ed", 5),
    ("Futuro y planes", 4), ("Vocabulario y explicación", 5),
    ("Narración y opinión", 10), ("Reparación", 2), ("Evaluación", 5),
]


class Practice:
    def __init__(self, learner_id: str | None, room, dsn: str | None, mode: str, language: str):
        self.learner_id, self.room, self.dsn = learner_id, room, dsn
        self.mode, self.language = mode, language
        self.steps = DIAGNOSTIC_STEPS if mode == "diagnostic" else DAILY_STEPS
        self.index = 0
        self.elapsed = 0.0
        self.since: float | None = None
        self.started = False
        self.finished = False
        self.completed: list[dict] = []
        self.entries: list[dict] = []
        self.saved = 0

    def status(self) -> dict:
        elapsed = self.elapsed + (time.monotonic() - self.since if self.since is not None else 0)
        return {
            "mode": self.mode, "step": self.steps[self.index][0],
            "step_index": self.index, "elapsed_seconds": int(elapsed),
            "remaining_seconds": max(0, int(self.steps[self.index][1] * 60 - elapsed)),
            "running": self.since is not None, "started": self.started,
            "finished": self.finished, "completed": list(self.completed),
        }

    async def publish(self) -> None:
        try:
            await self.room.local_participant.publish_data(
                json.dumps(self.status()).encode(), reliable=True, topic="practice"
            )
        except Exception:
            logger.warning("Could not publish practice timer", exc_info=True)

    async def append(self, kind: str, evidence: dict) -> bool:
        entry = {
            "kind": kind, "date": datetime.now(timezone(timedelta(hours=-5))).date().isoformat(),
            "mode": self.mode, "native_language": self.language, **evidence,
        }
        self.entries.append(entry)
        return await self.flush()

    async def flush(self) -> bool:
        if not self.dsn or not self.learner_id:
            return False
        conn = None
        try:
            conn = await asyncpg.connect(self.dsn, statement_cache_size=0, timeout=8)
            while self.saved < len(self.entries):
                await conn.execute(
                    "INSERT INTO practice_journal (learner_id, room_name, entry) VALUES ($1,$2,$3::jsonb)",
                    self.learner_id, self.room.name, json.dumps(self.entries[self.saved]),
                )
                self.saved += 1
            return True
        except Exception:
            logger.warning("Practice journal unavailable; evidence remains in session", exc_info=True)
            return False
        finally:
            if conn is not None:
                await conn.close()

    async def history(self) -> str:
        if not self.dsn or not self.learner_id:
            return ""
        conn = None
        try:
            conn = await asyncpg.connect(self.dsn, statement_cache_size=0, timeout=8)
            rows = await conn.fetch(
                "SELECT entry FROM practice_journal WHERE learner_id=$1 ORDER BY created_at DESC LIMIT 80",
                self.learner_id,
            )
            return "\n".join(str(row["entry"]) for row in reversed(rows))
        except Exception:
            logger.warning("Practice history unavailable", exc_info=True)
            return ""
        finally:
            if conn is not None:
                await conn.close()

    @function_tool
    async def practice_control(self, action: str, evidence: str = "") -> str:
        """Control measured timer: start, status, pause, resume, next or finish.

        Start after topic confirmation. Next requires observed completion evidence.
        Finish leaves remaining steps pending. Never advance while the learner is speaking.
        """
        if action not in {"start", "status", "pause", "resume", "next", "finish"}:
            return "Invalid action."
        if self.finished:
            return json.dumps(self.status())
        if action == "start" and not self.started:
            self.started, self.since = True, time.monotonic()
        elif action in {"pause", "next", "finish"}:
            if action == "next" and (not evidence.strip() or not self.started):
                return "Next requires a started practice and concrete completion evidence."
            if self.since is not None:
                self.elapsed += time.monotonic() - self.since
                self.since = None
            if action == "next":
                status = self.status()
                record = {"step": status["step"], "elapsed_seconds": status["elapsed_seconds"], "evidence": evidence}
                self.completed.append(record)
                await self.append("step", {"step": record["step"], "seconds": record["elapsed_seconds"], "evidence": evidence})
                if self.index + 1 < len(self.steps):
                    self.index += 1
                    self.elapsed, self.since = 0, time.monotonic()
                else:
                    action = "finish"
            if action == "finish":
                self.finished = True
                await self.append("session", {"timer": self.status(), "pending": [name for name, _ in self.steps[len(self.completed):]], "evidence": evidence})
        elif action == "resume" and self.started and self.since is None:
            self.since = time.monotonic()
        await self.publish()
        return json.dumps(self.status())

    @function_tool
    async def record_learning(self, kind: str, details_json: str) -> str:
        """Append evidence and show it in the practice journal.

        kind: correction, vocabulary, retrieval, listening, assessment, feedback.
        Supply a JSON object with concrete learner evidence. Vocabulary requires element,
        observed_need, meaning, pattern, pronunciation, restrictions, collocations,
        examples (two different contexts), and transfer_task.
        Retrieval requires element, result (unaided, helped, failed), and evidence.
        Pronunciation scores must remain pending: only transcripts are available.
        """
        if kind not in {"correction", "vocabulary", "retrieval", "listening", "assessment", "feedback"}:
            return "Invalid entry kind."
        try:
            data = json.loads(details_json)
        except ValueError:
            return "Provide valid JSON."
        if not isinstance(data, dict):
            return "Provide a JSON object."
        if kind == "vocabulary":
            required = {"element", "observed_need", "meaning", "pattern", "pronunciation", "restrictions", "collocations", "examples", "transfer_task"}
            if not required.issubset(data) or not isinstance(data["examples"], list) or len(data["examples"]) < 2:
                return "Incomplete lexical card: provide all required fields and two examples."
            today = datetime.now(timezone(timedelta(hours=-5))).date()
            data["reviews"] = [(today + timedelta(days=d)).isoformat() for d in (1, 3, 7, 14)]
            data["state"] = "EN PRÁCTICA"
        if kind == "retrieval":
            if not data.get("element") or not data.get("evidence") or data.get("result") not in {"unaided", "helped", "failed"}:
                return "Retrieval needs element, result and evidence."
            # Activation is derived from append-only attempts, never an LLM assertion.
            history = await self.history()
            dates = {
                row.get("date") for line in history.splitlines()
                if (row := json.loads(line)).get("kind") == "retrieval"
                and row.get("element") == data["element"] and row.get("result") == "unaided"
            }
            dates.update(e["date"] for e in self.entries if e["kind"] == "retrieval" and e.get("element") == data["element"] and e.get("result") == "unaided")
            if data["result"] == "unaided":
                dates.add(datetime.now(timezone(timedelta(hours=-5))).date().isoformat())
            data["state"] = "ACTIVA" if len(dates) >= 2 and data["result"] != "failed" else "EN PRÁCTICA"
        data.pop("kind", None)
        data.pop("date", None)
        saved = await self.append(kind, data)
        try:
            await self.room.local_participant.publish_data(
                json.dumps({"entry": self.entries[-1], "saved": saved}).encode(),
                reliable=True, topic="practice-journal",
            )
        except Exception:
            logger.warning("Could not publish learning entry", exc_info=True)
        return json.dumps({"saved": saved, "entry": self.entries[-1]})
