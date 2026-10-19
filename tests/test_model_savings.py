import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from agent.practice import Practice
from agent.tutor import _resolve_photo_session
from progress.grading import prior_corrections
from tools.search import search_web


class SavingsTests(unittest.IsolatedAsyncioTestCase):
    async def test_web_search_does_not_request_generated_summary(self):
        with patch('tools.search._client.search', new_callable=AsyncMock, return_value={'results': []}) as search:
            await search_web(MagicMock(), 'current facts')
        self.assertFalse(search.call_args.kwargs['include_answer'])

    async def test_manual_controls_do_not_require_model_and_reject_stale_next(self):
        room = SimpleNamespace(name='test', local_participant=SimpleNamespace(publish_data=AsyncMock()))
        practice = Practice(None, room, None, 'daily', 'es')
        async def send(action, identifier, step=0, evidence='Learner confirmed topic and completed task'):
            await practice.manual_control(json.dumps(dict(action=action, request_id=identifier,
                step_index=step, evidence=evidence)).encode())
        await send('start', 'one')
        self.assertTrue(practice.started)
        await send('pause', 'two')
        self.assertIsNone(practice.since)
        await send('resume', 'three')
        self.assertIsNotNone(practice.since)
        await send('next', 'four')
        self.assertEqual(practice.index, 1)
        await send('next', 'five')
        self.assertEqual(practice.index, 1)
        await send('next', 'six', step=1, evidence='')
        self.assertEqual(practice.index, 1)

    async def test_photo_voice_is_explicit_not_inferred(self):
        with patch('agent.tutor.settings.BITHUMAN_API_SECRET', 'test'), \
             patch('agent.tutor.avatars.load_avatar_photo', new_callable=AsyncMock, return_value=b'photo'):
            persona, photo = await _resolve_photo_session('learner', 'girl')
        self.assertEqual(persona.name, 'Sara')
        self.assertEqual(photo, b'photo')

    def test_existing_corrections_are_grounded_and_deduplicated(self):
        entry = dict(learner_text='I go yesterday', corrected_text='I went yesterday', explanation='Pasado')
        known = prior_corrections([entry, entry, {**entry, 'learner_text': 'invented quote'}], 'I go yesterday')
        self.assertEqual(known, [entry])
