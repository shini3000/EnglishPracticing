package com.englishpracticing.android.call

import org.junit.Assert.*
import org.junit.Test

class CallStateTest {
    @Test fun equivalentCorrectionsWithinRoomAreCombinedButDifferentPracticesRemain() {
        val first = WrittenCorrection("one", "I go yesterday", "I went yesterday", "Past", "", false, true, "room-a")
        val repeated = first.copy(id = "two", original = "i go yesterday ", currentCall = false, saved = true)
        val merged = mergeCorrections(listOf(first), repeated)
        assertEquals(1, merged.size)
        assertTrue(merged.single().currentCall)
        assertTrue(merged.single().saved)
        assertEquals(2, mergeCorrections(merged, repeated.copy(id = "three", roomName = "room-b")).size)
    }
    @Test fun lateHistoryCannotRemoveCurrentCallHighlightOrEvictLiveCorrections() {
        val live = WrittenCorrection("live", "I go yesterday", "I went yesterday", "Past", "Try again", true, currentCall = true)
        var lines = mergeCorrections(emptyList(), live)
        lines = mergeCorrections(lines, live.copy(currentCall = false))
        assertEquals(1, lines.size)
        assertTrue(lines.single().currentCall)
        repeat(80) { lines = mergeCorrections(lines, live.copy(id = "old-$it", currentCall = false)) }
        assertEquals(50, lines.size)
        assertTrue(lines.single { it.id == "live" }.currentCall)
        assertEquals(49, lines.count { !it.currentCall })
    }

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
