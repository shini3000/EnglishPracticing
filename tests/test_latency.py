import logging
import unittest
from types import SimpleNamespace

from livekit.agents import AgentSession, llm
from utils.latency import attach_latency_logging


class LatencyTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_session_event_logs_only_known_timings(self):
        session = AgentSession()
        attach_latency_logging(session)
        item = llm.ChatMessage(role="assistant", content=["private learner phrase"], metrics={
            "llm_node_ttft": 0.8, "tts_node_ttfb": 0.25, "e2e_latency": 4.55,
            "provider_request_ids": ["not-logged"], "llm_metadata": {"model_name": "not-logged"},
            "playback_latency": float("nan"),
        })
        with self.assertLogs("utils.latency", logging.INFO) as logs:
            session.emit("conversation_item_added", SimpleNamespace(item=item))
        record = logs.records[0]
        self.assertEqual(record.message, "voice.turn.metrics")
        self.assertEqual(record.llm_node_ttft_ms, 800)
        self.assertEqual(record.tts_node_ttfb_ms, 250)
        self.assertEqual(record.e2e_latency_ms, 4550)
        self.assertFalse(hasattr(record, "playback_latency_ms"))
        self.assertNotIn("private learner phrase", str(record.__dict__))
        self.assertNotIn("not-logged", str(record.__dict__))

    async def test_user_metrics_and_empty_greeting(self):
        session = AgentSession()
        attach_latency_logging(session)
        item = llm.ChatMessage(role="user", content=["private"], metrics={
            "transcription_delay": 0.6, "end_of_turn_delay": 3.0,
        })
        with self.assertLogs("utils.latency", logging.INFO) as logs:
            session.emit("conversation_item_added", SimpleNamespace(item=item))
        self.assertEqual(logs.records[0].end_of_turn_delay_ms, 3000)
        self.assertEqual(logs.records[0].transcription_delay_ms, 600)
        item = llm.ChatMessage(role="assistant", content=["hello"])
        with self.assertNoLogs("utils.latency", logging.INFO):
            session.emit("conversation_item_added", SimpleNamespace(item=item))
