import unittest
import subprocess
import sys
import os
from types import SimpleNamespace
from unittest.mock import patch
from agent.models import model_policy, create_llm, grading_config


def settings(provider="groq", key="test"):
    data = dict(LLM_PROVIDER=provider, GROQ_API_KEY="groq-test",
                GOOGLE_API_KEY=key, DEEPSEEK_API_KEY=key,
                DEEPSEEK_LLM_MODEL="deepseek-flash", LLM_MODEL="openai/gpt-oss-20b",
                GOOGLE_LLM_MODEL="gemini-3-flash-preview")
    for prefix, limit in (("GROQ", 3600), ("GOOGLE", 16000), ("DEEPSEEK", 32000)):
        for field, value in dict(TPM_BUDGET=60000, TPD_BUDGET=300000,
                                 RPM_BUDGET=5, RPD_BUDGET=20,
                                 MAX_REQUEST_TOKENS=limit,
                                 MAX_COMPLETION_TOKENS=640,
                                 MAX_WAIT_SECONDS=60).items():
            data[f"{prefix}_{field}"] = value
    return SimpleNamespace(**data)


class ModelsTests(unittest.TestCase):
    def test_grading_selection_is_independent_of_conversation(self):
        config = settings('deepseek')
        config.GRADING_MODEL = 'groq-grade'
        config.GOOGLE_GRADING_MODEL = 'google-grade'
        config.DEEPSEEK_GRADING_MODEL = 'deepseek-grade'
        for provider, expected in [('groq', ('groq-test', 'groq-grade')),
                                   ('google', ('test', 'google-grade')),
                                   ('deepseek', ('test', 'deepseek-grade'))]:
            config.GRADING_PROVIDER = provider
            self.assertEqual(grading_config(config), expected)
            self.assertEqual(model_policy(config).provider, 'deepseek')

    def test_deepseek_policy_and_missing_key(self):
        p = model_policy(settings("deepseek"))
        self.assertEqual((p.provider, p.model, p.max_request),
                         ("deepseek", "deepseek-flash", 32000))
        with self.assertRaisesRegex(ValueError, "DEEPSEEK_API_KEY"):
            model_policy(settings("deepseek", None))

    def test_deepseek_uses_direct_endpoint_without_thinking_or_retries(self):
        with patch("agent.models.openai.LLM") as factory:
            create_llm(settings("deepseek"))
            args = factory.call_args.kwargs
            self.assertEqual(args["base_url"], "https://api.deepseek.com/v1")
            self.assertEqual(args["model"], "deepseek-flash")
            self.assertEqual(args["extra_body"], {"thinking": {"type": "disabled"}})
            self.assertEqual(args["max_retries"], 0)
            self.assertEqual(args["max_completion_tokens"], 640)

    def test_bootstrap_registers_google_before_worker_thread(self):
        # Fresh interpreter: previous tests importing Google must not hide a
        # first-call registration failure on Windows' threaded job runner.
        code = '''
import main
import sys
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from livekit.agents import Plugin
from agent.models import create_llm
from config.settings import settings
assert "livekit.plugins.google" in sys.modules
assert any(p.package == "livekit.plugins.google" for p in Plugin.registered_plugins)
with patch("agent.models.google.LLM") as factory:
    with ThreadPoolExecutor(max_workers=1) as executor:
        executor.submit(create_llm, settings).result(timeout=10)
    factory.assert_called_once()
'''
        env = {**os.environ, "LIVEKIT_URL": "wss://test.livekit.cloud",
               "LIVEKIT_API_KEY": "test", "LIVEKIT_API_SECRET": "test",
               "GROQ_API_KEY": "test", "TAVILY_API_KEY": "test",
               "GOOGLE_API_KEY": "test", "LLM_PROVIDER": "google"}
        result = subprocess.run([sys.executable, "-c", code], env=env,
                                capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_groq_keeps_existing_model_and_budget(self):
        p = model_policy(settings())
        self.assertEqual((p.model, p.max_request), ("openai/gpt-oss-20b", 3600))

    def test_google_has_independent_model_and_budget(self):
        p = model_policy(settings("google"))
        self.assertEqual((p.api_key, p.max_request), ("test", 16000))

    def test_missing_google_key_fails_explicitly(self):
        with self.assertRaisesRegex(ValueError, "GOOGLE_API_KEY"):
            model_policy(settings("google", None))

    def test_google_factory_preserves_tool_capable_plugin(self):
        with patch("livekit.plugins.google.LLM") as factory:
            create_llm(settings("google"))
            self.assertEqual(factory.call_args.kwargs["model"], "gemini-3-flash-preview")
            self.assertEqual(factory.call_args.kwargs["http_options"].retry_options.attempts, 1)

    def test_invalid_budget_rejected(self):
        config = settings("google")
        config.GOOGLE_MAX_REQUEST_TOKENS = 100
        with self.assertRaises(ValueError):
            model_policy(config)
