import unittest
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from progress.grading import grade


class GradingProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_google_uses_native_json_api_and_independent_quota(self):
        payload = {'errors': [], 'cefr_estimate': 'B1', 'cefr_confidence': 0.4, 'summary': 'Keep practicing.'}
        response = SimpleNamespace(text=json.dumps(payload),
            candidates=[SimpleNamespace(finish_reason='STOP')],
            usage_metadata=SimpleNamespace(total_token_count=123))
        client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(
            generate_content=AsyncMock(return_value=response)), aclose=AsyncMock()))
        ledger = Mock()
        ledger.reserve.return_value = ('reservation', 0, 'ready')
        with patch('progress.grading.genai.Client', return_value=client) as factory, \
             patch('progress.grading.AsyncGroq') as groq, \
             patch('progress.grading.AsyncOpenAI') as deepseek, \
             patch('progress.grading.QuotaLedger', return_value=ledger) as quota:
            result = await grade('My practice answer.', api_key='google-key', model='selected-google', provider='google')
        self.assertEqual(result.cefr_estimate, 'B1')
        groq.assert_not_called()
        deepseek.assert_not_called()
        self.assertEqual(quota.call_args.args[:2], ('google:google-key', 'selected-google'))
        self.assertEqual(factory.call_args.kwargs['http_options'].retry_options.attempts, 1)
        sent = client.aio.models.generate_content.call_args.kwargs
        self.assertEqual(sent['model'], 'selected-google')
        self.assertEqual(sent['contents'], 'My practice answer.')
        self.assertEqual(sent['config'].response_mime_type, 'application/json')
        ledger.settle.assert_called_once_with('reservation', 123)
        client.aio.aclose.assert_awaited_once()

    async def test_google_failure_is_unknown_not_perfect_or_fallback(self):
        client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(
            generate_content=AsyncMock(side_effect=TimeoutError())), aclose=AsyncMock()))
        ledger = Mock()
        ledger.reserve.return_value = ('reservation', 0, 'ready')
        with patch('progress.grading.genai.Client', return_value=client), \
             patch('progress.grading.AsyncGroq') as other, \
             patch('progress.grading.QuotaLedger', return_value=ledger):
            self.assertIsNone(await grade('My answer.', api_key='key', model='google-model', provider='google'))
        other.assert_not_called()
        client.aio.aclose.assert_awaited_once()

    async def test_groq_uses_only_selected_grading_model(self):
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(
            return_value=SimpleNamespace(usage=None, choices=[SimpleNamespace(
                finish_reason='stop', message=SimpleNamespace(content='{"errors":[]}'))])))), close=AsyncMock())
        ledger = Mock()
        ledger.reserve.return_value = ('reservation', 0, 'ready')
        with patch('progress.grading.AsyncGroq', return_value=client), \
             patch('progress.grading.AsyncOpenAI') as other, \
             patch('progress.grading.QuotaLedger', return_value=ledger):
            self.assertIsNotNone(await grade('My answer.', api_key='key', model='groq-grader', provider='groq'))
        self.assertEqual(client.chat.completions.create.call_args.kwargs['model'], 'groq-grader')
        other.assert_not_called()

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
        for provider in ('groq', 'google', 'deepseek', 'unsupported'):
            self.assertIsNone(await grade("Answer", api_key="", model="selected", provider=provider))

    async def test_google_truncation_is_not_a_valid_grade(self):
        client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=AsyncMock(
            return_value=SimpleNamespace(candidates=[SimpleNamespace(finish_reason='MAX_TOKENS')]))), aclose=AsyncMock()))
        ledger = Mock()
        ledger.reserve.return_value = ('reservation', 0, 'ready')
        with patch('progress.grading.genai.Client', return_value=client), \
             patch('progress.grading._parse') as parse, \
             patch('progress.grading.QuotaLedger', return_value=ledger):
            self.assertIsNone(await grade('My answer.', api_key='key', model='selected', provider='google'))
        parse.assert_not_called()
        client.aio.aclose.assert_awaited_once()
