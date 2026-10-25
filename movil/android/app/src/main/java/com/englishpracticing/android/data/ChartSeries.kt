package com.englishpracticing.android.data

/** Unknown measurements split the line instead of becoming zero or joining across gaps. */
fun measuredSegments(values: List<Double?>): List<List<Pair<Int, Double>>> {
    val segments = mutableListOf<List<Pair<Int, Double>>>()
    var current = mutableListOf<Pair<Int, Double>>()
    values.forEachIndexed { index, value ->
        if (value == null || !value.isFinite()) {
            if (current.isNotEmpty()) segments.add(current.toList())
            current = mutableListOf()
        } else current.add(index to value)
    }
    if (current.isNotEmpty()) segments.add(current.toList())
    return segments
}
