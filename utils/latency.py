"""Allowlisted per-turn latency from LiveKit; never log message content."""
import logging
import math

logger = logging.getLogger(__name__)

_DURATIONS = (
    "transcription_delay", "end_of_turn_delay", "on_user_turn_completed_delay",
    "llm_node_ttft", "llm_node_ttfs", "tts_node_ttfb", "playback_latency", "e2e_latency",
)


def attach_latency_logging(session):
    # ChatMessage.metrics is the SDK's per-turn interface; no polling, database
    # queries or extra provider requests. The queued logger writes off-loop.
    @session.on("conversation_item_added")
    def on_item(event):
        item = event.item
        fields = {"message_id": item.id, "role": item.role}
        for name in _DURATIONS:
            value = item.metrics.get(name)
            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0:
                fields[name + "_ms"] = round(value * 1000)
        if len(fields) > 2:
            logger.info("voice.turn.metrics", extra=fields)
