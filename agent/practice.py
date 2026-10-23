"""Measured practice state and append-only per-learner evidence."""
from __future__ import annotations

import json
import logging
import time
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
from livekit.agents import function_tool
from progress.learning import build_learning_items, save_learning_projection, item_identity
from progress.pending import PendingEvidence
from progress.connection import connect as connect_database
from prompts.fluency import FLUENCY_STAGES

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
        self.steps = ([(label, minutes) for label, minutes, _, _ in FLUENCY_STAGES]
                      if mode == "fluency" else DIAGNOSTIC_STEPS if mode == "diagnostic" else DAILY_STEPS)
        self.index = 0
        self.elapsed = 0.0
        self.since: float | None = None
        self.started = False
        self.finished = False
        self.completed: list[dict] = []
        self.entries: list[dict] = []
        self.saved = 0
        self.quota_status: dict = {"state": "ready"}
        self.focus = ""
        self.feedback_ready = False
        self.feedback_summary = ""
        self.latest_user_text = ""
        self._flush_lock = asyncio.Lock()
        self._modeled_examples: set[str] = set()
        self._manual_lock = asyncio.Lock()
        self._manual_ids: set[str] = set()
        try:
            self.pending = PendingEvidence() if learner_id else None
        except Exception:
            logger.warning("Local evidence queue unavailable; remote saving remains enabled", exc_info=True)
            self.pending = None
        self.local_pending = False

    def status(self) -> dict:
        elapsed = self.elapsed + (time.monotonic() - self.since if self.since is not None else 0)
        return {
            "mode": self.mode, "step": self.steps[self.index][0],
            "step_index": self.index, "elapsed_seconds": int(elapsed),
            "step_count": len(self.steps),
            "route": [{"label": label, "minutes": minutes,
                       "block": ("Bloque " + ("4 · Agilidad y síntesis" if i in {11, 13} else FLUENCY_STAGES[i][2]) if self.mode == "fluency" else
                                 "Diagnóstico" if self.mode == "diagnostic" else
                                 "Bloque 1 · Recuperación y diagnóstico" if i < 4 else
                                 "Bloque 2 · Estructura y escucha" if i < 10 else
                                 "Bloque 3 · Transferencia y cierre"),
                       "completed": any(record["step"] == label for record in self.completed)}
                      for i, (label, minutes) in enumerate(self.steps)],
            "step_duration_seconds": self.steps[self.index][1] * 60,
            "block": ("Bloque " + ("4 · Agilidad y síntesis" if self.index in {11, 13} else FLUENCY_STAGES[self.index][2]) if self.mode == "fluency" else
                      "Diagnóstico" if self.mode == "diagnostic" else
                      "Bloque 1 · Recuperación y diagnóstico" if self.index < 4 else
                      "Bloque 2 · Estructura y escucha" if self.index < 10 else
                      "Bloque 3 · Transferencia y cierre"),
            "remaining_seconds": max(0, int(self.steps[self.index][1] * 60 - elapsed)),
            "running": self.since is not None, "started": self.started,
            "finished": self.finished, "completed": list(self.completed),
            "quota": self.quota_status,
            "feedback_ready": self.feedback_ready,
            "feedback_summary": self.feedback_summary,
        }

    async def publish(self) -> None:
        try:
            await self.room.local_participant.publish_data(
                json.dumps(self.status()).encode(), reliable=True, topic="practice"
            )
        except Exception:
            logger.warning("Could not publish practice timer", exc_info=True)

    async def manual_control(self, payload: bytes) -> None:
        """Authenticated participant commands, no LLM interpretation required."""
        if len(payload) > 4096:
            return
        try:
            data = json.loads(payload)
        except (ValueError, UnicodeError):
            return
        if not isinstance(data, dict):
            return
        action, request_id = data.get("action"), data.get("request_id")
        evidence = data.get("evidence", "")
        if (action not in {"start", "pause", "resume", "next", "finish", "select_block"}
                or not isinstance(request_id, str) or not request_id or len(request_id) > 80
                or not isinstance(evidence, str) or len(evidence) > 600):
            return
        async with self._manual_lock:
            if data.get("step_index") != self.index:
                return  # stale/double-click command cannot skip another step
            if request_id in self._manual_ids:
                return
            if action == "select_block":
                target = data.get("target_step")
                route = self.status()["route"]
                starts = [i for i, step in enumerate(route) if i == 0 or step["block"] != route[i - 1]["block"]]
                if type(target) is not int or target not in starts or target == self.index or self.finished:
                    return
                self._manual_ids.add(request_id)
                previous = self.status()
                await self.append("block_navigation", {"from_step": self.index, "to_step": target,
                                  "seconds": previous["elapsed_seconds"], "evidence": "Learner selected a block; no completion claimed."})
                self.index = target
                self.elapsed, self.since = 0.0, None
                self.started = False
                self.focus = ""
                self.feedback_ready = False
                self.feedback_summary = ""
                await self.publish()
                return
            if action in {"start", "next"} and not evidence.strip():
                return
            if action == "resume" and self.quota_status.get("state") in {"daily_limit", "waiting", "limited"}:
                return
            self._manual_ids.add(request_id)
            await self._practice_control(action, evidence, learner_requested=True)
            logger.info("practice.manual_control", extra={"action": action, "step_index": self.index})

    def model_status(self) -> str:
        state = self.status()
        return json.dumps({key: state[key] for key in
                           ("step", "step_index", "remaining_seconds", "running", "started", "finished")})

    async def append(self, kind: str, evidence: dict) -> bool:
        saved, _ = await self.append_event(kind, evidence)
        return saved

    async def append_event(self, kind: str, evidence: dict) -> tuple[bool, dict]:
        entry = {
            "kind": kind, "date": datetime.now(timezone(timedelta(hours=-5))).date().isoformat(),
            "mode": self.mode, "native_language": self.language, **evidence,
        }
        entry["event_id"] = str(uuid.uuid4())
        entry["recorded_at"] = datetime.now(timezone.utc).isoformat()
        entry["date"] = datetime.fromisoformat(entry["recorded_at"]).astimezone(timezone(timedelta(hours=-5))).date().isoformat()
        entry["room_name"] = self.room.name
        self.entries.append(entry)
        if self.pending:
            try:
                await asyncio.to_thread(self.pending.add, self.learner_id, entry)
                self.local_pending = True
            except Exception:
                logger.warning("Local evidence queue unavailable; keep visible notes", exc_info=True)
        return await self.flush(), entry

    async def flush(self) -> bool:
        async with self._flush_lock:
            return await self._flush_locked()

    async def _flush_locked(self) -> bool:
        if not self.dsn or not self.learner_id:
            return False
        conn = None
        try:
            conn = await connect_database(self.dsn, statement_cache_size=0, timeout=8)
            count = len(self.entries)
            pending = await asyncio.to_thread(self.pending.read, self.learner_id) if self.pending else []
            combined = {entry["event_id"]: entry for entry in pending + self.entries[self.saved:count]}
            async with conn.transaction():
                await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", str(self.learner_id))
                for entry in combined.values():
                    await conn.execute(
                        """INSERT INTO practice_journal (id,learner_id,room_name,entry,created_at)
                           VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (id) DO NOTHING""",
                        entry["event_id"], self.learner_id, entry["room_name"], json.dumps(entry),
                        datetime.fromisoformat(entry["recorded_at"]),
                    )
                await save_learning_projection(conn, self.learner_id,
                                               datetime.now(timezone(timedelta(hours=-5))).date())
            # Advance only after the entire transaction committed.
            self.saved = count
            if self.pending:
                await asyncio.to_thread(self.pending.acknowledge, self.learner_id, list(combined))
                self.local_pending = False
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
            conn = await connect_database(self.dsn, statement_cache_size=0, timeout=8)
            # Recover queued evidence from earlier calls on this machine first.
            if self.pending:
                pending = await asyncio.to_thread(self.pending.read, self.learner_id)
                if pending:
                    async with conn.transaction():
                        await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", str(self.learner_id))
                        for entry in pending:
                            await conn.execute(
                                """INSERT INTO practice_journal (id,learner_id,room_name,entry,created_at)
                                   VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (id) DO NOTHING""",
                                entry["event_id"], self.learner_id, entry["room_name"], json.dumps(entry),
                                datetime.fromisoformat(entry["recorded_at"]))
                    await asyncio.to_thread(self.pending.acknowledge, self.learner_id,
                                            [entry["event_id"] for entry in pending])
            async with conn.transaction():
                await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", str(self.learner_id))
                items = await save_learning_projection(conn, self.learner_id,
                                                       datetime.now(timezone(timedelta(hours=-5))).date())
            rows = await conn.fetch(
                "SELECT entry FROM practice_journal WHERE learner_id=$1 ORDER BY created_at DESC LIMIT 80",
                self.learner_id,
            )
            # Keep older vocabulary visible even after many newer conversations.
            bank = [{"entry": {"kind": "learning_snapshot", **item}} for item in items]
            entries = [json.loads(row["entry"]) if isinstance(row["entry"], str) else row["entry"]
                       for row in list(rows) + list(bank)]
            entries.sort(key=lambda entry: entry.get("date", ""))
            return "\n".join(json.dumps(entry) for entry in entries)
        except Exception:
            logger.warning("Practice history unavailable", exc_info=True)
            return ""
        finally:
            if conn is not None:
                await conn.close()

    @function_tool
    async def practice_control(self, action: str, evidence: str = "") -> str:
        """Timer: start/status/pause/resume/next/finish. Start evidence=topic and goal; next evidence=completed task."""
        return await self._practice_control(action, evidence)

    async def _practice_control(self, action: str, evidence: str = "", *, learner_requested: bool = False) -> str:
        if action not in {"start", "status", "pause", "resume", "next", "finish"}:
            return "Invalid action."
        if self.finished:
            return self.model_status()
        if self.mode == "fluency" and self.index == 4 and action == "next":
            if not learner_requested:
                return "Do not advance block 2 yourself. Finish written feedback first; the learner chooses when to continue. Record feedback with a nonempty summary after the correction cards."
            if not self.feedback_ready:
                return "Written monologue feedback is still pending. Stay in block 2."
        if self.mode == "fluency" and 5 <= self.index <= 14 and action in {"start", "resume", "next"}:
            path = "/practice-b/agility" if self.index >= 9 else "/practice-b/input"
            return f"This block runs outside the tutor conversation. Open {path}."
        if action == "start" and not self.started:
            self.feedback_ready = False
            self.feedback_summary = ""
            self.started, self.since = True, time.monotonic()
            if evidence.strip():
                self.focus = evidence[:600]
                await self.append("focus", {"evidence": self.focus})
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
                    self.feedback_ready = False
                    self.feedback_summary = ""
                    self.elapsed, self.since = 0, time.monotonic()
                    if self.mode == "fluency" and self.index == 5:
                        self.since = None
                        self.started = False
                else:
                    action = "finish"
            if action == "finish":
                self.finished = True
                completed_names = {record["step"] for record in self.completed}
                await self.append("session", {"timer": self.status(), "pending": [name for name, _ in self.steps if name not in completed_names], "evidence": evidence})
        elif action == "resume" and self.started and self.since is None:
            self.since = time.monotonic()
        await self.publish()
        return self.model_status()

    @function_tool
    async def record_learning(self, kind: str, details_json: str) -> str:
        """Append evidence JSON. Kinds: correction/vocabulary/structure/retrieval/listening/assessment/feedback.
        Correction (TEXT ONLY): learner_text,corrected_text,pattern,explanation,recovery_task.
        Vocabulary keys: element,observed_need,meaning,pattern,pronunciation,restrictions,
        collocations,examples (2),transfer_task. Structure: element,meaning,pattern,examples (2),transfer_task.
        Retrieval: element,item_type (vocabulary/structure),result (unaided/helped/failed),
        attempt_type (repetition/review/transfer),context,evidence (exact learner quote).
        """
        if kind not in {"correction", "vocabulary", "structure", "retrieval", "listening", "assessment", "feedback"}:
            return "Invalid entry kind."
        try:
            data = json.loads(details_json)
        except ValueError:
            return "Provide valid JSON."
        if not isinstance(data, dict):
            return "Provide a JSON object."
        if kind == "feedback" and self.mode == "fluency" and self.index == 4:
            if not isinstance(data.get("summary"), str) or not data["summary"].strip():
                return "Feedback needs a nonempty summary. Explain the observed response; do not invent errors."
            data["summary"] = data["summary"].strip()[:2000]
        data["step_index"] = self.index
        if kind == "correction":
            required = {"learner_text", "corrected_text", "pattern", "explanation", "recovery_task"}
            if any(not isinstance(data.get(key), str) or not data[key].strip() for key in required):
                return "Text correction requires nonempty learner_text, corrected_text, pattern, explanation and recovery_task."
            from progress.learning import normalize
            self._modeled_examples.add(normalize(data["corrected_text"]))
        if kind in {"vocabulary", "structure"}:
            required = {"element", "meaning", "pattern", "examples", "transfer_task"}
            if kind == "vocabulary":
                required |= {"observed_need", "pronunciation", "restrictions", "collocations"}
            if not required.issubset(data) or not isinstance(data["examples"], list) or len(data["examples"]) < 2:
                return "Incomplete lexical card: provide all required fields and two examples."
            if any(not isinstance(data.get(key), str) or not data[key].strip()
                   for key in ("element", "meaning", "pattern", "transfer_task")):
                return "Learning card needs nonempty element, meaning, pattern and transfer_task."
            from progress.learning import normalize
            self._modeled_examples.update(normalize(example) for example in data["examples"] if isinstance(example, str))
            today = datetime.now(timezone(timedelta(hours=-5))).date()
            data["reviews"] = [(today + timedelta(days=d)).isoformat() for d in (1, 3, 7, 14)]
            data["state"] = "EN PRÁCTICA"
        if kind == "retrieval":
            if any(not isinstance(data.get(key), str) or not data[key].strip()
                   for key in ("element", "evidence", "context")) or data.get("result") not in {"unaided", "helped", "failed"}:
                return "Retrieval needs element, result and evidence."
            if data.get("item_type") not in {"vocabulary", "structure"} or data.get("attempt_type") not in {"repetition", "review", "transfer"} or not str(data.get("context", "")).strip():
                return "Retrieval requires item_type, attempt_type and a concrete context."
            from progress.learning import normalize
            data["observed"] = bool(self.latest_user_text and
                                    normalize(data["evidence"]) in normalize(self.latest_user_text))
            if normalize(data["evidence"]) in self._modeled_examples:
                data["attempt_type"] = "repetition"
        # Model-provided dates, states or verified flags are never authoritative.
        data.pop("state", None)
        data.pop("kind", None)
        data.pop("date", None)
        data.pop("event_id", None)
        data.pop("recorded_at", None)
        if kind != "retrieval":
            data.pop("observed", None)
        saved, entry = await self.append_event(kind, data)
        if kind in {"vocabulary", "structure", "correction", "retrieval"}:
            # Projection derives mastery from all attempts, not the last 80 messages.
            identity = item_identity(entry)
            candidates = build_learning_items(self.entries,
                datetime.now(timezone(timedelta(hours=-5))).date())
            if saved and identity:
                conn = None
                try:
                    conn = await connect_database(self.dsn, statement_cache_size=0, timeout=8)
                    row = await conn.fetchrow(
                        "SELECT snapshot FROM learner_learning_items WHERE learner_id=$1 AND item_type=$2 AND item_key=$3",
                        self.learner_id, identity[0], identity[1])
                    if row:
                        snapshot = json.loads(row["snapshot"]) if isinstance(row["snapshot"], str) else row["snapshot"]
                        candidates = [snapshot]
                except Exception:
                    logger.warning("Learning snapshot unavailable", exc_info=True)
                finally:
                    if conn is not None:
                        await conn.close()
            matching = next((item for item in candidates if identity and item["item_type"] == identity[0] and item["key"] == identity[1]), None)
            data["state"] = matching["state"] if matching else "EN PRÁCTICA"
        try:
            await self.room.local_participant.publish_data(
                json.dumps({"entry": entry, "saved": saved, "queued": self.local_pending}).encode(),
                reliable=True, topic="practice-journal",
            )
            if kind == "feedback" and self.mode == "fluency" and self.index == 4:
                self.feedback_summary = data["summary"]
                self.feedback_ready = True
                await self.publish()
        except Exception:
            logger.warning("Could not publish learning entry", exc_info=True)
        return json.dumps({"saved": saved, "kind": kind, "element": data.get("element"),
                           "state": data.get("state"), "reviews": data.get("reviews"),
                           "delivery": "text_only" if kind == "correction" else "journal"})
