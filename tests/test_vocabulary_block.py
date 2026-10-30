import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock
from progress.learning import vocabulary_block_progress, vocabulary_words_to_practice
from agent.practice import Practice


def attempt(day, result="unaided", **overrides):
    return {"date": day, "result": result, "practice_block": "vocabulary", "observed": True,
            "attempt_type": "review", "context": "A new situation", **overrides}


class VocabularyBlockProgressTests(unittest.TestCase):
    def test_ten_distinct_practice_days_complete_despite_skipped_calendar_days(self):
        attempts = [attempt(f"2026-01-{day:02d}") for day in range(1, 20, 2)]
        attempts.append(attempt("2026-01-19"))
        progress = vocabulary_block_progress(attempts, date(2026, 1, 19))
        self.assertEqual(progress, {"streak": 10, "target": 10, "completed": True, "completed_on": "2026-01-19"})

    def test_failure_resets_and_multiple_attempts_never_count_twice(self):
        attempts = [attempt("2026-01-01"), attempt("2026-01-03"), attempt("2026-01-03"),
                    attempt("2026-01-04", "failed"), attempt("2026-01-04"), attempt("2026-01-06")]
        self.assertEqual(vocabulary_block_progress(attempts, date(2026, 1, 6))["streak"], 1)

    def test_assistance_unobserved_and_other_blocks_do_not_increase_or_reset(self):
        attempts = [attempt("2026-01-01"), attempt("2026-01-02", "helped"),
                    attempt("2026-01-03", "failed", observed=False),
                    attempt("2026-01-04", "failed", practice_block="other")]
        self.assertEqual(vocabulary_block_progress(attempts, date(2026, 1, 4))["streak"], 1)

    def test_completed_word_stays_completed_after_later_practice(self):
        attempts = [attempt(f"2026-01-{day:02d}") for day in range(1, 11)]
        attempts.append(attempt("2026-01-12", "failed"))
        self.assertTrue(vocabulary_block_progress(attempts, date(2026, 1, 12))["completed"])
        self.assertEqual(vocabulary_block_progress(attempts, date(2026, 1, 12))["streak"], 10)

    def test_three_full_days_without_use_reset_and_a_new_use_starts_at_one(self):
        attempts = [attempt("2026-01-01"), attempt("2026-01-02")]
        self.assertEqual(vocabulary_block_progress(attempts, date(2026, 1, 5))["streak"], 2)
        self.assertEqual(vocabulary_block_progress(attempts, date(2026, 1, 6))["streak"], 0)
        attempts.append(attempt("2026-01-06"))
        self.assertEqual(vocabulary_block_progress(attempts, date(2026, 1, 6))["streak"], 1)

    def test_assisted_use_preserves_but_does_not_increase_streak(self):
        attempts = [attempt("2026-01-01"), attempt("2026-01-04", "helped")]
        self.assertEqual(vocabulary_block_progress(attempts, date(2026, 1, 6))["streak"], 1)
        self.assertEqual(vocabulary_block_progress(attempts, date(2026, 1, 8))["streak"], 0)

    def test_pending_list_excludes_completed_and_recomputes_expired_streaks(self):
        items = [
            {"item_type": "vocabulary", "key": "pending", "label": "Pending", "attempts": [attempt("2026-01-01")]},
            {"item_type": "vocabulary", "key": "done", "label": "Done", "attempts": [attempt(f"2026-01-{day:02d}") for day in range(1, 11)]},
            {"item_type": "structure", "key": "grammar", "label": "Grammar", "attempts": []},
        ]
        pending = vocabulary_words_to_practice(items, date(2026, 1, 15))
        self.assertEqual([item["key"] for item in pending], ["pending"])
        self.assertEqual(pending[0]["streak"], 0)


class VocabularySessionTests(unittest.IsolatedAsyncioTestCase):
    async def test_cannot_claim_pending_words_reviewed_without_saved_observed_evidence(self):
        room = SimpleNamespace(name="test", local_participant=SimpleNamespace(publish_data=AsyncMock()))
        practice = Practice(None, room, None, "vocabulary", "es")
        practice.vocabulary_pending = [{"key": "run into", "label": "run into"}]
        practice.latest_user_text = "I ran into a friend."
        data = '{"element":"run into","item_type":"vocabulary","attempt_type":"review","context":"friends","result":"unaided","evidence":"I ran into a friend."}'
        practice.append_event = AsyncMock(return_value=(False, {"kind": "retrieval"}))
        await practice.record_learning("retrieval", data)
        self.assertFalse(practice.vocabulary_seen)
        self.assertIn("1 pending", await practice.practice_control("finish"))
        self.assertIn("1 pending", await practice.practice_control("next", "test"))
        practice.append_event = AsyncMock(return_value=(True, {"kind": "retrieval"}))
        await practice.record_learning("retrieval", data)
        self.assertIn("run into", practice.vocabulary_seen)
