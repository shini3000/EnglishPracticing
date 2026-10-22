import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

with patch.dict(os.environ, {
    "LIVEKIT_URL": "wss://test.livekit.cloud", "LIVEKIT_API_KEY": "test",
    "LIVEKIT_API_SECRET": "test", "GROQ_API_KEY": "test", "TAVILY_API_KEY": "test",
    "LLM_PROVIDER": "groq",
}):
    import main as bootstrap
from livekit import rtc
from agent.drill_call import DrillCapture, run_drill_call


class DrillCaptureTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.session = SimpleNamespace(
            input=SimpleNamespace(set_audio_enabled=Mock()),
            clear_user_turn=Mock(), commit_user_turn=AsyncMock(return_value="I work. I study."))
        self.capture = DrillCapture(self.session, "learner_test")

    async def control(self, action, capture_id="one", identity="learner_test"):
        data = SimpleNamespace(caller_identity=identity,
                               payload=json.dumps(dict(action=action, captureId=capture_id)))
        return json.loads(await self.capture.control(data))

    async def test_pause_does_not_finish_and_snapshots_do_not_duplicate(self):
        await self.control("start")
        self.capture.transcribed(SimpleNamespace(is_final=False, transcript="I"))
        self.capture.transcribed(SimpleNamespace(is_final=True, transcript="I work."))
        self.capture.transcribed(SimpleNamespace(is_final=True, transcript="I study."))
        first = await self.control("status")
        self.assertEqual(first["text"], "I work. I study.")
        self.assertFalse(first["finished"])
        self.assertEqual(first, await self.control("status"))
        self.session.commit_user_turn.assert_not_called()

    async def test_finish_waits_for_tail_and_is_idempotent(self):
        await self.control("start")
        self.capture.transcribed(SimpleNamespace(is_final=True, transcript="I work."))
        result = await self.control("finish")
        self.assertEqual(result["text"], "I work. I study.")
        self.assertTrue(result["finished"])
        self.assertEqual(result, await self.control("finish"))
        self.session.commit_user_turn.assert_awaited_once_with(
            transcript_timeout=12, stt_flush_duration=1, skip_reply=True)
        self.session.input.set_audio_enabled.assert_called_with(False)
        self.capture.transcribed(SimpleNamespace(is_final=True, transcript="background"))
        self.assertEqual(result, await self.control("status"))

    async def test_start_retry_preserves_text_and_steps_are_isolated(self):
        await self.control("start")
        self.capture.transcribed(SimpleNamespace(is_final=True, transcript="I work."))
        self.assertEqual((await self.control("start"))["text"], "I work.")
        with self.assertRaises(rtc.RpcError):
            await self.control("start", "two")
        await self.control("finish")
        self.assertEqual((await self.control("start", "two"))["text"], "")
        with self.assertRaises(rtc.RpcError):
            await self.control("finish", "one")

    async def test_rejects_other_participants_and_invalid_actions(self):
        with self.assertRaises(rtc.RpcError):
            await self.control("start", identity="intruder")
        with self.assertRaises(rtc.RpcError):
            await self.control("unknown")
        self.session.clear_user_turn.assert_not_called()

    async def test_failure_does_not_mark_capture_finished(self):
        await self.control("start")
        self.session.commit_user_turn.side_effect = RuntimeError("STT failure")
        with self.assertRaises(RuntimeError):
            await self.control("finish")
        self.assertFalse(self.capture.finished)

    async def test_utf8_response_bounded_and_overflow_exposed(self):
        await self.control("start")
        self.capture.transcribed(SimpleNamespace(is_final=True, transcript="你" * 4000))
        response = await self.control("status")
        self.assertTrue(response["overflow"])
        self.assertLess(len(json.dumps(response, ensure_ascii=False).encode()), 15_000)

    async def test_listener_has_no_llm_tts_or_second_grading(self):
        session = Mock()
        session.start = AsyncMock()
        participant = SimpleNamespace(identity="learner_test")
        local = SimpleNamespace(register_rpc_method=Mock(), set_attributes=AsyncMock())
        ctx = SimpleNamespace(room=SimpleNamespace(local_participant=local))
        settings = SimpleNamespace(STT_MODEL="whisper-test")
        with patch("agent.drill_call.AgentSession", return_value=session) as factory, \
                patch("agent.drill_call.groq.STT", return_value="stt") as stt, \
                patch("agent.drill_call.Agent"):
            await run_drill_call(ctx, participant, settings, "vad")
        self.assertEqual(set(factory.call_args.kwargs), {"stt", "vad", "turn_handling"})
        stt.assert_called_once_with(model="whisper-test", language="en", detect_language=False)
        self.assertEqual(factory.call_args.kwargs["turn_handling"]["turn_detection"], "manual")
        local.set_attributes.assert_awaited_once_with({"drill_ready": "true"})
        local.register_rpc_method.assert_called_once()

    async def test_signed_capture_bypasses_conversation_and_grading(self):
        from agent.tutor import _run_session
        participant = SimpleNamespace(
            identity="learner_00000000-0000-0000-0000-000000000001",
            attributes={"practice_mode": "fluency", "practice_capture": "time-shifting"})
        ctx = SimpleNamespace(room=SimpleNamespace(name="test"),
                              connect=AsyncMock(), wait_for_participant=AsyncMock(return_value=participant))
        with patch("agent.drill_call.run_drill_call", new_callable=AsyncMock) as run, \
                patch("agent.tutor._load_vad", return_value="vad"), \
                patch("agent.tutor.create_llm") as llm, \
                patch("agent.tutor.progress.run_analysis") as grading:
            await _run_session(ctx)
        run.assert_awaited_once()
        llm.assert_not_called()
        grading.assert_not_called()

    async def test_agility_capture_also_bypasses_conversation_and_grading(self):
        from agent.tutor import _run_session
        participant = SimpleNamespace(
            identity="learner_00000000-0000-0000-0000-000000000001",
            attributes={"practice_mode": "fluency", "practice_capture": "agility"})
        ctx = SimpleNamespace(room=SimpleNamespace(name="test"), connect=AsyncMock(),
                              wait_for_participant=AsyncMock(return_value=participant))
        with patch("agent.drill_call.run_drill_call", new_callable=AsyncMock) as capture, \
                patch("agent.tutor._load_vad", return_value="vad"), \
                patch("agent.tutor.create_llm") as llm, \
                patch("agent.tutor.progress.run_analysis") as grading:
            await _run_session(ctx)
        capture.assert_awaited_once()
        llm.assert_not_called()
        grading.assert_not_called()

