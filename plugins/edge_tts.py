"""
Custom LiveKit TTS plugin backed by Microsoft Edge TTS (edge-tts).

Edge TTS is completely free and requires no API key. It uses Microsoft's
neural voices under the hood via the same service that powers Edge browser's
Read Aloud feature.

Pipeline:
  text -> edge_tts.Communicate -> MP3 chunks -> LiveKit's incremental decoder -> PCM
"""

import logging
import time
from typing import Optional

import uuid

import edge_tts
from livekit.agents import tts, APIConnectionError
from livekit.agents.types import APIConnectOptions

logger = logging.getLogger(__name__)

# Edge TTS outputs 24 kHz audio; we keep the same sample rate to avoid quality loss.
_SAMPLE_RATE = 24_000
_NUM_CHANNELS = 1


class EdgeTTS(tts.TTS):
    """LiveKit TTS adapter for Microsoft Edge TTS."""

    def __init__(self, *, voice: str = "en-US-JennyNeural") -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=_SAMPLE_RATE,
            num_channels=_NUM_CHANNELS,
        )
        self._voice = voice

    @property
    def model(self) -> str:
        return self._voice

    @property
    def provider(self) -> str:
        return "edge-tts"

    def synthesize(
        self,
        text: str,
        *,
        conn_options: Optional[APIConnectOptions] = None,
    ) -> "EdgeTTSStream":
        return EdgeTTSStream(
            tts=self,
            input_text=text,
            conn_options=conn_options or APIConnectOptions(),
            voice=self._voice,
        )


class EdgeTTSStream(tts.ChunkedStream):
    """Async stream that fetches and decodes one TTS response."""

    def __init__(
        self,
        *,
        tts: EdgeTTS,
        input_text: str,
        conn_options: APIConnectOptions,
        voice: str,
    ) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._voice = voice

    async def _run(self, output_emitter) -> None:
        request_id = str(uuid.uuid4())
        started = time.monotonic()
        output_emitter.initialize(
            request_id=request_id,
            sample_rate=self._tts.sample_rate,
            num_channels=_NUM_CHANNELS,
            mime_type="audio/mpeg",
            frame_size_ms=40,
        )
        received_audio = False
        try:
            communicate = edge_tts.Communicate(self._input_text, self._voice)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio" and chunk["data"]:
                    if not received_audio:
                        logger.info("tts.audio.first_byte", extra={
                            "request_id": request_id, "provider": "edge-tts",
                            "model": self._voice,
                            "duration_ms": round((time.monotonic() - started) * 1000),
                        })
                    received_audio = True
                    # AudioEmitter decodes in its worker thread and emits packed
                    # PCM frames progressively; never decode a partial MP3 as a
                    # separate file or send PyAV allocation padding as samples.
                    output_emitter.push(chunk["data"])
        except Exception as exc:
            logger.warning("tts.audio.failed", extra={
                "request_id": request_id, "provider": "edge-tts",
                "error_type": type(exc).__name__, "partial_audio": received_audio,
                "duration_ms": round((time.monotonic() - started) * 1000),
            })
            # Once audio has been submitted, a retry could repeat spoken words.
            # Do not put the provider exception body or learner text into logs.
            raise APIConnectionError("Edge TTS transport failed", retryable=not received_audio) from None
        if not received_audio:
            raise APIConnectionError("Edge TTS returned no audio")
