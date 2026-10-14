import unittest
from livekit.agents import llm
from agent.text_feedback import audio_safe_chunks, correction_was_shown


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
