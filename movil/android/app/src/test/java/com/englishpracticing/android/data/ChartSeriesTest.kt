package com.englishpracticing.android.data

import org.junit.Assert.*
import org.junit.Test

class ChartSeriesTest {
    @Test fun missingValuesSplitTheTrendAndDoNotBecomeZeros() {
        assertEquals(listOf(listOf(0 to 2.0), listOf(2 to 0.0, 3 to 4.0)), measuredSegments(listOf(2.0, null, 0.0, 4.0)))
    }
    @Test fun unknownAndNonFiniteSeriesNeverProduceAPoint() {
        assertTrue(measuredSegments(listOf(null, Double.NaN, Double.POSITIVE_INFINITY)).isEmpty())
    }
    @Test fun validZeroAndSinglePointSeriesRemainVisible() {
        assertEquals(listOf(listOf(0 to 0.0)), measuredSegments(listOf(0.0)))
    }
}
