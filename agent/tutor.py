import importlib.resources
import logging
import uuid
import asyncio
import json
import time
from datetime import datetime, timedelta, timezone

from livekit.agents import Agent, AgentSession, JobContext, APIStatusError, APIError, TurnHandlingOptions
from livekit.agents.types import APIConnectOptions, NOT_GIVEN
from livekit.plugins import groq, silero

import progress
from agent import avatars, personas
from agent.practice import Practice
from agent.quota import QuotaLedger, compact_context, request_tokens, retry_delay, quota_message
from agent.text_filters import strip_tool_call_leakage
from agent.text_feedback import correction_was_shown, audio_safe_chunks, recovery_invitation
from config.settings import settings
from plugins.edge_tts import EdgeTTS
from prompts.tutor import LANGUAGES, tutor_prompt
from tools import search_web
from tools.search import find_listening_video

logger = logging.getLogger(__name__)

# The web app signs a learner into the room under this identity prefix (see
# web/app/api/token/route.ts). Anything joining without it — a stray SDK client, a curl'd
# token, an older frontend build — is treated as anonymous and simply not tracked.
LEARNER_IDENTITY_PREFIX = "learner_"

# Participant attribute set by the token route: "boy" | "girl" | "photo". It rides in the
# signed room token, so a client cannot claim the photo avatar without the server having
# verified there is a photo to use.
AVATAR_MODE_ATTRIBUTE = "avatar_mode"


class EnglishTutor(Agent):
    """
    The tutor agent. In livekit-agents v1.x, instructions become the system
    prompt sent to the LLM on every turn — no manual ChatContext needed.
    """

    def __init__(self, persona: personas.Persona, practice: Practice, history: str) -> None:
        self.practice = practice
        self._name = persona.name
        self._history = history
        self._quota_paused = False
        self.quota = QuotaLedger(
            settings.GROQ_API_KEY, settings.LLM_MODEL,
            settings.GROQ_TPM_BUDGET, settings.GROQ_TPD_BUDGET,
            settings.GROQ_RPM_BUDGET, settings.GROQ_RPD_BUDGET,
        )
        super().__init__(
            instructions=tutor_prompt(persona.name, practice.language, practice.mode, history),
            tools=[search_web, find_listening_video, practice.practice_control, practice.record_learning],
        )
        self._greeting = persona.greeting

    async def on_enter(self) -> None:
        """Called once when the agent joins the session. Used for the greeting."""
        greetings = {
            "es": ("Hola, soy tu profesor de inglés. ¿Prefieres un tema propuesto por mí o quieres elegirlo tú?",
                   "Vamos a hacer el diagnóstico. Responde en inglés, sin preparar ni leer respuestas. Tell me about yourself, your usual week, and something you enjoy doing."),
            "en": ("Hello, I'm your English teacher. Would you like my suggested topic or your own?",
                   "Let's start the diagnostic. Answer in English without prepared notes. Tell me about yourself, your usual week, and something you enjoy doing."),
            "pt": ("Olá, sou seu professor de inglês. Você prefere um tema sugerido por mim ou quer escolher?",
                   "Vamos começar o diagnóstico. Responda em inglês sem ler respostas preparadas. Tell me about yourself and your usual week."),
            "fr": ("Bonjour, je suis votre professeur d'anglais. Préférez-vous mon sujet ou choisir le vôtre ?",
                   "Commençons le diagnostic. Répondez en anglais sans lire de réponses préparées. Tell me about yourself and your usual week."),
            "de": ("Hallo, ich bin dein Englischlehrer. Möchtest du meinen Themenvorschlag oder dein eigenes Thema?",
                   "Beginnen wir die Einstufung. Antworte auf Englisch ohne vorbereitete Antworten. Tell me about yourself and your usual week."),
            "it": ("Ciao, sono il tuo insegnante di inglese. Preferisci un mio argomento o vuoi sceglierlo?",
                   "Iniziamo la valutazione. Rispondi in inglese senza leggere risposte preparate. Tell me about yourself and your usual week."),
            "zh": ("你好，我是你的英语老师。你想自己选话题，还是让我推荐？",
                   "现在开始水平测试。请用英语回答，不要读提前准备的答案。Tell me about yourself and your usual week."),
            "ja": ("こんにちは。英語の先生です。話題を自分で選びますか、それとも私が提案しましょうか？",
                   "レベルチェックを始めましょう。用意した答えを読まずに英語で答えてください。Tell me about yourself and your usual week."),
        }
        if self.practice.mode == "diagnostic":
            await self.practice.practice_control("start")
        greeting = greetings[self.practice.language][self.practice.mode == "diagnostic"]
        await self.session.say(greeting, allow_interruptions=False)
        await self.practice.publish()

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        # The full measured state is built once per request, not accumulated as
        # another system message on every turn.
        await self.practice.publish()

    def _learning_memory(self) -> str:
        entries = []
        for line in self._history.splitlines():
            try:
                entries.append(json.loads(line))
            except ValueError:
                continue
        entries.extend(self.practice.entries)
        # Explicit evidence, not an invented LLM summary. Focus on latest priorities.
        selected = []
        for kind in ("step", "correction", "vocabulary", "retrieval", "assessment", "listening"):
            matches = [entry for entry in entries if entry.get("kind") == kind]
            for entry in matches[-2:]:
                fields = {key: entry[key] for key in (
                    "kind", "date", "step", "evidence", "element", "state", "result",
                    "learner_text", "corrected_text", "pattern", "observed_need", "summary"
                ) if key in entry}
                selected.append(json.dumps(fields, ensure_ascii=False)[:260])
        today = datetime.now(timezone(timedelta(hours=-5))).date().isoformat()
        cards, attempts = {}, {}
        for entry in entries:
            element = entry.get("element")
            if element and entry.get("kind") == "vocabulary":
                cards[element] = entry
            elif element and entry.get("kind") == "retrieval":
                attempts[element] = entry
        due = []
        for element, card in cards.items():
            attempt = attempts.get(element, {})
            attempted = attempt.get("date", "")
            schedule = card.get("reviews") or []
            if attempt.get("state") == "ACTIVA":
                continue
            if any(attempted < day <= today for day in schedule):
                due.append({"element": element, "pattern": card.get("pattern", ""),
                            "state": attempt.get("state", "EN PRÁCTICA")})
        # A few due reviews plus current correction evidence, not the entire word bank.
        return ("Due reviews: " + json.dumps(due[:4], ensure_ascii=False)[:500]
                + "\n" + "\n".join(selected)[-1000:])

    async def _quota_notice(self, state: str, seconds: float = 0, reason: str = "") -> None:
        self.practice.quota_status = {"state": state, "wait_seconds": int(seconds),
                                      "reason": reason}
        await self.practice.publish()

    async def llm_node(self, chat_ctx, tools, model_settings):
        # The card is already visible. No second model request is needed to read
        # it back; give a short recovery invitation instead.
        if correction_was_shown(chat_ctx):
            yield recovery_invitation(self.practice.language)
            return
        policy = tutor_prompt(self._name, self.practice.language,
                              self.practice.mode, step=self.practice.index)
        clock = self.practice.status()
        policy += "\nMeasured state: " + json.dumps({
            key: clock[key] for key in ("step", "remaining_seconds", "running", "started", "finished")
        }) + ". Expiry alone is not completion."
        if self.practice.focus:
            policy += "\nConfirmed topic and oral goal: " + self.practice.focus
        # Account for schema size and the completion allowance before choosing history.
        from livekit.agents import llm
        schema_cost = request_tokens(llm.ChatContext.empty(), tools)
        budget = settings.GROQ_MAX_REQUEST_TOKENS - settings.GROQ_MAX_COMPLETION_TOKENS - schema_cost
        try:
            context = compact_context(chat_ctx, policy, self._learning_memory(), budget)
        except ValueError:
            await self._quota_notice("input_too_long")
            yield quota_message(self.practice.language, "input_too_long")
            return
        cost = request_tokens(context, tools) + settings.GROQ_MAX_COMPLETION_TOKENS
        for attempt in range(2):
            wait_started = time.monotonic()
            while True:
                reservation, wait, reason = await asyncio.to_thread(self.quota.reserve, cost)
                if reservation:
                    break
                if reason in {"daily", "oversized"} or time.monotonic() - wait_started + wait > settings.GROQ_MAX_WAIT_SECONDS:
                    await self._quota_notice("daily_limit" if reason == "daily" else "limited", wait, reason)
                    if self.practice.since is not None:
                        await self.practice.practice_control("pause")
                        self._quota_paused = True
                    yield quota_message(self.practice.language, "paused")
                    return
                if self.practice.since is not None:
                    await self.practice.practice_control("pause")
                    self._quota_paused = True
                await self._quota_notice("waiting", wait, reason)
                # Short cancellable waits; no duplicate requests while quota is exhausted.
                delay = min(wait, 5)
                await asyncio.sleep(delay)
            if self._quota_paused and not self.practice.finished:
                await self.practice.practice_control("resume")
                self._quota_paused = False
            await self._quota_notice("ready")
            emitted = False
            usage = None
            pending = []
            try:
                # Both SDK and LiveKit retries are disabled: this is the only retry owner.
                async with self.session.llm.chat(
                    chat_ctx=context, tools=tools,
                    tool_choice=model_settings.tool_choice if model_settings else NOT_GIVEN,
                    conn_options=APIConnectOptions(max_retry=0, timeout=30),
                ) as stream:
                    async for chunk in stream:
                        if chunk.usage:
                            usage = chunk.usage
                        emitted = emitted or chunk.has_response()
                        pending.append(chunk)
                # Buffer one short completion so text accompanying a correction
                # tool call cannot reach TTS before we know it's a written card.
                for chunk in audio_safe_chunks(pending):
                    yield chunk
                if usage:
                    actual = max(0, usage.prompt_tokens - usage.prompt_cached_tokens) + usage.completion_tokens
                    await asyncio.to_thread(self.quota.settle, reservation, actual)
                    self.practice.quota_status.update({"last_input_tokens": usage.prompt_tokens,
                                                      "last_output_tokens": usage.completion_tokens})
                    await self.practice.publish()
                return
            except APIStatusError as exc:
                if exc.status_code == 429 and not emitted:
                    await asyncio.to_thread(self.quota.settle, reservation, 0)
                    delay = retry_delay(exc)
                    await asyncio.to_thread(self.quota.cooldown, delay)
                    if attempt == 0:
                        continue
                await self._quota_notice("limited", reason=str(exc.status_code))
                if exc.status_code == 429 and self.practice.since is not None:
                    await self.practice.practice_control("pause")
                    self._quota_paused = True
                logger.warning("Groq request failed (status %s)", exc.status_code)
                for chunk in audio_safe_chunks(pending):
                    yield chunk
                if not emitted:
                    yield quota_message(self.practice.language, "error")
                return
            except APIError:
                logger.warning("Groq connection failed; preserving practice context", exc_info=True)
                await self._quota_notice("limited", reason="connection")
                for chunk in audio_safe_chunks(pending):
                    yield chunk
                if not emitted:
                    yield quota_message(self.practice.language, "error")
                return


def _load_vad() -> silero.VAD:
    """
    Load Silero VAD on the onnxruntime path.

    Both AgentSession's default VAD and a bare `silero.VAD.load()` resolve to
    `inference.VAD`, which imports `livekit.local_inference` — the module main.py
    replaces with a stub because its native .pyd calls ExitProcess() here. The stub's
    predict() returns 0.0 for every frame, so speech is never detected and the agent
    only ever responds to typed input.

    Passing onnx_file_path forces load() to skip that delegation. The path is the
    plugin's own bundled model, so this is the default weights, just a different runtime.
    """
    onnx_path = importlib.resources.files("livekit.plugins.silero.resources") / "silero_vad.onnx"
    return silero.VAD.load(
        onnx_file_path=str(onnx_path),
        min_silence_duration=settings.VAD_SILENCE_SECONDS,
    )


def _turn_handling_options() -> TurnHandlingOptions:
    # Short pauses may produce an STT segment, but not an assistant response.
    # Explicit VAD mode avoids treating every final Whisper segment as a turn.
    silence = max(settings.TURN_END_SILENCE_SECONDS, settings.VAD_SILENCE_SECONDS)
    return TurnHandlingOptions(
        turn_detection="vad",
        endpointing={"mode": "fixed", "min_delay": silence, "max_delay": max(6.0, silence)},
        preemptive_generation={"enabled": False},
    )


def _learner_id_from(identity: str) -> str | None:
    """
    Extract the learner's id from their LiveKit participant identity.

    Returns None for anyone who isn't a signed-in learner, which is a normal state and not an
    error: the tutor works fine untracked, it just has nothing to write a progress row
    against. The uuid check is what stops a hand-crafted identity from reaching a database
    insert as a raw string.
    """
    if not identity.startswith(LEARNER_IDENTITY_PREFIX):
        return None

    candidate = identity[len(LEARNER_IDENTITY_PREFIX) :]
    try:
        return str(uuid.UUID(candidate))
    except ValueError:
        logger.warning("participant identity %r has a malformed learner id", identity)
        return None


async def _resolve_photo_session(learner_id: str | None) -> tuple[personas.Persona, bytes] | None:
    """
    Everything the photo avatar needs, gathered up front, or None to fall back to a character.

    Runs before the AgentSession is built because the persona decides the TTS voice, and the
    voice cannot change once the session exists. The photo decides the persona: a one-off
    vision call looks at who is in the picture so that the face on screen gets the matching
    voice — a male photo speaking with Sara's voice would be worse than no avatar at all.
    """
    if learner_id is None:
        return None
    if settings.BITHUMAN_API_SECRET is None:
        logger.warning("photo avatar requested but BITHUMAN_API_SECRET is not set")
        return None

    photo = await avatars.load_avatar_photo(learner_id, dsn=settings.PROGRESS_DATABASE_URL)
    if photo is None:
        logger.warning("photo avatar requested but no photo found for learner %s", learner_id)
        return None

    gender = await avatars.detect_gender(
        photo,
        groq_api_key=settings.GROQ_API_KEY,
        model=settings.VISION_MODEL,
    )
    persona = personas.FEMALE if gender == "female" else personas.MALE
    logger.info("photo avatar: detected %s, speaking as %s", gender or "unknown", persona.name)
    return persona, photo


async def _start_photo_avatar(session: AgentSession, ctx: JobContext, photo: bytes) -> bool:
    """
    Attach the bitHuman avatar to the session. Returns False on any failure — the import is
    lazy and every error is swallowed because the avatar renders the tutor's face, not its
    brain, and a bitHuman outage (or exhausted credits) must degrade to a voice-only call.
    """
    try:
        from livekit.plugins import bithuman  # noqa: PLC0415 — heavy import, avatar calls only

        avatar = bithuman.AvatarSession(
            model="expression",
            avatar_image=avatars.photo_as_base64(photo),
            api_secret=settings.BITHUMAN_API_SECRET,
        )
        await avatar.start(session, room=ctx.room)
        return True
    except Exception:  # noqa: BLE001
        logger.exception("bitHuman avatar failed to start; continuing voice-only")
        return False


async def entrypoint(ctx: JobContext) -> None:
    """LiveKit job entrypoint — called once per room session."""
    logger.info("English Tutor agent starting for room: %s", ctx.room.name)

    await ctx.connect()

    # Who is on the other end? The frontend puts the learner's id in the participant identity
    # and the avatar choice in the attributes when it mints the room token. We must ask before
    # starting the session: the collector has to be listening before the first word is spoken,
    # and the avatar choice decides the TTS voice, which is fixed at session construction.
    participant = await ctx.wait_for_participant()
    learner_id = _learner_id_from(participant.identity)
    avatar_mode = participant.attributes.get(AVATAR_MODE_ATTRIBUTE, "")
    language = participant.attributes.get("native_language", "es")
    if language not in LANGUAGES:
        language = "es"
    mode = participant.attributes.get("practice_mode", "daily")
    if mode not in {"daily", "diagnostic"}:
        mode = "daily"
    practice = Practice(learner_id, ctx.room, settings.PROGRESS_DATABASE_URL, mode, language)
    history = await practice.history()

    # Reliable data messages are not retained for clients that subscribe later.
    # Re-send state so the panel recovers after mounting or reconnecting.
    async def _sync_practice() -> None:
        while True:
            await practice.publish()
            await asyncio.sleep(5)

    practice_sync = asyncio.create_task(_sync_practice())

    async def _close_practice() -> None:
        practice_sync.cancel()
        try:
            await practice_sync
        except asyncio.CancelledError:
            pass
        await practice.practice_control("finish", "Call ended; unconfirmed activities remain pending.")
        await practice.flush()

    ctx.add_shutdown_callback(_close_practice)

    photo: bytes | None = None
    if avatar_mode == "photo":
        resolved = await _resolve_photo_session(learner_id)
        if resolved is not None:
            persona, photo = resolved
        else:
            persona = personas.DEFAULT
    else:
        persona = personas.BY_CHARACTER.get(avatar_mode, personas.DEFAULT)

    session = AgentSession(
        stt=groq.STT(model=settings.STT_MODEL, detect_language=True),
        llm=groq.LLM(model=settings.LLM_MODEL,
                     max_completion_tokens=settings.GROQ_MAX_COMPLETION_TOKENS,
                     max_retries=0),
        tts=EdgeTTS(voice="en-US-AndrewMultilingualNeural" if persona.name == "Ahmad" else "en-US-AvaMultilingualNeural"),
        vad=_load_vad(),
        turn_handling=_turn_handling_options(),
        # Groq's llama-3.3-70b-versatile occasionally leaks a tool call into the
        # reply text as literal `<function=...>...</function>` syntax instead of
        # the structured tool_calls field. See agent/text_filters.py.
        tts_text_transforms=[strip_tool_call_leakage],
    )

    collector: progress.TranscriptCollector | None = None

    if learner_id is None:
        logger.info(
            "participant %s is not a signed-in learner; running untracked",
            participant.identity,
        )
    else:
        collector = progress.TranscriptCollector(
            learner_id=learner_id,
            room_name=ctx.room.name,
        )
        collector.attach(session)

        # Analysis runs here, not during the call. A shutdown callback fires once the room is
        # closing, which is exactly when the transcript is complete and nobody is waiting on
        # latency any more — the grading call is a 70B model round trip and would be audible
        # as dead air if it ran mid-conversation.
        async def _record_progress() -> None:
            await progress.run_analysis(
                collector,
                dsn=settings.PROGRESS_DATABASE_URL,
                groq_api_key=settings.GROQ_API_KEY,
                grading_model=settings.GRADING_MODEL,
            )

        ctx.add_shutdown_callback(_record_progress)
        logger.info("tracking progress for learner %s", learner_id)

    # The avatar must attach BEFORE session.start: it replaces the session's audio output so
    # the speech streams through the avatar worker, which lip-syncs it and publishes both
    # tracks. Failure here just means the frontend never sees a video track and renders the
    # free animated character instead.
    if photo is not None:
        await _start_photo_avatar(session, ctx, photo)

    await session.start(
        room=ctx.room,
        agent=EnglishTutor(persona, practice, history),
    )
