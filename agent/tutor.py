import importlib.resources
import logging
import uuid
import asyncio
import json
import time
from datetime import datetime, timedelta, timezone

from livekit.agents import Agent, AgentSession, JobContext, APIStatusError, APIError, TurnHandlingOptions, function_tool
from livekit.agents.types import APIConnectOptions, NOT_GIVEN
from livekit.plugins import groq, silero

import progress
from agent import avatars, personas
from agent.practice import Practice
from agent.models import model_policy, create_llm, grading_config
from agent.corrections import CorrectionValidationError, anchored_quote, correction_config, review_response
from agent.quota import QuotaLedger, compact_context, request_tokens, retry_delay, quota_message
from agent.text_filters import strip_tool_call_leakage
from agent.text_feedback import correction_was_shown, AudioDeliveryGate, recovery_invitation
from config.settings import settings
from plugins.edge_tts import EdgeTTS
from prompts.tutor import LANGUAGES, tutor_prompt
from tools import search_web
from tools.search import find_listening_video
from utils.logger import configure_logging, bind_log_context, reset_log_context
from utils.latency import attach_latency_logging

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
        self._correction_cache = {}
        self._correction_scope = None
        self._correction_turns = []
        self._independent_corrections = correction_config(settings) is not None
        self.model_policy = model_policy(settings)
        p = self.model_policy
        self.quota = QuotaLedger(
            p.provider + ":" + p.api_key, p.model,
            p.tpm, p.tpd, p.rpm, p.rpd,
        )
        super().__init__(
            instructions=tutor_prompt(persona.name, practice.language, practice.mode, history,
                                      independent_corrections=self._independent_corrections),
            # Agent discovers @function_tool methods on this instance automatically.
            tools=[search_web, find_listening_video, practice.practice_control],
        )
        self._greeting = persona.greeting

    @function_tool
    async def pending_vocabulary(self, page: int = 0) -> str:
        """List vocabulary that must be practised today, 20 words per page. Begin at page 0 and use next_page until null."""
        if self.practice.mode != "vocabulary":
            return json.dumps({"error": "wrong_practice_mode"})
        if self.practice.vocabulary_pending is None:
            return json.dumps({"error": "progress_unavailable"})
        if page < 0:
            return json.dumps({"error": "invalid_page"})
        words = self.practice.vocabulary_pending
        start = page * 20
        return json.dumps({"words": [{**word, "practised_this_session": word["key"] in self.practice.vocabulary_seen} for word in words[start:start + 20]], "total": len(words),
                           "next_page": page + 1 if start + 20 < len(words) else None})

    @function_tool
    async def record_learning(self, kind: str, details_json: str) -> str:
        """Save learning evidence. Correction: learner_text quoted from an observed
        learner turn in THIS step, including before 'I'm done' or a retry request; when a separate
        corrector is configured it generates the card, otherwise include corrected_text,
        pattern, explanation, recovery_task. Vocabulary: element,observed_need,meaning,
        pattern,pronunciation,restrictions,collocations,examples (2),transfer_task.
        Structure: element,meaning,pattern,examples (2),transfer_task.
        Retrieval: element,item_type (vocabulary/structure),result (unaided/helped/failed),
        attempt_type (repetition/review/transfer),context,evidence (exact learner quote).
        Feedback: summary. Other kinds: listening/assessment.
        """
        if kind != "correction" or not self._independent_corrections:
            return await self.practice.record_learning(kind, details_json)
        try:
            data = json.loads(details_json)
            quote = data.get("learner_text") if isinstance(data, dict) else None
            text = self._correction_evidence(quote)
            if text is None:
                logger.warning("correction.rejected", extra={"reason_code": "quote_not_observed",
                    "step_index": self.practice.index})
                return "Use an exact quote from the learner's observed response in this step, not a request to retry or finish. No correction was generated."
            # Review the whole current response once, not one paid request per error.
            cache_key = (self._correction_scope, correction_config(settings), self.practice.language, text)
            if cache_key in self._correction_cache:
                return self._correction_cache[cache_key]
            result = await review_response(settings, text, LANGUAGES.get(self.practice.language, "Spanish"))
            outcomes = [json.loads(await self.practice.record_learning("correction", json.dumps(card)))
                        for card in result["corrections"]]
            feedback = json.loads(await self.practice.record_learning("feedback", json.dumps({"summary": result["feedback"]})))
            response = json.dumps({"kind": "correction_review", "saved": feedback.get("saved") and all(c.get("saved") for c in outcomes),
                                   "delivery": "text_only" if outcomes else "journal",
                                   "feedback": result["feedback"], "correction_count": len(outcomes)})
            self._correction_cache[cache_key] = response
            if len(self._correction_cache) > 128:
                self._correction_cache.pop(next(iter(self._correction_cache)))
            return response
        except Exception as exc:
            logger.warning("correction.failed", extra={"error_type": type(exc).__name__,
                "reason_code": exc.code if isinstance(exc, CorrectionValidationError) else "provider_or_delivery_error"})
            return "Correction unavailable. Keep the response pending and offer a retry. Do not invent a correction or claim no errors."

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
        self.practice.latest_user_text = new_message.text_content or ""
        self._remember_correction_turn(self.practice.latest_user_text)
        await self.practice.publish()

    def _remember_correction_turn(self, text):
        # A monologue can span multiple STT turns. "I'm done" or "retry" must
        # not erase the evidence. Never reuse speech from a different step.
        scope = (self.practice.index, len(self.practice.completed))
        if scope != self._correction_scope:
            self._correction_scope = scope
            self._correction_turns = []
        if text.strip() and (not self._correction_turns or text != self._correction_turns[-1]):
            self._correction_turns.append(text)
        # Bounded to the corrector's input limit. Preserve complete turns.
        while len(self._correction_turns) > 1 and len("\n".join(self._correction_turns)) > 8000:
            self._correction_turns.pop(0)

    def _correction_evidence(self, quote):
        self._remember_correction_turn(self.practice.latest_user_text if self._correction_scope is None else "")
        if not isinstance(quote, str) or not quote.strip():
            return None
        turns = [text for text in self._correction_turns if anchored_quote(text, quote) is not None]
        if not turns:
            return None
        if self.practice.mode == "fluency" and self.practice.index == 4:
            return "\n".join(self._correction_turns)
        return turns[-1]

    def _learning_memory(self) -> str:
        entries = []
        for line in self._history.splitlines():
            try:
                entries.append(json.loads(line))
            except ValueError:
                continue
        entries.extend(self.practice.entries)
        snapshots = [entry for entry in entries if entry.get("kind") == "learning_snapshot"]
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
        if snapshots:
            due = [{"element": item["label"], "item_type": item["item_type"],
                    "state": item["state"], "next_review": item["next_review"]}
                   for item in snapshots if item.get("due")]
        memory = ("Due reviews: " + json.dumps(due[:4], ensure_ascii=False)[:500]
                  + "\n" + "\n".join(selected)[-1000:])
        if self.practice.mode == "fluency" and self.practice.index == 4:
            self._remember_correction_turn("")
            memory += "\nObserved monologue excerpt (evidence only; quote this for correction after completion): " + json.dumps(
                "\n".join(self._correction_turns)[-1200:], ensure_ascii=False)
        return memory

    async def _quota_notice(self, state: str, seconds: float = 0, reason: str = "") -> None:
        self.practice.quota_status = {"state": state, "wait_seconds": int(seconds),
                                      "reason": reason}
        await self.practice.publish()

    async def llm_node(self, chat_ctx, tools, model_settings):
        if self.practice.mode == "fluency" and 5 <= self.practice.index <= 14:
            yield ("Este bloque se hace sin llamada con el tutor. Abre el ejercicio desde el panel."
                   if self.practice.language == "es" else
                   "This block runs outside the tutor conversation. Open the exercise from the practice panel.")
            return
        # The card is already visible. No second model request is needed to read
        # it back; give a short recovery invitation instead.
        if correction_was_shown(chat_ctx):
            if self.practice.mode == "fluency" and self.practice.index == 4 and not self.practice.feedback_ready:
                await self.practice.record_learning("feedback", json.dumps({"summary":
                    "Las correcciones de tu respuesta están en pantalla. Revisa la estructura y reformula sin leer; cuando termines, puedes continuar al bloque siguiente."
                    if self.practice.language == "es" else
                    "Your response corrections are on screen. Review the structure and rephrase without reading; when you are ready, you can continue to the next block."}))
            yield recovery_invitation(self.practice.language)
            return
        policy = tutor_prompt(self._name, self.practice.language,
                              self.practice.mode, step=self.practice.index,
                              independent_corrections=self._independent_corrections)
        clock = self.practice.status()
        policy += "\nMeasured state: " + json.dumps({
            key: clock[key] for key in ("step", "remaining_seconds", "running", "started", "finished")
        }) + ". Expiry alone is not completion."
        if self.practice.focus:
            policy += "\nConfirmed topic and oral goal: " + self.practice.focus
        # Account for schema size and the completion allowance before choosing history.
        from livekit.agents import llm
        schema_cost = request_tokens(llm.ChatContext.empty(), tools)
        budget = self.model_policy.max_request - self.model_policy.max_output - schema_cost
        try:
            context = compact_context(chat_ctx, policy, self._learning_memory(), budget,
                                      history_turns=(getattr(settings, f"{self.model_policy.provider.upper()}_HISTORY_TURNS")
                                                     if self.model_policy.provider != "groq" else 3))
        except ValueError:
            await self._quota_notice("input_too_long")
            yield quota_message(self.practice.language, "input_too_long")
            return
        cost = request_tokens(context, tools) + self.model_policy.max_output
        request_started = time.monotonic()
        log_fields = {"request_id": uuid.uuid4().hex, "provider": self.model_policy.provider,
                      "model": self.model_policy.model, "estimated_tokens": cost}
        logger.info("llm.request.started", extra=log_fields)
        tool_choice = model_settings.tool_choice if model_settings else NOT_GIVEN
        guarded = bool(tools) and tool_choice != "none"
        for attempt in range(2):
            wait_started = time.monotonic()
            while True:
                reservation, wait, reason = await asyncio.to_thread(self.quota.reserve, cost)
                if reservation:
                    break
                logger.info("llm.quota.wait", extra={**log_fields, "reason": reason,
                            "wait_seconds": round(wait, 2), "attempt": attempt + 1})
                if reason in {"daily", "oversized"} or time.monotonic() - wait_started + wait > self.model_policy.max_wait:
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
            delivered_response = False
            usage = None
            delivery = AudioDeliveryGate(guarded=guarded)
            first_response_ms = None
            first_delivery_ms = None
            try:
                # Both SDK and LiveKit retries are disabled: this is the only retry owner.
                async with self.session.llm.chat(
                    chat_ctx=context, tools=tools,
                    tool_choice=tool_choice,
                    conn_options=APIConnectOptions(max_retry=0, timeout=30),
                ) as stream:
                    async for chunk in stream:
                        if chunk.usage:
                            usage = chunk.usage
                        emitted = emitted or chunk.has_response()
                        if first_response_ms is None and chunk.has_response():
                            first_response_ms = round((time.monotonic() - request_started) * 1000)
                        for safe_chunk in delivery.push(chunk):
                            delivered_response = delivered_response or safe_chunk.has_response()
                            if first_delivery_ms is None and safe_chunk.has_response():
                                first_delivery_ms = round((time.monotonic() - request_started) * 1000)
                            yield safe_chunk
                for chunk in delivery.finish():
                    delivered_response = delivered_response or chunk.has_response()
                    if first_delivery_ms is None and chunk.has_response():
                        first_delivery_ms = round((time.monotonic() - request_started) * 1000)
                    yield chunk
                if usage:
                    actual = max(0, usage.prompt_tokens - usage.prompt_cached_tokens) + usage.completion_tokens
                    await asyncio.to_thread(self.quota.settle, reservation, actual)
                    self.practice.quota_status.update({"last_input_tokens": usage.prompt_tokens,
                                                      "last_output_tokens": usage.completion_tokens})
                    await self.practice.publish()
                logger.info("llm.request.completed", extra={**log_fields,
                            "duration_ms": round((time.monotonic() - request_started) * 1000),
                            "first_response_ms": first_response_ms,
                            "first_delivery_ms": first_delivery_ms,
                            "narration_guarded": guarded,
                            "input_tokens": usage.prompt_tokens if usage else None,
                            "output_tokens": usage.completion_tokens if usage else None})
                return
            except APIStatusError as exc:
                logger.warning("llm.request.failed", extra={**log_fields,
                    "status_code": exc.status_code, "error_type": type(exc).__name__,
                    "error_category": "empty_response" if "no response generated" in str(exc) else "provider_status",
                    "attempt": attempt + 1, "partial_response": emitted,
                    "duration_ms": round((time.monotonic() - request_started) * 1000)})
                if exc.status_code == 429 and not emitted:
                    await asyncio.to_thread(self.quota.settle, reservation, 0)
                    delay = retry_delay(exc)
                    logger.warning("llm.request.retry", extra={**log_fields, "wait_seconds": delay})
                    await asyncio.to_thread(self.quota.cooldown, delay)
                    if attempt == 0:
                        continue
                await self._quota_notice("limited", reason=str(exc.status_code))
                if exc.status_code == 429 and self.practice.since is not None:
                    await self.practice.practice_control("pause")
                    self._quota_paused = True
                logger.warning("%s request failed (status %s)", self.model_policy.provider, exc.status_code)
                for chunk in delivery.finish(complete=False):
                    delivered_response = delivered_response or chunk.has_response()
                    yield chunk
                if not delivered_response:
                    yield quota_message(self.practice.language, "error")
                return
            except APIError as exc:
                logger.warning("llm.connection.failed", extra={**log_fields,
                    "error_type": type(exc).__name__,
                    "duration_ms": round((time.monotonic() - request_started) * 1000)})
                await self._quota_notice("limited", reason="connection")
                for chunk in delivery.finish(complete=False):
                    delivered_response = delivered_response or chunk.has_response()
                    yield chunk
                if not delivered_response:
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


async def _resolve_photo_session(learner_id: str | None, voice: str = "boy") -> tuple[personas.Persona, bytes] | None:
    """
    Everything the photo avatar needs, gathered up front, or None to fall back to a character.

    Runs before the AgentSession is built because the persona decides the TTS voice, and the
    voice cannot change once the session exists. The learner chooses the voice;
    no vision model is called to infer personal attributes from the picture.
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

    persona = personas.BY_CHARACTER.get(voice, personas.DEFAULT)
    logger.info("photo avatar: user-selected voice %s", persona.name)
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
    configure_logging()
    token = bind_log_context(room=ctx.room.name, session_id=uuid.uuid4().hex)
    logger.info("session.started")
    try:
        await _run_session(ctx)
    except Exception:
        logger.exception("session.failed")
        raise
    finally:
        logger.info("session.entrypoint.finished")
        reset_log_context(token)


async def _run_session(ctx: JobContext) -> None:
    """LiveKit job entrypoint — called once per room session."""
    logger.info("English Tutor agent starting for room: %s", ctx.room.name)

    await ctx.connect()

    # Who is on the other end? The frontend puts the learner's id in the participant identity
    # and the avatar choice in the attributes when it mints the room token. We must ask before
    # starting the session: the collector has to be listening before the first word is spoken,
    # and the avatar choice decides the TTS voice, which is fixed at session construction.
    participant = await ctx.wait_for_participant()
    learner_id = _learner_id_from(participant.identity)
    if (learner_id and participant.attributes.get("practice_mode") == "fluency"
            and participant.attributes.get("practice_capture") in {"time-shifting", "agility"}):
        from agent.drill_call import run_drill_call
        await run_drill_call(ctx, participant, settings, _load_vad())
        return
    avatar_mode = participant.attributes.get(AVATAR_MODE_ATTRIBUTE, "")
    language = participant.attributes.get("native_language", "es")
    if language not in LANGUAGES:
        language = "es"
    mode = participant.attributes.get("practice_mode", "daily")
    if mode not in {"daily", "diagnostic", "fluency", "vocabulary"}:
        mode = "daily"
    practice = Practice(learner_id, ctx.room, settings.PROGRESS_DATABASE_URL, mode, language)
    control_tasks: set[asyncio.Task] = set()
    control_times: list[float] = []
    def receive_control(packet):
        if (packet.topic != "practice-control" or packet.participant is None
                or packet.participant.identity != participant.identity):
            return
        now = time.monotonic()
        control_times[:] = [stamp for stamp in control_times if stamp > now - 60]
        if len(control_times) >= 20:
            return
        control_times.append(now)
        task = asyncio.create_task(practice.manual_control(packet.data))
        control_tasks.add(task)
        def control_done(done):
            control_tasks.discard(done)
            if not done.cancelled() and done.exception() is not None:
                logger.warning("practice.control.failed", extra={"error_type": type(done.exception()).__name__})
        task.add_done_callback(control_done)
    ctx.room.on("data_received", receive_control)
    start_step = participant.attributes.get("practice_start_step", "0")
    if mode == "fluency" and start_step in {"0", "4", "5", "9", "15"}:
        # Explicit block selection never fabricates completed clock steps.
        practice.index = int(start_step)
    history = await practice.history()

    # Reliable data messages are not retained for clients that subscribe later.
    # Re-send state so the panel recovers after mounting or reconnecting.
    async def _sync_practice() -> None:
        while True:
            await practice.publish()
            await asyncio.sleep(5)

    practice_sync = asyncio.create_task(_sync_practice())

    async def _close_practice() -> None:
        ctx.room.off("data_received", receive_control)
        if control_tasks:
            await asyncio.gather(*control_tasks, return_exceptions=True)
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
        resolved = await _resolve_photo_session(learner_id, participant.attributes.get("photo_voice", "boy"))
        if resolved is not None:
            persona, photo = resolved
        else:
            persona = personas.DEFAULT
    else:
        persona = personas.BY_CHARACTER.get(avatar_mode, personas.DEFAULT)

    session = AgentSession(
        stt=groq.STT(model=settings.STT_MODEL, language="en", detect_language=False),
        llm=create_llm(settings),
        tts=EdgeTTS(voice="en-US-AndrewMultilingualNeural" if persona.name == "Ahmad" else "en-US-AvaMultilingualNeural"),
        vad=_load_vad(),
        turn_handling=_turn_handling_options(),
        # Groq's llama-3.3-70b-versatile occasionally leaks a tool call into the
        # reply text as literal `<function=...>...</function>` syntax instead of
        # the structured tool_calls field. See agent/text_filters.py.
        tts_text_transforms=[strip_tool_call_leakage],
    )
    attach_latency_logging(session)

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
                # Legacy parameter name retained for compatibility; key belongs
                # to the explicitly selected grading provider.
                groq_api_key=grading_config(settings)[0],
                grading_model=grading_config(settings)[1],
                grading_provider=settings.GRADING_PROVIDER,
                known_corrections=[entry for entry in practice.entries if entry.get("kind") == "correction"],
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
