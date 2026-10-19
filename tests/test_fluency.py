import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from agent.practice import Practice, DAILY_STEPS, DIAGNOSTIC_STEPS
from prompts.fluency import FLUENCY_STAGES
from prompts.tutor import tutor_prompt


class FluencyTests(unittest.IsolatedAsyncioTestCase):
    def practice(self, mode):
        room = SimpleNamespace(name="test", local_participant=SimpleNamespace(publish_data=AsyncMock()))
        return Practice(None, room, None, mode, "es")

    def test_schedule_and_half_minute_breaks(self):
        p = self.practice("fluency")
        self.assertEqual(len(p.steps), 16)
        self.assertEqual(sum(minutes for _, minutes in p.steps), 55)
        p.index = 11
        self.assertEqual(p.status()["step_duration_seconds"], 30)
        self.assertIn("Descanso", p.status()["block"])

    def test_each_step_has_matching_teaching_policy(self):
        for index, stage in enumerate(FLUENCY_STAGES):
            prompt = tutor_prompt("Ahmad", "es", "fluency", step=index)
            self.assertIn(stage[3], prompt)
            self.assertIn("native language is Spanish", prompt)
            self.assertNotIn("Daily plan: 145", prompt)
            self.assertIn("do not establish mastery", prompt)

    def test_existing_modes_unchanged(self):
        self.assertEqual(self.practice("daily").steps, DAILY_STEPS)
        self.assertEqual(self.practice("diagnostic").steps, DIAGNOSTIC_STEPS)

    async def test_start_and_evidence_required_for_next(self):
        p = self.practice("fluency")
        await p.practice_control("start", "Chosen topic: hobbies")
        self.assertTrue(p.status()["running"])
        await p.practice_control("next")
        self.assertEqual(p.index, 0)
        await p.practice_control("next", "Learner described three actions in present")
        self.assertEqual(p.index, 1)
