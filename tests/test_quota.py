import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from livekit.agents import llm
from agent.quota import QuotaLedger, compact_context, request_tokens, retry_delay


class QuotaTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = str(Path(self.folder.name) / "quota.sqlite")
        self.ledger = QuotaLedger("test-key", "model", 100, 1000, 10, 100, path=self.path)

    def tearDown(self):
        self.folder.cleanup()

    def test_shared_reservations_expire_and_actual_usage_releases_allowance(self):
        first, wait, _ = self.ledger.reserve(80, now=100)
        self.assertIsNotNone(first)
        other = QuotaLedger("test-key", "model", 100, 1000, 10, 100, path=self.path)
        blocked, wait, reason = other.reserve(30, now=110)
        self.assertIsNone(blocked)
        self.assertEqual(reason, "minute")
        self.assertEqual(wait, 50)
        self.ledger.settle(first, 20)
        self.assertIsNotNone(other.reserve(30, now=110)[0])
        self.assertIsNotNone(other.reserve(60, now=171)[0])

    def test_daily_limit_and_oversized_are_not_immediate_retry_loops(self):
        ledger = QuotaLedger("test-key", "model", 100, 100, 10, 100, path=self.path)
        self.assertIsNotNone(ledger.reserve(80, now=100)[0])
        _, wait, reason = ledger.reserve(30, now=200)
        self.assertEqual(reason, "daily")
        self.assertGreater(wait, 80000)
        self.assertEqual(ledger.reserve(101, now=200)[2], "oversized")

    def test_request_limit_is_independent_of_token_limit(self):
        ledger = QuotaLedger("key", "model", 10000, 100000, 1, 100, path=self.path)
        ledger.reserve(1, now=100)
        self.assertEqual(ledger.reserve(1, now=101)[2], "minute")

    def test_current_answer_and_tool_pair_are_kept_without_mutating_history(self):
        context = llm.ChatContext.empty()
        for index in range(30):
            context.add_message(role="user", content="old unrelated words " * 30)
            context.add_message(role="assistant", content="old answer " * 30)
            context.add_message(role="system", content="stale timer " * 100)
        context.add_message(role="user", content="I did went to work.")
        context.items.extend([
            llm.FunctionCall(call_id="call", name="record_learning", arguments='{"kind":"correction"}'),
            llm.FunctionCallOutput(call_id="call", name="record_learning", output='{"saved":true}', is_error=False),
        ])
        original = len(context.items)
        compact = compact_context(context, "Teach English", "Recovery pending: did + base", 550)
        self.assertLessEqual(request_tokens(compact, []), 550)
        self.assertEqual(len(context.items), original)
        self.assertIn("I did went", compact.items[-3].text_content)
        self.assertEqual(compact.items[-2].call_id, compact.items[-1].call_id)
        self.assertNotIn("stale timer", json.dumps(compact.to_dict()))

    def test_oversized_current_answer_is_not_silently_truncated(self):
        context = llm.ChatContext.empty()
        context.add_message(role="user", content="my long answer " * 4000)
        with self.assertRaises(ValueError):
            compact_context(context, "Teach English", "", 500)

    def test_retry_after_is_read_from_wrapped_provider_exception(self):
        root = Exception("provider")
        root.response = type("Response", (), {"headers": {"retry-after": "12"}})()
        wrapped = Exception("wrapper")
        wrapped.__cause__ = root
        self.assertEqual(retry_delay(wrapped), 12)


if __name__ == "__main__":
    unittest.main()
