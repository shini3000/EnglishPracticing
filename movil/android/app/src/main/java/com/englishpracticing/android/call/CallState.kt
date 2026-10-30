package com.englishpracticing.android.call

enum class CallPhase { Idle, Connecting, Connected, Reconnecting }

data class TranscriptLine(val id: String, val speaker: String, val text: String, val final: Boolean)
data class WrittenCorrection(
    val id: String,
    val original: String,
    val corrected: String,
    val explanation: String,
    val exercise: String,
    val saved: Boolean,
    val currentCall: Boolean = false,
    val roomName: String = "",
)

/** A late history response must neither downgrade nor evict current-call cards. */
fun mergeCorrections(existing: List<WrittenCorrection>, incoming: WrittenCorrection): List<WrittenCorrection> {
    fun same(a: WrittenCorrection): Boolean = a.id == incoming.id ||
        (a.roomName.isNotBlank() && a.roomName == incoming.roomName &&
            a.original.trim().equals(incoming.original.trim(), ignoreCase = true) &&
            a.corrected.trim().equals(incoming.corrected.trim(), ignoreCase = true))
    val previous = existing.find(::same)
    val merged = incoming.copy(currentCall = incoming.currentCall || previous?.currentCall == true, saved = incoming.saved || previous?.saved == true)
    val all = existing.filterNot(::same) + merged
    return (all.filterNot { it.currentCall } + all.filter { it.currentCall }).takeLast(50)
}

data class PracticeStatus(
    val step: String,
    val index: Int,
    val remainingSeconds: Int,
    val receivedAt: Long,
    val running: Boolean,
    val started: Boolean,
    val finished: Boolean,
    val feedback: String,
    val independentBlock: Boolean,
    val feedbackReady: Boolean = false,
) {
    fun remaining(now: Long): Int = (remainingSeconds -
        if (running) ((now - receivedAt).coerceAtLeast(0) / 1000).toInt() else 0).coerceAtLeast(0)
}

data class CallState(
    val phase: CallPhase = CallPhase.Idle,
    val mode: String = "fluency",
    val muted: Boolean = false,
    val tutorReady: Boolean = false,
    val error: String? = null,
    val practice: PracticeStatus? = null,
    val transcript: List<TranscriptLine> = emptyList(),
    val corrections: List<WrittenCorrection> = emptyList(),
) {
    val active: Boolean get() = phase != CallPhase.Idle
}

/** Replaces partial segments by id, bounds both DOM-equivalent work and retained text. */
fun mergeTranscript(lines: List<TranscriptLine>, incoming: TranscriptLine): List<TranscriptLine> {
    if (incoming.text.isBlank()) return lines
    val line = incoming.copy(text = incoming.text.take(4000))
    val existing = lines.indexOfFirst { it.id == line.id }
    if (existing >= 0) {
        if (lines[existing].final && !incoming.final) return lines
        return lines.toMutableList().also { it[existing] = line }
    }
    return (lines + line).takeLast(80)
}
