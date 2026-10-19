"""
The personalized photo avatar: loading and encoding the learner's picture.

The photo arrives here through the database, not through LiveKit. The web half stores it in
`learner_avatars` when the learner unlocks the feature with the avatar passcode
(web/app/api/avatar/route.ts), and the agent reads it back by learner id. The row's existence
IS the entitlement check: there is no way to get a photo into that table without having typed
the passcode, so the agent never needs to see the passcode at all.

Everything here returns None on failure rather than raising — an avatar problem must degrade
to a voice-only call, never to a dead room. Same philosophy as progress tracking.
"""

from __future__ import annotations

import base64
import logging

import asyncpg
from progress.connection import connect as connect_database

logger = logging.getLogger(__name__)

# Guardrail against a hand-inserted database row, not a real limit: the web upload route
# rejects anything over 2 MB long before it reaches Postgres.
_MAX_PHOTO_BYTES = 6 * 1024 * 1024


async def load_avatar_photo(learner_id: str, *, dsn: str | None) -> bytes | None:
    """The learner's uploaded avatar photo (JPEG bytes), or None if there isn't one."""
    if dsn is None:
        return None

    conn: asyncpg.Connection | None = None
    try:
        # statement_cache_size=0 for the same reason as progress/repository.py: Neon's pooled
        # URL goes through PgBouncer, which breaks asyncpg's prepared-statement cache.
        conn = await connect_database(dsn, statement_cache_size=0)
        row = await conn.fetchrow(
            "SELECT image FROM learner_avatars WHERE learner_id = $1",
            learner_id,
        )
        if row is None:
            return None

        image: bytes = row["image"]
        if not image or len(image) > _MAX_PHOTO_BYTES:
            logger.warning(
                "avatar photo for learner %s is empty or oversized (%d bytes); ignoring",
                learner_id,
                len(image) if image else 0,
            )
            return None
        return image

    except Exception:  # noqa: BLE001 — a broken avatar lookup must not kill the call
        logger.exception("failed to load avatar photo for learner %s", learner_id)
        return None

    finally:
        if conn is not None:
            await conn.close()


def photo_as_base64(image: bytes) -> str:
    """The photo in the form bitHuman's cloud API accepts inside its JSON payload."""
    return base64.b64encode(image).decode("ascii")
