"""Select a conversation provider without changing STT, grading or learning tools."""
from dataclasses import dataclass, field

# LiveKit registers plugins at import time, which must run on the main thread.
# This module is imported by tutor.py during bootstrap, before worker jobs start.
from livekit.plugins import google, groq, openai
from google.genai import types


@dataclass(frozen=True)
class ModelPolicy:
    provider: str
    model: str
    api_key: str = field(repr=False)
    tpm: int
    tpd: int
    rpm: int
    rpd: int
    max_request: int
    max_output: int
    max_wait: int


def model_policy(settings) -> ModelPolicy:
    prefix = {"google": "GOOGLE", "groq": "GROQ", "deepseek": "DEEPSEEK"}[settings.LLM_PROVIDER]
    key = getattr(settings, f"{prefix}_API_KEY")
    if not key or not key.strip():
        raise ValueError(f"{prefix}_API_KEY is required for the selected LLM_PROVIDER")
    policy = ModelPolicy(
        settings.LLM_PROVIDER,
        settings.LLM_MODEL if prefix == "GROQ" else getattr(settings, f"{prefix}_LLM_MODEL"),
        key,
        *(getattr(settings, f"{prefix}_{name}") for name in (
            "TPM_BUDGET", "TPD_BUDGET", "RPM_BUDGET", "RPD_BUDGET",
            "MAX_REQUEST_TOKENS", "MAX_COMPLETION_TOKENS", "MAX_WAIT_SECONDS")),
    )
    if policy.max_request <= policy.max_output:
        raise ValueError("Request token budget must exceed the output allowance")
    return policy


def create_llm(settings):
    policy = model_policy(settings)
    if policy.provider == "deepseek":
        # OpenAI-compatible transport from LiveKit; disable thinking explicitly
        # for low-latency speech and tool turns without reasoning_content replay.
        return openai.LLM(model=policy.model, api_key=policy.api_key,
                          base_url="https://api.deepseek.com/v1",
                          max_completion_tokens=policy.max_output,
                          max_retries=0,
                          extra_body={"thinking": {"type": "disabled"}})
    if policy.provider == "google":
        return google.LLM(model=policy.model, api_key=policy.api_key,
                          max_output_tokens=policy.max_output,
                          http_options=types.HttpOptions(
                              retry_options=types.HttpRetryOptions(attempts=1)))
    return groq.LLM(model=policy.model, api_key=policy.api_key,
                    max_completion_tokens=policy.max_output, max_retries=0)


def grading_config(settings) -> tuple[str, str]:
    """Select grading independently of the conversation provider. No fallback."""
    provider = settings.GRADING_PROVIDER
    prefix = {"google": "GOOGLE", "groq": "GROQ", "deepseek": "DEEPSEEK"}[provider]
    key = getattr(settings, f"{prefix}_API_KEY") or ""
    model = settings.GRADING_MODEL if provider == "groq" else getattr(settings, f"{prefix}_GRADING_MODEL")
    return key, model
