import unittest
from datetime import date
from progress.learning import build_learning_items


def intro(kind="vocabulary"):
    return {"kind": kind, "element": "listen to" if kind == "vocabulary" else "did + base verb",
            "pattern": "listen to + noun", "date": "2026-01-01", "state": "ACTIVA"}


def attempt(day, *, item_type="vocabulary", context="music", result="unaided", observed=True,
            attempt_type="review", event_id=None):
    return {"kind": "retrieval", "element": "listen to" if item_type == "vocabulary" else "did + base verb",
            "item_type": item_type, "date": day, "context": context, "result": result,
            "observed": observed, "attempt_type": attempt_type, "evidence": "I listen to music",
            "event_id": event_id}


class LearningTests(unittest.TestCase):
    today = date(2026, 1, 10)

    def state(self, entries):
        return build_learning_items(entries, self.today)[0]

    def test_introduction_or_one_day_never_proves_mastery(self):
        self.assertEqual(self.state([intro()])["state"], "EN PRÁCTICA")
        entries = [intro()] + [attempt("2026-01-01", context=str(i)) for i in range(10)]
        self.assertEqual(self.state(entries)["state"], "EN PRÁCTICA")
        self.assertEqual(len(self.state(entries)["successful_days"]), 1)

    def test_three_days_need_week_and_varied_contexts(self):
        entries = [intro(), attempt("2026-01-01"), attempt("2026-01-02"), attempt("2026-01-03", context="travel")]
        self.assertEqual(self.state(entries)["state"], "EN CONSOLIDACIÓN")
        entries[-1]["date"] = "2026-01-08"
        self.assertEqual(self.state(entries)["state"], "CONSOLIDADA")
        entries[-1]["context"] = "music"
        self.assertNotEqual(self.state(entries)["state"], "CONSOLIDADA")

    def test_failure_restarts_progress_without_erasing_old_attempts(self):
        entries = [intro(), attempt("2026-01-01"), attempt("2026-01-03"),
                   attempt("2026-01-08", context="travel"), attempt("2026-01-09", result="failed")]
        item = self.state(entries)
        self.assertEqual(item["state"], "EN PRÁCTICA")
        self.assertEqual(len(item["attempts"]), 4)
        self.assertEqual(item["failed_attempts"], 1)

    def test_reading_repetition_assistance_and_legacy_do_not_consolidate(self):
        entries = [intro(), attempt("2026-01-01", observed=False),
                   attempt("2026-01-03", attempt_type="repetition"),
                   attempt("2026-01-08", result="helped"),
                   attempt("2026-01-10", attempt_type="legacy")]
        self.assertEqual(self.state(entries)["successful_days"], [])
        self.assertEqual(self.state(entries)["state"], "EN PRÁCTICA")

    def test_structures_use_same_policy_and_are_separate_from_vocabulary(self):
        entries = [intro("structure"), attempt("2026-01-01", item_type="structure"),
                   attempt("2026-01-03", item_type="structure"),
                   attempt("2026-01-08", item_type="structure", context="work")]
        self.assertEqual(self.state(entries)["state"], "CONSOLIDADA")
        self.assertEqual(self.state(entries)["item_type"], "structure")

    def test_duplicate_event_and_future_evidence_do_not_inflate_days(self):
        entries = [intro(), attempt("2026-01-01", event_id="same"),
                   attempt("2026-01-08", event_id="same"), attempt("2099-01-01")]
        self.assertEqual(self.state(entries)["attempt_count"], 1)

    def test_full_history_survives_more_than_80_recent_events(self):
        entries = [intro(), attempt("2026-01-01"), attempt("2026-01-03"),
                   attempt("2026-01-08", context="travel")]
        entries += [{"kind": "feedback", "date": "2026-01-10"}] * 200
        self.assertEqual(self.state(entries)["state"], "CONSOLIDADA")

    def test_old_consolidation_requires_continuing_review(self):
        entries = [intro(), attempt("2026-01-01"), attempt("2026-01-03"),
                   attempt("2026-01-08", context="travel")]
        item = build_learning_items(entries, date(2026, 2, 1))[0]
        self.assertEqual(item["state"], "REPASO PENDIENTE")
        self.assertTrue(item["due"])
