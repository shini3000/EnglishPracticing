"""Listening-only LiveKit call for the time-shifting workspace.

No conversational LLM, TTS, turn detector service or end-of-call grading.
The existing authenticated web endpoint performs one explicit written review.
"""
import asyncio
import json
import logging
import time

from livekit import rtc
from livekit.agents import Agent, AgentSession, TurnHandlingOptions
from livekit.plugins import groq

logger = logging.getLogger(__name__)


class DrillCapture:
    def __init__(self, session, identity):
        self.session = session
        self.identity = identity
        self.capture_id = ""
        self.text = ""
        self.active = False
        self.finished = False
        self.overflow = False
        self.error = False
        self.lock = asyncio.Lock()
        self.calls = []

    def transcribed(self, event):
        if self.active and event.is_final and event.transcript.strip():
            self._set_text(" ".join(filter(None, [self.text, event.transcript.strip()])))

    def _set_text(self, text):
        # Leave headroom below LiveKit's RPC response limit, including UTF-8.
        self.overflow = self.overflow or len(text.encode("utf-8")) > 8000
        self.text = text.encode("utf-8")[:8000].decode("utf-8", errors="ignore")

    def snapshot(self):
        while True:
            encoded = json.dumps(dict(captureId=self.capture_id, text=self.text,
                                      finished=self.finished, overflow=self.overflow,
                                      error=self.error), ensure_ascii=False)
            if len(encoded.encode("utf-8")) <= 14000:
                return encoded
            self.text = self.text[:len(self.text) // 2]
            self.overflow = True

    async def control(self, data):
        if data.caller_identity != self.identity:
            raise rtc.RpcError(1401, "Unauthorized caller")
        now = time.monotonic()
        self.calls[:] = [stamp for stamp in self.calls if stamp > now - 60]
        if len(self.calls) >= 180:
            raise rtc.RpcError(1429, "Too many controls")
        self.calls.append(now)
        try:
            payload = json.loads(data.payload)
            action, capture_id = payload["action"], payload["captureId"]
            if not isinstance(capture_id, str) or not 1 <= len(capture_id) <= 64:
                raise ValueError()
        except (ValueError, KeyError, TypeError):
            raise rtc.RpcError(1400, "Invalid capture control")
        if action == "status":
            if capture_id != self.capture_id:
                raise rtc.RpcError(1409, "Stale capture")
            return self.snapshot()
        async with self.lock:
            if action == "start":
                if capture_id == self.capture_id:
                    return self.snapshot()  # retry must not erase accumulated speech
                if self.active:
                    raise rtc.RpcError(1409, "Finish the current capture first")
                self.session.clear_user_turn()
                self.capture_id, self.text = capture_id, ""
                self.active, self.finished = True, False
                self.overflow, self.error = False, False
                self.session.input.set_audio_enabled(True)
                logger.info("drill.capture.started")
            elif action == "finish" and capture_id == self.capture_id:
                if not self.finished:
                    # Muting the browser first stops new audio. Commit flushes trailing
                    # speech and waits for STT before the caller can request a review.
                    self.session.input.set_audio_enabled(False)
                    transcript = await self.session.commit_user_turn(
                        transcript_timeout=12, stt_flush_duration=1, skip_reply=True)
                    self._set_text(transcript.strip() or self.text)
                    self.active, self.finished = False, True
                    self.session.input.set_audio_enabled(False)
                    logger.info("drill.capture.finished", extra={"characters": len(self.text),
                                                               "overflow": self.overflow,
                                                               "transcription_error": self.error})
            else:
                raise rtc.RpcError(1400, "Unknown or stale capture control")
            return self.snapshot()


async def run_drill_call(ctx, participant, settings, vad):
    session = AgentSession(
        stt=groq.STT(model=settings.STT_MODEL, language="en", detect_language=False),
        vad=vad,
        turn_handling=TurnHandlingOptions(turn_detection="manual"),
    )
    capture = DrillCapture(session, participant.identity)
    session.on("user_input_transcribed", capture.transcribed)

    @session.on("error")
    def on_error(event):
        # Never log learner speech or credentials; the UI must not silently
        # grade an incomplete transcript after a recognition failure.
        capture.error = True

    session.on("user_transcription_timeout", on_error)

    await session.start(room=ctx.room, agent=Agent(instructions="Transcribe only."))
    session.input.set_audio_enabled(False)
    ctx.room.local_participant.register_rpc_method("drill.control", capture.control)
    await ctx.room.local_participant.set_attributes({"drill_ready": "true"})
    logger.info("drill.listener.ready")
