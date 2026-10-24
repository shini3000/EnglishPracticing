from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Literal


class Settings(BaseSettings):
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    LOG_DIR: str = "logs"
    LOG_MAX_BYTES: int = Field(default=5242880, gt=0)
    LOG_BACKUP_COUNT: int = Field(default=5, ge=1)
    # LiveKit — required, must be in .env
    LIVEKIT_URL: str
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str

    # Groq — required, must be in .env
    GROQ_API_KEY: str
    # Groq supplies transcription and optional grading; photo voice is user-selected.
    LLM_PROVIDER: Literal["groq", "google", "deepseek"] = "groq"
    DEEPSEEK_API_KEY: str | None = None
    DEEPSEEK_LLM_MODEL: str = "deepseek-flash"
    GRADING_PROVIDER: Literal["groq", "google", "deepseek"] = "groq"
    GOOGLE_GRADING_MODEL: str = "gemini-3-flash-preview"
    # Optional for backwards compatibility: unset keeps live corrections in the
    # conversational model. Set explicitly to separate this responsibility.
    CORRECTION_PROVIDER: Literal["groq", "google", "deepseek"] | None = None
    CORRECTION_MODEL: str | None = None
    DEEPSEEK_GRADING_MODEL: str = "deepseek-flash"
    DEEPSEEK_HISTORY_TURNS: int = Field(default=48, ge=1, le=200)
    # Local safeguards, not provider quotas or a hard monetary spending cap.
    DEEPSEEK_TPM_BUDGET: int = Field(default=60000, gt=0)
    DEEPSEEK_TPD_BUDGET: int = Field(default=300000, gt=0)
    DEEPSEEK_RPM_BUDGET: int = Field(default=10, gt=0)
    DEEPSEEK_RPD_BUDGET: int = Field(default=300, gt=0)
    DEEPSEEK_MAX_REQUEST_TOKENS: int = Field(default=32000, gt=0)
    DEEPSEEK_MAX_COMPLETION_TOKENS: int = Field(default=1024, gt=0)
    DEEPSEEK_MAX_WAIT_SECONDS: int = Field(default=10, ge=0)
    GOOGLE_API_KEY: str | None = None
    GOOGLE_LLM_MODEL: str = "gemini-3-flash-preview"
    GOOGLE_HISTORY_TURNS: int = Field(default=48, ge=1, le=200)
    GOOGLE_TPM_BUDGET: int = Field(default=60000, gt=0)
    GOOGLE_TPD_BUDGET: int = Field(default=300000, gt=0)
    GOOGLE_RPM_BUDGET: int = Field(default=5, gt=0)
    GOOGLE_RPD_BUDGET: int = Field(default=20, gt=0)
    GOOGLE_MAX_REQUEST_TOKENS: int = Field(default=32000, gt=0)
    GOOGLE_MAX_COMPLETION_TOKENS: int = Field(default=2048, gt=0)
    GOOGLE_MAX_WAIT_SECONDS: int = Field(default=60, ge=0)

    # Tavily — required, must be in .env. Backs the agent's search_web tool.
    TAVILY_API_KEY: str

    # Postgres for progress tracking (Neon). DELIBERATELY OPTIONAL — do not "tidy" this into
    # a required field.
    #
    # Every other key above is required, which means a missing one raises a pydantic error at
    # import and the deployed worker crashloops. That is the right trade for GROQ_API_KEY: an
    # agent that cannot speak is not worth running. It is the WRONG trade here. Progress
    # tracking is a feature *of* the tutor, not a precondition for it, and making the database
    # required would turn a Neon outage into a tutor that will not start at all — trading a
    # working voice call for a chart nobody is looking at mid-outage.
    #
    # When this is None the agent runs exactly as it did before this feature existed, and
    # progress/__init__.py logs a warning per session. See ARCHITECTURE.md §5.
    PROGRESS_DATABASE_URL: str | None = None

    # LLM — llama-3.3-70b-versatile is Groq's most capable free model
    LLM_MODEL: str = "llama-3.3-70b-versatile"

    # The model that grades a finished session (progress/grading.py). Separate from LLM_MODEL
    # because the two jobs pull in opposite directions: the conversational model is chosen for
    # latency, the grader for judgement, and it runs after the call when nobody is waiting.
    # They point at the same model today; this exists so raising one doesn't slow the other.
    GRADING_MODEL: str = "llama-3.3-70b-versatile"

    # STT — prefer full Whisper v3 for faithful learner speech transcription.
    STT_MODEL: str = "whisper-large-v3"

    # Conservative local caps; Groq's organization-wide limits remain authoritative.
    GROQ_TPM_BUDGET: int = 7200
    GROQ_TPD_BUDGET: int = 180000
    GROQ_RPM_BUDGET: int = 24
    GROQ_RPD_BUDGET: int = 900
    GROQ_MAX_REQUEST_TOKENS: int = 3600
    GROQ_MAX_COMPLETION_TOKENS: int = 640
    GROQ_MAX_WAIT_SECONDS: int = 60

    # Allow thinking pauses while learning; measured from the last detected speech.
    TURN_END_SILENCE_SECONDS: float = Field(default=3.0, ge=0.5, le=15.0)
    VAD_SILENCE_SECONDS: float = Field(default=1.0, ge=0.2, le=3.0)

    # TTS — Microsoft Edge Neural voices (free, no key needed). One per persona: the learner
    # picks a boy or girl tutor on the pre-call screen, and an uploaded photo avatar picks
    # whichever voice the learner explicitly selects for their photo.
    TTS_VOICE_MALE: str = "en-US-ChristopherNeural"
    TTS_VOICE_FEMALE: str = "en-US-JennyNeural"

    # bitHuman — backs the personalized photo avatar. OPTIONAL for the same reason as
    # PROGRESS_DATABASE_URL below: the avatar is a feature of the tutor, not a precondition
    # for it. Missing key = no photo avatars, never a crashloop.
    BITHUMAN_API_SECRET: str | None = None

    # Legacy setting accepted for old .env files; unused (no photo vision request).
    VISION_MODEL: str = "qwen/qwen3.6-27b"

    # Greeting spoken when a user joins the room. {name} is replaced with the persona the
    # learner picked (Ahmad or Sara) — agent/personas.py does the substitution.
    AGENT_GREETING: str = (
        "Hi there! I'm {name}, your English tutor. "
        "Feel free to talk to me about anything — I'm here to help you practice. "
        "So, what's on your mind today?"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
