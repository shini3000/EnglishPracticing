import os
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, PropertyMock, patch, AsyncMock

with patch.dict(os.environ, {
    "LIVEKIT_URL": "wss://test.livekit.cloud", "LIVEKIT_API_KEY": "test",
    "LIVEKIT_API_SECRET": "test", "GROQ_API_KEY": "test", "TAVILY_API_KEY": "test",
    "LLM_PROVIDER": "groq",
}):
    import main as bootstrap
from agent.tutor import EnglishTutor, _turn_handling_options, _load_vad
from agent.practice import Practice
from agent.personas import Persona
from livekit.agents import llm, APIStatusError
from livekit.agents.types import NOT_GIVEN


class Stream:
    def __init__(self, chunks):
        self.chunks = chunks

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    def __aiter__(self):
        return self.run()

    async def run(self):
        for chunk in self.chunks:
            if isinstance(chunk, Exception):
                raise chunk
            yield chunk


class TutorQuotaTests(unittest.IsolatedAsyncioTestCase):
    async def test_agent_tools_flatten_without_duplicate_record_learning(self):
        from livekit.agents.llm.tool_context import ToolContext
        tools = ToolContext(self.tutor.tools).flatten()
        names = [tool.info.name for tool in tools]
        self.assertEqual(names.count("record_learning"), 1)
        self.assertIn("practice_control", names)

    async def test_independent_live_corrector_reviews_once_and_publishes_written_cards(self):
        self.practice.mode = 'fluency'
        self.practice.index = 4  # Practice B block 2: publish feedback before continuing.
        self.practice.latest_user_text = 'I did went to work.'
        self.tutor._independent_corrections = True
        result = {'corrections': [{'learner_text': 'I did went', 'corrected_text': 'I went',
                  'pattern': 'Past simple', 'explanation': 'Usa pasado.', 'recovery_task': 'Describe yesterday.'}],
                  'feedback': 'Practice the past.'}
        with patch('agent.tutor.correction_config', return_value=('groq', 'GROQ', 'test', 'chosen')), \
             patch('agent.tutor.review_response', new=AsyncMock(return_value=result)) as review:
            first = await self.tutor.record_learning('correction', '{"learner_text":"i DID went"}')
            second = await self.tutor.record_learning('correction', '{"learner_text":"to work"}')
        self.assertEqual(first, second)
        review.assert_awaited_once()
        self.assertEqual(json.loads(first)['delivery'], 'text_only')
        self.assertEqual(len([e for e in self.practice.entries if e['kind'] == 'correction']), 1)
        self.assertTrue(self.practice.feedback_ready)
        published = [json.loads(call.args[0]) for call in self.practice.room.local_participant.publish_data.await_args_list
                     if call.kwargs.get('topic') == 'practice-journal']
        self.assertEqual([packet['entry']['kind'] for packet in published], ['correction', 'feedback'])
        self.assertEqual(published[0]['entry']['learner_text'], 'I did went')

    async def test_failed_live_correction_does_not_save_fake_feedback(self):
        self.practice.latest_user_text = 'I did went to work.'
        self.tutor._independent_corrections = True
        with patch('agent.tutor.correction_config', return_value=('groq', 'GROQ', 'test', 'chosen')), \
             patch('agent.tutor.review_response', new=AsyncMock(side_effect=TimeoutError())):
            result = await self.tutor.record_learning('correction', '{"learner_text":"I did went"}')
        self.assertIn('pending', result)
        self.assertFalse(self.practice.entries)

    def setUp(self):
        room = SimpleNamespace(name="test", local_participant=SimpleNamespace(publish_data=AsyncMock()))
        self.practice = Practice(None, room, None, "daily", "es")
        self.tutor = EnglishTutor(Persona("Ahmad", "test"), self.practice, "")
        self.tutor.quota = Mock()
        self.tutor.quota.reserve.return_value = ("reservation", 0, "ready")
        self.context = llm.ChatContext.empty()
        self.context.add_message(role="user", content="I did went to work.")
        self.settings = SimpleNamespace(tool_choice=NOT_GIVEN)
        self.answer = llm.ChatChunk(
            id="answer", delta=llm.ChoiceDelta(role="assistant", content="Use did plus base verb."),
            usage=llm.CompletionUsage(prompt_tokens=400, completion_tokens=60, total_tokens=460),
        )

    async def generate(self, provider):
        with patch.object(EnglishTutor, "session", new_callable=PropertyMock,
                          return_value=SimpleNamespace(llm=provider)):
            return [chunk async for chunk in self.tutor.llm_node(self.context, [], self.settings)]

    async def test_success_settles_actual_usage(self):
        provider = Mock()
        provider.chat.return_value = Stream([self.answer])
        output = await self.generate(provider)
        self.assertEqual(output, [self.answer])
        self.tutor.quota.settle.assert_called_with("reservation", 460)
        self.assertEqual(provider.chat.call_args.kwargs["conn_options"].max_retry, 0)

    async def test_standalone_input_block_never_requests_a_model(self):
        self.practice.mode = "fluency"
        self.practice.index = 5
        provider = Mock()
        output = await self.generate(provider)
        self.assertIn("sin llamada", output[0])
        provider.chat.assert_not_called()
        self.tutor.quota.reserve.assert_not_called()

    async def test_written_correction_followup_does_not_call_groq(self):
        self.context.items.append(llm.FunctionCallOutput(
            name="record_learning", call_id="card", output='{"delivery":"text_only"}', is_error=False))
        provider = Mock()
        output = await self.generate(provider)
        provider.chat.assert_not_called()
        self.assertIn("pantalla", output[0])
        self.tutor.quota.reserve.assert_not_called()

    async def test_waiting_quota_pauses_and_resumes_clock(self):
        await self.practice.practice_control("start")
        self.tutor.quota.reserve.side_effect = [(None, 2, "minute"), ("reservation", 0, "ready")]
        provider = Mock()
        provider.chat.return_value = Stream([self.answer])
        with patch("agent.tutor.asyncio.sleep", new_callable=AsyncMock) as sleep:
            await self.generate(provider)
        sleep.assert_awaited_once_with(2)
        self.assertTrue(self.practice.status()["running"])
        self.assertFalse(self.tutor._quota_paused)

    async def test_monologue_correction_completes_feedback_without_another_model_request(self):
        self.practice.mode = "fluency"
        self.practice.index = 4
        self.context.items.append(llm.FunctionCallOutput(
            name="record_learning", call_id="card", output='{"delivery":"text_only"}', is_error=False))
        provider = Mock()
        output = await self.generate(provider)
        provider.chat.assert_not_called()
        self.assertTrue(self.practice.feedback_ready)
        self.assertEqual(self.practice.index, 4)
        self.assertIn("pantalla", output[0])

    async def test_daily_limit_does_not_request_model_or_run_clock(self):
        await self.practice.practice_control("start")
        self.tutor.quota.reserve.return_value = (None, 80000, "daily")
        provider = Mock()
        output = await self.generate(provider)
        provider.chat.assert_not_called()
        self.assertTrue(isinstance(output[0], str))
        self.assertFalse(self.practice.status()["running"])
        self.assertEqual(self.practice.quota_status["state"], "daily_limit")

    async def test_rate_limit_retries_once_without_duplicate_content(self):
        provider = Mock()
        provider.chat.side_effect = [
            Stream([APIStatusError("rate limited", status_code=429)]),
            Stream([self.answer]),
        ]
        output = await self.generate(provider)
        self.assertEqual(output, [self.answer])
        self.assertEqual(provider.chat.call_count, 2)
        self.tutor.quota.cooldown.assert_called_once()

    async def test_partial_response_is_never_retried(self):
        provider = Mock()
        provider.chat.return_value = Stream([self.answer, APIStatusError("limited", status_code=429)])
        output = await self.generate(provider)
        self.assertEqual(output, [self.answer])
        self.assertEqual(provider.chat.call_count, 1)

    async def test_tool_free_turn_is_forwarded_before_provider_finishes(self):
        advanced = []

        class IncrementalStream(Stream):
            async def run(inner):
                yield self.answer
                advanced.append(True)

        provider = Mock()
        provider.chat.return_value = IncrementalStream([])
        with patch.object(EnglishTutor, "session", new_callable=PropertyMock,
                          return_value=SimpleNamespace(llm=provider)):
            response = self.tutor.llm_node(self.context, [], self.settings)
            try:
                self.assertEqual(await anext(response), self.answer)
                self.assertEqual(advanced, [])
                self.assertEqual([c async for c in response], [])
                self.assertEqual(advanced, [True])
            finally:
                await response.aclose()

    async def test_late_written_card_reaches_tools_without_spoken_correction(self):
        advanced = []
        tool = llm.ChatChunk(id="card", delta=llm.ChoiceDelta(role="assistant", tool_calls=[
            llm.FunctionToolCall(name="record_learning", call_id="card", arguments='{"kind":"correction"}')]))

        class IncrementalStream(Stream):
            async def run(inner):
                yield self.answer
                yield tool
                advanced.append(True)

        provider = Mock()
        provider.chat.return_value = IncrementalStream([])
        with patch.object(EnglishTutor, "session", new_callable=PropertyMock,
                          return_value=SimpleNamespace(llm=provider)):
            response = self.tutor.llm_node(self.context, [self.practice.record_learning], self.settings)
            try:
                result = await anext(response)
                # Usage on the suppressed narration is retained, never spoken.
                self.assertIsNone(result.delta.content)
                result = await anext(response)
                self.assertEqual(result.delta.tool_calls[0].call_id, "card")
                self.assertEqual(advanced, [])
                self.assertEqual([c async for c in response], [])
                self.assertEqual(advanced, [True])
            finally:
                await response.aclose()

    async def test_broken_guarded_turn_does_not_release_unverified_narration(self):
        provider = Mock()
        provider.chat.return_value = Stream([self.answer, APIStatusError("broken", status_code=500)])
        with patch.object(EnglishTutor, "session", new_callable=PropertyMock,
                          return_value=SimpleNamespace(llm=provider)):
            result = [chunk async for chunk in self.tutor.llm_node(
                self.context, [self.practice.record_learning], self.settings)]
        self.assertTrue(all(not c.delta.content for c in result if not isinstance(c, str) and c.delta))
        self.assertEqual(len([c for c in result if isinstance(c, str)]), 1)
        self.assertEqual(provider.chat.call_count, 1)

    def test_older_due_vocabulary_survives_many_new_entries(self):
        self.tutor._history = '{"kind":"vocabulary","element":"listen to","pattern":"listen to + noun","reviews":["2020-01-02"],"date":"2020-01-01"}'
        self.practice.entries = [{"kind": "step", "evidence": "new work", "date": "2026-01-01"}] * 100
        self.assertIn("listen to", self.tutor._learning_memory())
        self.assertLess(len(self.tutor._learning_memory()), 1600)

    def test_short_pauses_are_not_final_stt_turns(self):
        with patch("agent.tutor.settings.TURN_END_SILENCE_SECONDS", 3.0):
            options = _turn_handling_options()
        self.assertEqual(options["turn_detection"], "vad")
        self.assertEqual(options["endpointing"]["mode"], "fixed")
        self.assertEqual(options["endpointing"]["min_delay"], 3.0)
        self.assertFalse(options["preemptive_generation"]["enabled"])

    def test_vad_silence_is_configured_and_max_delay_is_consistent(self):
        with patch("agent.tutor.silero.VAD.load") as load:
            _load_vad()
        self.assertEqual(load.call_args.kwargs["min_silence_duration"], 1.0)
        with patch("agent.tutor.settings.TURN_END_SILENCE_SECONDS", 8.0):
            options = _turn_handling_options()
        self.assertGreaterEqual(options["endpointing"]["max_delay"], options["endpointing"]["min_delay"])


if __name__ == "__main__":
    unittest.main()
