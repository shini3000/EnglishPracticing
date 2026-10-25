package com.englishpracticing.android.practice

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.os.SystemClock
import com.englishpracticing.android.data.ApiFailure
import com.englishpracticing.android.data.TutorApi
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.json.JSONObject
import java.io.File

data class DrillState(
    val block: Int = -1, val step: Int = 0, val remaining: Int = 0, val deadline: Long? = null,
    val routine: String = "", val text: String = "", val recording: Boolean = false,
    val audio: File? = null, val busy: Boolean = false, val error: String? = null,
    val review: JSONObject? = null, val finished: Boolean = false,
    val completed: Set<Int> = emptySet(), val previous: String = "",
)

class DrillManager(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutable = MutableStateFlow(DrillState())
    val state = mutable.asStateFlow()
    private var recorder: MediaRecorder? = null
    private var request: Job? = null
    private val api = TutorApi()
    private val sessions = mutableMapOf<Int, DrillState>()

    fun select(block: Int) {
        if (state.value.recording || state.value.busy) return
        clock()
        if (state.value.block >= 0) sessions[state.value.block] = state.value
        mutable.value = (sessions[block] ?: DrillState(block = block,
            remaining = fluencyBlocks[block].steps.firstOrNull()?.seconds ?: 0)).copy(completed = state.value.completed)
    }
    fun selectMenu() {
        if (state.value.recording || state.value.busy) return
        clock()
        if (state.value.block >= 0) sessions[state.value.block] = state.value
        mutable.value = DrillState(completed = state.value.completed)
    }
    fun restart() {
        val block = state.value.block
        if (block < 0 || state.value.recording || state.value.busy) return
        state.value.audio?.delete()
        sessions.remove(block)
        mutable.value = DrillState(block = block, remaining = fluencyBlocks[block].steps.firstOrNull()?.seconds ?: 0,
            completed = state.value.completed - block)
    }
    fun routine(value: String) { mutable.update { it.copy(routine = value.take(500)) } }
    fun text(value: String) { mutable.update { it.copy(text = value.take(8000), review = null) } }
    fun clock() {
        val current = state.value
        val now = SystemClock.elapsedRealtime()
        val left = secondsLeft(current.remaining, current.deadline, now)
        mutable.update { it.copy(remaining = left, deadline = if (left == 0) null else it.deadline) }
    }
    fun toggleClock() {
        clock()
        mutable.update { it.copy(deadline = if (it.deadline != null || it.remaining == 0) null else SystemClock.elapsedRealtime() + it.remaining * 1000L) }
    }
    fun startRecording() {
        val current = state.value
        if (current.recording || current.busy || current.routine.isBlank()) return
        current.audio?.delete()
        val file = File.createTempFile("practice-", ".m4a", context.cacheDir)
        var device: MediaRecorder? = null
        try {
            @Suppress("DEPRECATION")
            val next = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else MediaRecorder()
            device = next
            next.setAudioSource(MediaRecorder.AudioSource.MIC)
            next.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            next.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            next.setAudioSamplingRate(16000)
            next.setAudioEncodingBitRate(64000)
            next.setOutputFile(file.absolutePath)
            next.setMaxFileSize(7_900_000)
            next.setOnInfoListener { _, what, _ -> if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED) stopRecording() }
            next.prepare()
            next.start()
            recorder = next
            val seconds = fluencyBlocks[current.block].steps[current.step].seconds
            mutable.update { it.copy(audio = file, recording = true, text = "", review = null, error = null,
                remaining = seconds, deadline = SystemClock.elapsedRealtime() + seconds * 1000L) }
        } catch (_: Exception) {
            runCatching { device?.release() }; file.delete()
            mutable.update { it.copy(audio = null, recording = false, error = "No se pudo abrir el micrófono. Revisa el permiso e inténtalo otra vez.") }
        }
    }
    fun stopRecording() {
        if (!state.value.recording) return
        clock()
        val device = recorder; recorder = null
        val success = runCatching { device?.stop() }.isSuccess
        runCatching { device?.release() }
        if (!success) state.value.audio?.delete()
        mutable.update { it.copy(recording = false, deadline = null, audio = if (success) it.audio else null,
            error = if (success) null else "La grabación fue demasiado corta. Puedes repetirla o escribir tu respuesta.") }
    }
    fun background() {
        // Exercises never keep recording when the app is hidden or the screen locks.
        if (state.value.recording) stopRecording()
    }
    fun review() {
        if (state.value.busy) return
        stopRecording()
        val current = state.value
        if (current.routine.isBlank() || (current.audio == null && current.text.isBlank())) return
        mutable.update { it.copy(busy = true, error = null) }
        request = scope.launch {
            try {
                val step = if (current.block == 3) listOf(1, 3, 5).indexOf(current.step) else current.step
                val result = api.review(if (current.block == 3) "agility" else "time-shifting", step,
                    current.routine, current.text, referenceForReview(current.block, current.step, current.previous), if (current.text.isBlank()) current.audio else null)
                mutable.update { it.copy(review = result, text = result.optString("text", current.text), busy = false) }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                val message = if (error is ApiFailure) when (error.status) {
                    401 -> "Tu sesión venció. Vuelve a iniciar sesión."
                    429 -> "Alcanzaste el límite de revisiones. Espera un minuto antes de reintentar."
                    503 -> "La revisión no está disponible. Conservamos tu respuesta para reintentar."
                    else -> "No se pudo revisar la respuesta. Conservamos tu audio y texto para reintentar."
                } else "No se pudo conectar. Comprueba Internet y que la VM esté encendida; tu respuesta sigue aquí."
                mutable.update { it.copy(busy = false, error = message) }
            }
        }
    }
    fun next() {
        val current = state.value
        if (current.recording || current.busy || current.finished) return
        val steps = fluencyBlocks[current.block].steps
        if (steps[current.step].speaking && current.review == null) return
        current.audio?.delete()
        if (current.step == steps.lastIndex) {
            mutable.update { it.copy(finished = true, audio = null, deadline = null, completed = it.completed + it.block) }
        } else {
            val next = current.step + 1
            val reference = if (current.step == 0 && current.block == 0 || current.step == 1 && current.block == 3) current.text else current.previous
            mutable.update { it.copy(step = next, remaining = steps[next].seconds, deadline = null, audio = null, text = "", review = null,
                previous = reference, routine = if (current.block == 0 && next == 3) "" else current.routine, error = null) }
        }
    }
    fun reset() {
        request?.cancel(); request = null
        stopRecording(); state.value.audio?.delete()
        sessions.values.forEach { it.audio?.delete() }; sessions.clear()
        mutable.value = DrillState()
    }
}
