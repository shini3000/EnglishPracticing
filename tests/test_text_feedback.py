import unittest
from livekit.agents import llm
from agent.text_feedback import AudioDeliveryGate, audio_safe_chunks, correction_was_shown


class TextFeedbackTests(unittest.TestCase):
    def test_correction_narration_is_removed_but_tool_call_survives(self):
        narration = llm.ChatChunk(id="text", delta=llm.ChoiceDelta(
            role="assistant", content="The correct structure is subject plus did plus base verb."))
        tool = llm.ChatChunk(id="tool", delta=llm.ChoiceDelta(role="assistant", tool_calls=[
            llm.FunctionToolCall(name="record_learning", call_id="card", arguments='{"kind":"correction"}')
        ]))
        safe = audio_safe_chunks([narration, tool])
        self.assertEqual(len(safe), 1)
        self.assertEqual(safe[0].delta.tool_calls[0].call_id, "card")
        self.assertIsNone(safe[0].delta.content)
        self.assertIsNotNone(narration.delta.content)

    def test_normal_conversation_still_has_audio(self):
        chunk = llm.ChatChunk(id="text", delta=llm.ChoiceDelta(role="assistant", content="What happened next?"))
        self.assertEqual(audio_safe_chunks([chunk]), [chunk])

    def test_written_card_only_applies_until_next_learner_turn(self):
        context = llm.ChatContext.empty()
        context.add_message(role="user", content="I did went.")
        context.items.append(llm.FunctionCallOutput(
            name="record_learning", call_id="card", output='{"delivery":"text_only"}', is_error=False))
        self.assertTrue(correction_was_shown(context))
        context.add_message(role="user", content="I went to work.")
        self.assertFalse(correction_was_shown(context))

    def test_safe_turn_is_delivered_without_waiting_for_completion(self):
        gate = AudioDeliveryGate(guarded=False)
        text = llm.ChatChunk(id="text", delta=llm.ChoiceDelta(role="assistant", content="What happened next?"))
        self.assertEqual(gate.push(text), [text])
        self.assertEqual(gate.finish(), [])

    def test_late_correction_suppresses_all_narration_and_is_delivered_early(self):
        gate = AudioDeliveryGate(guarded=True)
        text = llm.ChatChunk(id="text", delta=llm.ChoiceDelta(role="assistant", content="Use the past participle."))
        tool = llm.ChatChunk(id="tool", delta=llm.ChoiceDelta(role="assistant", tool_calls=[
            llm.FunctionToolCall(name="record_learning", call_id="card", arguments='{"kind":"correction"}')]))
        self.assertEqual(gate.push(text), [])
        # The card is released before the provider finishes sending usage.
        result = gate.push(tool)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].delta.tool_calls[0].call_id, "card")
        self.assertIsNone(result[0].delta.content)
        self.assertEqual(gate.push(text), [])
        self.assertEqual(gate.finish(), [])
        self.assertIsNotNone(text.delta.content)

    def test_guarded_normal_reply_is_released_only_on_success(self):
        text = llm.ChatChunk(id="text", delta=llm.ChoiceDelta(role="assistant", content="Tell me more."))
        gate = AudioDeliveryGate(guarded=True)
        self.assertEqual(gate.push(text), [])
        self.assertEqual(gate.finish(), [text])
        self.assertEqual(gate.finish(), [])
        gate.push(text)
        self.assertEqual(gate.finish(complete=False), [])

    def test_malformed_learning_call_fails_closed_but_preserves_usage(self):
        gate = AudioDeliveryGate(guarded=True)
        tool = llm.ChatChunk(id="tool", delta=llm.ChoiceDelta(role="assistant", content="Correction",
            tool_calls=[llm.FunctionToolCall(name="record_learning", call_id="card", arguments='{"kind":')]))
        result = gate.push(tool)
        self.assertIsNone(result[0].delta.content)
        usage = llm.ChatChunk(id="usage", usage=llm.CompletionUsage(
            prompt_tokens=10, completion_tokens=5, total_tokens=15))
        self.assertEqual(gate.push(usage), [usage])
        self.assertEqual(gate.finish(complete=False), [])
