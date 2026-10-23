import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from agent.corrections import correction_config, review_response
from tests.test_models import settings


class CorrectionProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_live_providers_use_only_the_selected_model_and_json_transport(self):
        for provider in ('groq', 'google', 'deepseek'):
            with self.subTest(provider=provider):
                config = settings('deepseek')  # Deliberately different from the corrector.
                config.CORRECTION_PROVIDER = provider
                config.CORRECTION_MODEL = 'selected-corrector'
                payload = {'corrections': [{'learner_text': 'I go yesterday', 'corrected_text': 'I went yesterday',
                    'pattern': 'Past simple', 'explanation': 'Usa pasado.', 'recovery_task': 'Describe another day.'}],
                    'feedback': 'Practica el pasado.'}
                result = SimpleNamespace(usage=None, text=json.dumps(payload), usage_metadata=None,
                    candidates=[SimpleNamespace(finish_reason='STOP')],
                    choices=[SimpleNamespace(finish_reason='stop', message=SimpleNamespace(content=json.dumps(payload)))])
                request = AsyncMock(return_value=result)
                close = AsyncMock()
                client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=request)),
                    close=close, aio=SimpleNamespace(models=SimpleNamespace(generate_content=request), aclose=close))
                ledger = Mock()
                ledger.reserve.return_value = ('reservation', 0, 'ready')
                with patch('agent.corrections.AsyncGroq', return_value=client) as groq, \
                     patch('agent.corrections.AsyncOpenAI', return_value=client) as deepseek, \
                     patch('agent.corrections.genai.Client', return_value=client) as google, \
                     patch('agent.corrections.QuotaLedger', return_value=ledger) as quota:
                    output = await review_response(config, 'I go yesterday', 'Spanish')
                self.assertEqual(output['corrections'][0]['provider'], provider)
                self.assertEqual(request.call_args.kwargs['model'], 'selected-corrector')
                self.assertEqual(sum(factory.call_count for factory in (groq, deepseek, google)), 1)
                self.assertEqual(quota.call_args.args[1], 'selected-corrector')
                request.assert_awaited_once()
                close.assert_awaited_once()

    async def test_missing_key_and_oversize_evidence_do_not_call_a_provider(self):
        config = settings('google')
        config.CORRECTION_PROVIDER = 'groq'
        config.CORRECTION_MODEL = None
        config.GROQ_API_KEY = ''
        with patch('agent.corrections.AsyncGroq') as client:
            with self.assertRaises(ValueError):
                await review_response(config, 'My answer.', 'English')
            config.GROQ_API_KEY = 'test'
            config.GROQ_MAX_REQUEST_TOKENS = 1
            with self.assertRaises(ValueError):
                await review_response(config, 'My answer.', 'English')
        client.assert_not_called()

    async def test_unverified_quotes_are_rejected_without_fallback(self):
        config = settings()
        config.CORRECTION_PROVIDER = 'groq'
        config.CORRECTION_MODEL = None
        payload = {'corrections': [{'learner_text': 'invented', 'corrected_text': 'fixed',
            'pattern': 'Tense', 'explanation': 'Reason', 'recovery_task': 'Try again'}], 'feedback': 'Review.'}
        response = SimpleNamespace(usage=None, choices=[SimpleNamespace(finish_reason='stop',
            message=SimpleNamespace(content=json.dumps(payload)))])
        client = SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response))),
            close=AsyncMock())
        ledger = Mock()
        ledger.reserve.return_value = ('reservation', 0, 'ready')
        with patch('agent.corrections.AsyncGroq', return_value=client), \
             patch('agent.corrections.AsyncOpenAI') as other, \
             patch('agent.corrections.QuotaLedger', return_value=ledger):
            with self.assertRaises(ValueError):
                await review_response(config, 'My real answer.', 'English')
        other.assert_not_called()
        client.close.assert_awaited_once()

    def test_legacy_unset_corrector_is_explicit(self):
        config = settings()
        config.CORRECTION_PROVIDER = None
        self.assertIsNone(correction_config(config))
