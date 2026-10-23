"""Real SDK decoding with locally generated MP3; no Microsoft/API requests."""
import asyncio
from array import array
from fractions import Fraction
import io
import math
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import av
from livekit.agents import APIConnectionError
from livekit.agents.types import APIConnectOptions
from plugins.edge_tts import EdgeTTS, EdgeTTSStream


def local_mp3():
    data = io.BytesIO()
    with av.open(data, mode="w", format="mp3") as container:
        stream = container.add_stream("mp3", rate=24000)
        stream.layout = "mono"
        stream.bit_rate = 48000
        for index in range(75):
            frame = av.AudioFrame(format="s16p", layout="mono", samples=1152)
            frame.sample_rate = 24000
            frame.pts = index * 1152
            frame.time_base = Fraction(1, 24000)
            frame.planes[0].update(array("h", (
                int(6000 * math.sin(2 * math.pi * 440 * (frame.pts + sample) / 24000))
                for sample in range(1152))).tobytes())
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    return data.getvalue()


class EdgeTTSTests(unittest.IsolatedAsyncioTestCase):
    async def test_audio_is_decoded_before_upstream_finishes_with_packed_pcm_and_tail(self):
        mp3 = local_mp3()
        release = asyncio.Event()
        upstream_finished = False
        upstream_closed = asyncio.Event()

        async def network_stream():
            nonlocal upstream_finished
            try:
                # Deliberately split across MP3 packet/header boundaries.
                split = len(mp3) // 2
                for offset in range(0, split, 317):
                    yield {"type": "audio", "data": mp3[offset:min(offset + 317, split)]}
                    await asyncio.sleep(0)
                await release.wait()
                yield {"type": "WordBoundary", "text": "ignored"}
                for offset in range(split, len(mp3), 511):
                    yield {"type": "audio", "data": mp3[offset:offset + 511]}
                    await asyncio.sleep(0)
                upstream_finished = True
            finally:
                upstream_closed.set()

        with patch("plugins.edge_tts.edge_tts.Communicate", return_value=SimpleNamespace(stream=network_stream)) as communicate:
            tts = EdgeTTS(voice="test-voice")
            async with tts.synthesize("private text", conn_options=APIConnectOptions(max_retry=0)) as stream:
                first = await asyncio.wait_for(anext(stream), timeout=5)
                self.assertFalse(upstream_finished, "Must not wait for the complete MP3")
                release.set()

                async def rest():
                    return [event async for event in stream]

                events = [first, *await asyncio.wait_for(rest(), timeout=5)]
            self.assertTrue(upstream_finished)
            self.assertTrue(upstream_closed.is_set())
            self.assertTrue(events[-1].is_final)
            self.assertTrue(all(e.frame.sample_rate == 24000 and e.frame.num_channels == 1 for e in events))
            self.assertTrue(all(e.frame.data.nbytes == e.frame.samples_per_channel * 2 for e in events))
            # No missing tail, doubled samples or allocation-padding crackles.
            duration = sum(e.frame.duration for e in events)
            self.assertAlmostEqual(duration, 75 * 1152 / 24000, delta=0.15)
            communicate.assert_called_once_with("private text", "test-voice")

    async def test_failure_after_first_chunk_cannot_retry_or_log_text(self):
        async def network_stream():
            yield {"type": "audio", "data": b"first MP3 bytes"}
            raise RuntimeError("private provider body")

        output = Mock()
        stream = SimpleNamespace(_tts=SimpleNamespace(sample_rate=24000),
                                 _input_text="private learner text", _voice="test")
        with patch("plugins.edge_tts.edge_tts.Communicate", return_value=SimpleNamespace(stream=network_stream)):
            with self.assertLogs("plugins.edge_tts", "INFO") as logs:
                with self.assertRaises(APIConnectionError) as failure:
                    await EdgeTTSStream._run(stream, output)
        self.assertFalse(failure.exception.retryable)
        self.assertEqual(output.initialize.call_args.kwargs["mime_type"], "audio/mpeg")
        output.push.assert_called_once_with(b"first MP3 bytes")
        self.assertNotIn("private", str(logs.output))
        self.assertNotIn("private", str(failure.exception))

    async def test_cancel_after_audio_closes_upstream_and_decoder(self):
        mp3 = local_mp3()
        closed = asyncio.Event()

        async def network_stream():
            try:
                yield {"type": "audio", "data": mp3[:len(mp3) // 2]}
                await asyncio.Event().wait()
            finally:
                closed.set()

        with patch("plugins.edge_tts.edge_tts.Communicate", return_value=SimpleNamespace(stream=network_stream)):
            stream = EdgeTTS().synthesize("test", conn_options=APIConnectOptions(max_retry=0))
            try:
                await asyncio.wait_for(anext(stream), timeout=5)
            finally:
                await asyncio.wait_for(stream.aclose(), timeout=5)
            self.assertTrue(closed.is_set())

    async def test_failure_before_audio_can_retry_and_cancellation_propagates(self):
        async def failed_stream():
            raise RuntimeError("private provider body")
            yield

        async def cancelled_stream():
            raise asyncio.CancelledError()
            yield

        stream = SimpleNamespace(_tts=SimpleNamespace(sample_rate=24000),
                                 _input_text="private", _voice="test")
        with patch("plugins.edge_tts.edge_tts.Communicate", return_value=SimpleNamespace(stream=failed_stream)):
            with self.assertRaises(APIConnectionError) as failure:
                await EdgeTTSStream._run(stream, Mock())
        self.assertTrue(failure.exception.retryable)
        with patch("plugins.edge_tts.edge_tts.Communicate", return_value=SimpleNamespace(stream=cancelled_stream)):
            with self.assertRaises(asyncio.CancelledError):
                await EdgeTTSStream._run(stream, Mock())

    async def test_empty_audio_is_an_explicit_failure(self):
        async def empty_stream():
            yield {"type": "audio", "data": b""}

        stream = SimpleNamespace(_tts=SimpleNamespace(sample_rate=24000),
                                 _input_text="private", _voice="test")
        with patch("plugins.edge_tts.edge_tts.Communicate", return_value=SimpleNamespace(stream=empty_stream)):
            with self.assertRaises(APIConnectionError):
                await EdgeTTSStream._run(stream, Mock())
