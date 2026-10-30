"""Evidence-based vocabulary/structure consolidation; no model-assigned mastery."""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone

POLICY = {"version": 1, "min_days": 3, "min_span_days": 7, "min_contexts": 2, "maintenance_days": 14,
          "review_offsets": [1, 3, 7, 14]}
LEARNING_KINDS = {"vocabulary", "structure", "correction", "retrieval"}


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip().casefold())


def vocabulary_block_progress(attempts: list[dict], today: date | None = None) -> dict:
    """Count distinct successful days in this block; a failed day resets the streak.

    Several attempts on one date count once. If any assessed attempt on that date
    fails, the day resets the streak and cannot also add a success. Three full
    consecutive days without using the word reset an unfinished streak.
    """
    days: dict[str, set[str]] = {}
    for attempt in attempts:
        if (attempt.get("practice_block") != "vocabulary" or not attempt.get("observed")
                or attempt.get("attempt_type") not in {"review", "transfer"}
                or not attempt.get("context") or not attempt.get("date")):
            continue
        days.setdefault(attempt["date"], set()).add(attempt.get("result"))
    today = today or datetime.now(timezone(timedelta(hours=-5))).date()
    streak = 0
    completed_on = None
    last_used = None
    for day, outcomes in sorted(days.items()):
        day_date = date.fromisoformat(day)
        if day_date > today:
            continue
        if completed_on:
            break  # Once completed, it is no longer mandatory in this block.
        if last_used and (day_date - last_used).days >= 4:
            streak = 0
        if "failed" in outcomes:
            streak = 0
        elif "unaided" in outcomes:
            streak += 1
            if streak >= 10:
                completed_on = day
        if "unaided" in outcomes or "helped" in outcomes:
            last_used = day_date
    if not completed_on and last_used and (today - last_used).days >= 4:
        streak = 0
    return {"streak": streak, "target": 10, "completed": completed_on is not None,
            "completed_on": completed_on}


def vocabulary_words_to_practice(items: list[dict], today: date) -> list[dict]:
    """Recompute pending words at read time so inactivity resets stale snapshots."""
    pending = []
    for item in items:
        if item.get("item_type") != "vocabulary":
            continue
        progress = vocabulary_block_progress(item.get("attempts", []), today)
        if not progress["completed"]:
            pending.append({"key": item["key"], "label": item["label"], **progress})
    return sorted(pending, key=lambda item: (item["streak"], item["label"].casefold()))


def item_identity(entry: dict) -> tuple[str, str, str] | None:
    kind = entry.get("kind")
    if kind not in LEARNING_KINDS:
        return None
    item_type = "structure" if kind in {"structure", "correction"} else entry.get("item_type", "vocabulary")
    label = entry.get("pattern") if kind == "correction" else entry.get("element")
    if item_type not in {"vocabulary", "structure"} or not isinstance(label, str) or not label.strip():
        return None
    return item_type, normalize(label), label.strip()


def build_learning_items(entries: list[dict], today: date | None = None) -> list[dict]:
    today = today or datetime.now(timezone(timedelta(hours=-5))).date()
    items: dict[tuple[str, str], dict] = {}
    seen = set()
    for index, entry in enumerate(entries):
        event_id = entry.get("event_id")
        if event_id and event_id in seen:
            continue
        if event_id:
            seen.add(event_id)
        identity = item_identity(entry)
        if not identity:
            continue
        item_type, key, label = identity
        try:
            if entry.get("recorded_at"):
                timestamp = datetime.fromisoformat(str(entry["recorded_at"]).replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    continue  # No guessing timezone for malformed new evidence.
                day = timestamp.astimezone(timezone(timedelta(hours=-5))).date()
            else:
                day = date.fromisoformat(str(entry.get("date", "")))
        except ValueError:
            continue
        if day > today:
            continue
        item = items.setdefault((item_type, key), {
            "item_type": item_type, "key": key, "label": label,
            "introduced_on": day.isoformat(), "attempts": [], "card": {},
        })
        if entry["kind"] != "retrieval":
            # A correction or new card is exposure, never proof of mastery.
            item["card"] = {k: entry[k] for k in (
                "meaning", "pattern", "examples", "corrected_text", "explanation", "reviews"
            ) if k in entry}
            continue
        item["attempts"].append({
            "date": day.isoformat(), "result": entry.get("result"),
            "recorded_at": entry.get("recorded_at"),
            "attempt_type": entry.get("attempt_type", "legacy"),
            "observed": entry.get("observed") is True,
            "context": str(entry.get("context", "")).strip(),
            "practice_block": entry.get("practice_block"),
            "evidence": str(entry.get("evidence", "")),
            "event_id": event_id or f"legacy-{index}",
        })

    for item in items.values():
        attempts = item["attempts"]
        successes = []
        for attempt in attempts:
            if not attempt["observed"] or attempt["attempt_type"] not in {"review", "transfer"} or not attempt["context"]:
                continue
            if attempt["result"] == "failed":
                successes = []
            elif attempt["result"] == "unaided":
                successes.append(attempt)
        days = sorted({a["date"] for a in successes})
        contexts = {normalize(a["context"]) for a in successes}
        span = (date.fromisoformat(days[-1]) - date.fromisoformat(days[0])).days if days else 0
        state = "EN PRÁCTICA"
        if len(days) >= 2:
            state = "EN CONSOLIDACIÓN"
        if len(days) >= POLICY["min_days"] and span >= POLICY["min_span_days"] and len(contexts) >= POLICY["min_contexts"]:
            state = "CONSOLIDADA"
            if (today - date.fromisoformat(days[-1])).days > POLICY["maintenance_days"]:
                state = "REPASO PENDIENTE"
        assessed = [a for a in attempts if a["observed"] and a["attempt_type"] in {"review", "transfer"} and a["context"]]
        introduction = date.fromisoformat(item["introduced_on"])
        schedule = [introduction + timedelta(days=offset) for offset in POLICY["review_offsets"]]
        reviewed = [date.fromisoformat(a["date"]) for a in assessed]
        outstanding = [day for day in schedule if not any(attempt_day >= day for attempt_day in reviewed)]
        if assessed and assessed[-1]["result"] in {"failed", "helped"}:
            outstanding.append(date.fromisoformat(assessed[-1]["date"]) + timedelta(days=1))
        if state in {"CONSOLIDADA", "REPASO PENDIENTE"} and reviewed:
            outstanding.append(max(reviewed) + timedelta(days=7))
        next_review = min(outstanding).isoformat() if outstanding else None
        item.update({
            "state": state, "successful_days": days, "context_count": len(contexts),
            "span_days": span, "attempt_count": len(attempts),
            "assessed_attempts": len(assessed),
            "unaided_successes": sum(a["result"] == "unaided" for a in assessed),
            "helped_attempts": sum(a["result"] == "helped" for a in assessed),
            "failed_attempts": sum(a["result"] == "failed" for a in assessed),
            "last_result": attempts[-1]["result"] if attempts else None,
            "next_review": next_review, "due": next_review is not None and next_review <= today.isoformat(),
            "policy": POLICY,
        })
        if item["item_type"] == "vocabulary":
            item["vocabulary_block"] = vocabulary_block_progress(attempts, today)
    return list(items.values())


async def save_learning_projection(conn, learner_id: str, today: date) -> list[dict]:
    rows = await conn.fetch(
        """SELECT id, entry FROM practice_journal WHERE learner_id=$1
           AND entry->>'kind' IN ('vocabulary','structure','correction','retrieval')
           ORDER BY created_at, id""", learner_id,
    )
    entries = []
    for row in rows:
        entry = json.loads(row["entry"]) if isinstance(row["entry"], str) else dict(row["entry"])
        entry["event_id"] = str(row["id"])
        entries.append(entry)
    items = build_learning_items(entries, today)
    if items:
        await conn.executemany(
            """INSERT INTO learner_learning_items (learner_id,item_type,item_key,snapshot)
               VALUES ($1,$2,$3,$4::jsonb)
               ON CONFLICT (learner_id,item_type,item_key) DO UPDATE
               SET snapshot=EXCLUDED.snapshot, updated_at=now()""",
            [(learner_id, item["item_type"], item["key"], json.dumps(item)) for item in items],
        )
    return items
