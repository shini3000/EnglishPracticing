import unittest
import json
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
        self.assertIn("Descanso", p.status()["step"])
        self.assertIn("Agilidad y síntesis", p.status()["block"])

    def test_route_tracks_real_completions_and_five_blocks(self):
        p = self.practice("fluency")
        p.index = 4
        route = p.status()["route"]
        self.assertEqual(len(route), 16)
        self.assertEqual(len({step["block"] for step in route}), 5)
        self.assertFalse(any(step["completed"] for step in route))
        p.completed.append({"step": p.steps[4][0]})
        self.assertTrue(p.status()["route"][4]["completed"])
        for mode in ("daily", "diagnostic"):
            p = self.practice(mode)
            self.assertEqual(len(p.status()["route"]), len(p.steps))

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

    async def test_select_block_without_claiming_completion(self):
        p = self.practice("fluency")
        await p.practice_control("start", "Routine")
        await p.manual_control(json.dumps({"action": "select_block", "step_index": 0,
                                          "target_step": 9, "request_id": "jump-1"}).encode())
        self.assertEqual(p.index, 9)
        self.assertFalse(p.started)
        self.assertFalse(p.status()["running"])
        self.assertEqual(p.completed, [])
        self.assertEqual(p.entries[-1]["kind"], "block_navigation")
        # Stale commands and non-block targets cannot change the selected stage.
        for origin, target in [(0, 5), (9, 10), (9, -1), (9, True)]:
            await p.manual_control(json.dumps({"action": "select_block", "step_index": origin,
                                              "target_step": target, "request_id": str((origin, target))}).encode())
            self.assertEqual(p.index, 9)

    async def test_start_and_evidence_required_for_next(self):
        p = self.practice("fluency")
        await p.practice_control("start", "Chosen topic: hobbies")
        self.assertTrue(p.status()["running"])
        await p.practice_control("next")
        self.assertEqual(p.index, 0)
        await p.practice_control("next", "Learner described three actions in present")
        self.assertEqual(p.index, 1)

    async def test_block_three_is_external_and_cannot_run_inside_call(self):
        p = self.practice("fluency")
        p.index = 4
        await p.practice_control("start", "My weekend")
        await p.practice_control("next", "Learner finished the monologue")
        self.assertEqual(p.index, 5)
        self.assertFalse(p.started)
        self.assertIsNone(p.since)
        for action in ("start", "resume", "next"):
            result = await p.practice_control(action, "Standalone activity")
            self.assertIn("/practice-b/input", result)
            self.assertEqual(p.index, 5)
            self.assertIsNone(p.since)
