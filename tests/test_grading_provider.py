import unittest
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from progress.grading import grade


class GradingProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_final_grade_reuses_original_correction_without_regenerating_it(self):
        known = dict(learner_text='I go yesterday', corrected_text='I went yesterday', explanation='Usa pasado.')
        payload = {'existing_errors': [{'index': 0, 'category': 'verb_tense'}], 'errors': [],
                   'cefr_estimate': 'A2', 'cefr_confidence': 0.4, 'summary': 'Keep practicing.'}
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(
            return_value=SimpleNamespace(usage=None, choices=[SimpleNamespace(
                message=SimpleNamespace(content=json.dumps(payload)))])))), close=AsyncMock())
        ledger = Mock()
        ledger.reserve.return_value = ('reservation', 0, 'ready')
        with patch('progress.grading.AsyncOpenAI', return_value=client), \
             patch('progress.grading.QuotaLedger', return_value=ledger):
            result = await grade('I go yesterday', api_key='test', model='deepseek-flash',
                                 provider='deepseek', known_corrections=[known])
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0].corrected_text, known['corrected_text'])
        self.assertEqual(result.errors[0].explanation, known['explanation'])
        sent = client.chat.completions.create.call_args.kwargs['messages'][1]['content']
        self.assertEqual(json.loads(sent)['prior_corrections'], [known])

    async def test_deepseek_grading_uses_direct_api_and_shared_namespace(self):
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(
            return_value=SimpleNamespace(usage=SimpleNamespace(total_tokens=100),
                choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))])))), close=AsyncMock())
        ledger = Mock()
        ledger.reserve.return_value = ("reservation", 0, "ready")
        with patch("progress.grading.AsyncOpenAI", return_value=client) as factory, \
             patch("progress.grading.AsyncGroq") as groq, \
             patch("progress.grading.QuotaLedger", return_value=ledger) as quota, \
             patch("progress.grading._parse", return_value="graded"):
            result = await grade("A short practice answer.", api_key="test", model="deepseek-flash", provider="deepseek")
        self.assertEqual(result, "graded")
        groq.assert_not_called()
        self.assertEqual(factory.call_args.kwargs["base_url"], "https://api.deepseek.com/v1")
        self.assertEqual(quota.call_args.args[0], "deepseek:test")
        self.assertEqual(client.chat.completions.create.call_args.kwargs["extra_body"], {"thinking": {"type": "disabled"}})
        client.close.assert_awaited_once()

    async def test_missing_key_leaves_grade_unknown(self):
        self.assertIsNone(await grade("Answer", api_key="", model="deepseek-flash", provider="deepseek"))
