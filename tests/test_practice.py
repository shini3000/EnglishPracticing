import json
import unittest
from unittest.mock import AsyncMock, patch
from agent.practice import Practice, DAILY_STEPS
from prompts.tutor import tutor_prompt


class PracticeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.room = type("Room", (), {"name": "test", "local_participant": type(
            "Participant", (), {"publish_data": AsyncMock()})()})()
        self.practice = Practice(None, self.room, None, "daily", "es")

    async def test_pause_excludes_break_and_next_requires_evidence(self):
        with patch("agent.practice.time.monotonic", return_value=100):
            await self.practice.practice_control("start")
        with patch("agent.practice.time.monotonic", return_value=130):
            await self.practice.practice_control("pause")
        with patch("agent.practice.time.monotonic", return_value=999):
            self.assertEqual(self.practice.status()["elapsed_seconds"], 30)
            await self.practice.practice_control("resume")
        with patch("agent.practice.time.monotonic", return_value=1009):
            await self.practice.practice_control("next")
            self.assertEqual(self.practice.index, 0)
            await self.practice.practice_control("next", "Learner confirmed topic and oral objective")
            self.assertEqual(self.practice.completed[0]["elapsed_seconds"], 40)
            self.assertEqual(self.practice.index, 1)

    async def test_finish_keeps_unfinished_step_pending(self):
        await self.practice.practice_control("start")
        await self.practice.practice_control("finish", "Learner ended early")
        self.assertFalse(self.practice.status()["running"])
        self.assertEqual(len(self.practice.entries[-1]["pending"]), len(DAILY_STEPS))

    async def test_same_day_repetitions_do_not_activate(self):
        result = {"element": "listen to", "result": "unaided", "evidence": "I listen to music"}
        for _ in range(2):
            output = json.loads(await self.practice.record_learning("retrieval", json.dumps(result)))
            self.assertEqual(output["state"], "EN PRÁCTICA")
            self.assertFalse(output["saved"])
        self.practice.entries[0]["date"] = "2020-01-01"
        output = json.loads(await self.practice.record_learning("retrieval", json.dumps(result)))
        self.assertEqual(output["state"], "ACTIVA")
        result["result"] = "failed"
        output = json.loads(await self.practice.record_learning("retrieval", json.dumps(result)))
        self.assertEqual(output["state"], "EN PRÁCTICA")

    def test_policy_uses_selected_language_and_english_target(self):
        prompt = tutor_prompt("Sara", "fr", "diagnostic")
        self.assertIn("native language is French", prompt)
        self.assertIn("target language is ALWAYS English", prompt)
        self.assertIn("Session mode: diagnostic", prompt)
        self.assertEqual(sum(minutes for _, minutes in DAILY_STEPS), 145)
        self.assertIn("GRAMMAR FEEDBACK IS TEXT ONLY", prompt)

    async def test_written_correction_requires_full_explanation_and_publishes_card(self):
        incomplete = {"learner_text": "I did went", "corrected_text": "I went", "pattern": "past"}
        await self.practice.record_learning("correction", json.dumps(incomplete))
        self.assertEqual(self.practice.entries, [])
        card = {**incomplete, "explanation": "Después de did se usa el verbo base.",
                "recovery_task": "Tell me what you did yesterday using a different verb."}
        result = json.loads(await self.practice.record_learning("correction", json.dumps(card)))
        self.assertEqual(result["delivery"], "text_only")
        self.assertNotIn("explanation", result)
        self.assertEqual(self.practice.entries[-1]["explanation"], card["explanation"])
        published = self.room.local_participant.publish_data.call_args
        self.assertEqual(published.kwargs["topic"], "practice-journal")
        self.assertEqual(json.loads(published.args[0])["entry"]["recovery_task"], card["recovery_task"])

    def test_timer_identifies_step_and_block_for_display(self):
        status = self.practice.status()
        self.assertEqual(status["step_index"], 0)
        self.assertEqual(status["step_count"], 13)
        self.assertEqual(status["step_duration_seconds"], 300)
        self.assertTrue(status["block"].startswith("Bloque 1"))
        self.practice.index = 4
        self.assertTrue(self.practice.status()["block"].startswith("Bloque 2"))
        self.practice.index = 10
        self.assertTrue(self.practice.status()["block"].startswith("Bloque 3"))

    def test_policy_does_not_embed_full_documents_and_keeps_recent_history(self):
        prompt = tutor_prompt("Ahmad", history="old evidence " * 2000 + "RECENT EVIDENCE")
        self.assertLess(len(prompt), 15000)
        self.assertTrue(prompt.endswith("RECENT EVIDENCE"))


if __name__ == "__main__":
    unittest.main()
