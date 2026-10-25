package com.englishpracticing.android.call

import org.junit.Assert.*
import org.junit.Test

class CallStateTest {
    @Test fun partialAndFinalSegmentsDoNotDuplicateAndOldInterimCannotOverwriteFinal() {
        val partial = TranscriptLine("segment", "Tú", "I work", false)
        val final = partial.copy(text = "I worked yesterday.", final = true)
        val lines = mergeTranscript(mergeTranscript(emptyList(), partial), final)
        assertEquals(1, lines.size)
        assertEquals(final, lines.single())
        assertEquals(lines, mergeTranscript(lines, partial))
    }

    @Test fun longSessionsKeepBoundedTranscriptWithoutDiscardingRecentMessages() {
        var lines = emptyList<TranscriptLine>()
        repeat(200) { lines = mergeTranscript(lines, TranscriptLine("$it", "Tutor", "x".repeat(6000), true)) }
        assertEquals(80, lines.size)
        assertEquals("120", lines.first().id)
        assertEquals("199", lines.last().id)
        assertTrue(lines.all { it.text.length == 4000 })
    }

    @Test fun countdownUsesElapsedTimeAndClampsToZero() {
        val status = PracticeStatus("Practice", 0, 30, 1000L, true, true, false, "", false)
        assertEquals(25, status.remaining(6500L))
        assertEquals(0, status.remaining(100000L))
        assertEquals(30, status.copy(running = false).remaining(100000L))
        assertEquals(30, status.remaining(0L))
    }
}
