import json
import asyncio
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
        result = {"element": "listen to", "result": "unaided", "evidence": "I listen to music",
                  "context": "hobbies", "item_type": "vocabulary", "attempt_type": "transfer"}
        self.practice.latest_user_text = result["evidence"]
        for _ in range(2):
            output = json.loads(await self.practice.record_learning("retrieval", json.dumps(result)))
            self.assertEqual(output["state"], "EN PRÁCTICA")
            self.assertFalse(output["saved"])
        self.practice.entries[0]["date"] = "2020-01-01"
        output = json.loads(await self.practice.record_learning("retrieval", json.dumps(result)))
        self.assertEqual(output["state"], "EN CONSOLIDACIÓN")
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

    async def test_modeled_sentence_cannot_count_as_independent_transfer(self):
        card = {"learner_text": "I did went", "corrected_text": "I went to work.",
                "pattern": "past simple", "explanation": "Usa el pasado.",
                "recovery_task": "Talk about yesterday."}
        await self.practice.record_learning("correction", json.dumps(card))
        self.practice.latest_user_text = "I went to work."
        await self.practice.record_learning("retrieval", json.dumps({
            "element": "past simple", "item_type": "structure", "attempt_type": "transfer",
            "result": "unaided", "context": "work", "evidence": "I went to work."
        }))
        self.assertEqual(self.practice.entries[-1]["attempt_type"], "repetition")

    async def test_invented_learner_quote_does_not_credit_progress(self):
        self.practice.latest_user_text = "I don't know."
        result = json.loads(await self.practice.record_learning("retrieval", json.dumps({
            "element": "listen to", "item_type": "vocabulary", "attempt_type": "transfer",
            "result": "unaided", "context": "music", "evidence": "I listen to music.",
            "observed": True, "state": "CONSOLIDADA"
        })))
        self.assertFalse(self.practice.entries[-1]["observed"])
        self.assertEqual(result["state"], "EN PRÁCTICA")

    async def test_concurrent_cards_publish_their_own_evidence(self):
        async def slow_flush():
            await asyncio.sleep(0)
            return False
        cards = [{"learner_text": original, "corrected_text": corrected, "pattern": pattern,
                  "explanation": "Revisa la estructura.", "recovery_task": "Try another example."}
                 for original, corrected, pattern in [
                     ("I did went", "I went", "past simple"),
                     ("She go", "She goes", "third person"),
                 ]]
        with patch.object(self.practice, "flush", side_effect=slow_flush):
            await asyncio.gather(*(self.practice.record_learning("correction", json.dumps(card)) for card in cards))
        events = [json.loads(call.args[0])["entry"] for call in
                  self.room.local_participant.publish_data.call_args_list
                  if call.kwargs.get("topic") == "practice-journal"]
        self.assertEqual({event["learner_text"] for event in events}, {"I did went", "She go"})
        self.assertEqual(len({event["event_id"] for event in events}), 2)

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
