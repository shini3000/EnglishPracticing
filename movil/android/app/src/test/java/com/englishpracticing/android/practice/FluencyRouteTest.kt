package com.englishpracticing.android.practice

import org.junit.Assert.*
import org.junit.Test

class FluencyRouteTest {
    @Test fun routeMatchesWebBlockDurationsAndSignedCallEntryPoints() {
        assertEquals(5, fluencyBlocks.size)
        assertEquals(420, fluencyBlocks[0].steps.sumOf { it.seconds })
        assertEquals(900, fluencyBlocks[2].steps.sumOf { it.seconds })
        assertEquals(900, fluencyBlocks[3].steps.sumOf { it.seconds })
        assertEquals(4, fluencyBlocks[1].startStep)
        assertEquals(15, fluencyBlocks[4].startStep)
        assertTrue(fluencyBlocks[2].steps.none { it.speaking })
        assertEquals(listOf(240, 180, 120), fluencyBlocks[3].steps.filter { it.speaking }.map { it.seconds })
    }
    @Test fun secondRoutineNeverGetsTheFirstRoutineAsReference() {
        assertEquals("first", referenceForReview(0, 1, "first"))
        assertEquals("first", referenceForReview(0, 2, "first"))
        assertEquals("", referenceForReview(0, 3, "first"))
        assertEquals("", referenceForReview(3, 1, "first"))
        assertEquals("first", referenceForReview(3, 3, "first"))
        assertEquals("first", referenceForReview(3, 5, "first"))
    }
    @Test fun clockDoesNotDriftAcrossBackgroundOrPauseAndNeverGoesNegative() {
        assertEquals(30, secondsLeft(30, null, 90000))
        assertEquals(1, secondsLeft(30, 30000, 29001))
        assertEquals(0, secondsLeft(30, 30000, 30000))
        assertEquals(0, secondsLeft(30, 30000, 90000))
    }
}
