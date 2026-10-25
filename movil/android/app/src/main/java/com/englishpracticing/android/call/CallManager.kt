package com.englishpracticing.android.call

import android.content.Context
import android.os.SystemClock
import com.englishpracticing.android.data.ApiFailure
import com.englishpracticing.android.data.TutorApi
import io.livekit.android.LiveKit
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import io.livekit.android.room.Room
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import java.util.UUID

class CallManager(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutableState = MutableStateFlow(CallState())
    val state = mutableState.asStateFlow()
    private var room: Room? = null
    private var connectionJob: Job? = null
    private var eventsJob: Job? = null
    private var waitingJob: Job? = null
    private var microphoneJob: Job? = null
    private var streamsJob: Job? = null
    private var onEnded: (() -> Unit)? = null
    private val api = TutorApi()
    private var accountId: String? = null

    fun bindAccount(id: String?) {
        if (accountId != id) {
            clear()
            accountId = id
        }
    }

    fun connect(mode: String, startStep: Int = 0, ended: () -> Unit) {
        if (state.value.active) return
        onEnded = ended
        mutableState.value = CallState(phase = CallPhase.Connecting, mode = mode)
        connectionJob = scope.launch {
            try {
                val connection = api.connection(mode, startStep)
                ensureActive()
                val activeRoom = LiveKit.create(context)
                room = activeRoom
                streamsJob = SupervisorJob(scope.coroutineContext[Job])
                val streamScope = CoroutineScope(scope.coroutineContext + requireNotNull(streamsJob))
                activeRoom.registerTextStreamHandler("lk.transcription") { receiver, identity ->
                    streamScope.launch {
                        val speaker = if (identity == activeRoom.localParticipant.identity) "Tú" else "Tutor"
                        val attributes = receiver.info.attributes
                        val segment = attributes["lk.segment_id"] ?: attributes["lk.transcription_segment_id"] ?: receiver.info.id
                        val id = "$speaker:$segment"
                        var text = ""
                        try {
                            receiver.flow.collect { chunk ->
                                text = (text + chunk).take(4000)
                                mutableState.update { it.copy(transcript = mergeTranscript(it.transcript, TranscriptLine(id, speaker, text, false))) }
                            }
                            mutableState.update { it.copy(transcript = mergeTranscript(it.transcript,
                                TranscriptLine(id, speaker, text, attributes["lk.transcription_final"] != "false"))) }
                        } catch (cancelled: CancellationException) { throw cancelled }
                        catch (_: Exception) { /* Keep partial text; never interrupt the audio. */ }
                    }
                }
                eventsJob = scope.launch { activeRoom.events.collect { event -> handleEvent(event) } }
                withTimeout(30_000) {
                    activeRoom.connect(connection.url, connection.token)
                    check(activeRoom.localParticipant.setMicrophoneEnabled(true))
                }
                mutableState.update { it.copy(phase = CallPhase.Connected) }
                waitingJob = scope.launch {
                    delay(40_000)
                    if (!state.value.tutorReady) end("El tutor no pudo unirse. Finaliza y vuelve a intentarlo.")
                }
                // History failure must not interrupt a healthy voice call.
                try { api.recentCorrections().forEach { correction(it, saved = true) } }
                catch (cancelled: CancellationException) { throw cancelled }
                catch (_: Exception) { /* Live corrections remain available. */ }
            } catch (cancelled: CancellationException) {
                if (state.value.active) end("La conexión se interrumpió. Puedes volver a intentarlo.")
                throw cancelled
            } catch (error: Exception) {
                end(when (error) {
                    is ApiFailure -> when (error.status) {
                        401 -> "Tu sesión no se pudo validar. Cierra sesión y vuelve a entrar."
                        403 -> "No se pudo autorizar esta llamada. Revisa el acceso de tu cuenta."
                        429 -> "Hay demasiadas solicitudes. Espera un momento e inténtalo otra vez."
                        else -> "El servidor no pudo preparar la llamada. Inténtalo más tarde."
                    }
                    is SecurityException -> "Activa el permiso del micrófono para hablar con el tutor."
                    else -> "No pudimos conectar. Comprueba Internet y que el servidor esté encendido."
                })
            }
        }
    }

    private fun handleEvent(event: RoomEvent) {
        when (event) {
            is RoomEvent.Reconnecting -> mutableState.update { it.copy(phase = CallPhase.Reconnecting) }
            is RoomEvent.Reconnected -> mutableState.update { it.copy(phase = CallPhase.Connected) }
            is RoomEvent.ParticipantConnected -> mutableState.update { it.copy(tutorReady = true) }
            is RoomEvent.ParticipantDisconnected -> {
                if (state.value.tutorReady) end("El tutor se desconectó. Puedes iniciar otra llamada.")
            }
            is RoomEvent.Disconnected -> end(if (event.error != null) "La llamada se desconectó. Comprueba tu conexión." else null)
            is RoomEvent.DataReceived -> {
                if (event.participant == null || event.data.size > 65_536) return
                try {
                    val data = JSONObject(String(event.data, Charsets.UTF_8))
                    when (event.topic) {
                        "practice" -> mutableState.update { it.copy(tutorReady = true, practice = PracticeStatus(
                            step = data.optString("step"), index = data.optInt("step_index"),
                            remainingSeconds = data.optInt("remaining_seconds").coerceAtLeast(0),
                            receivedAt = SystemClock.elapsedRealtime(), running = data.optBoolean("running"),
                            started = data.optBoolean("started"), finished = data.optBoolean("finished"),
                            feedback = data.optString("feedback_summary").take(4000),
                            feedbackReady = data.optBoolean("feedback_ready"),
                            independentBlock = state.value.mode == "fluency" && data.optInt("step_index") in 5..14,
                        )) }
                        "practice-journal" -> data.optJSONObject("entry")?.let { correction(it, data.optBoolean("saved")) }
                    }
                } catch (_: Exception) { /* Ignore malformed room packets. */ }
            }
            else -> Unit
        }
    }

    private fun correction(data: JSONObject, saved: Boolean) {
        if (data.optString("kind") != "correction") return
        val original = data.optString("learner_text").take(4000)
        val corrected = data.optString("corrected_text").take(4000)
        if (original.isBlank() || corrected.isBlank()) return
        val item = WrittenCorrection(
            id = data.optString("event_id").ifBlank { "$original|$corrected" }, original = original,
            corrected = corrected, explanation = data.optString("explanation").take(4000),
            exercise = data.optString("recovery_task").take(4000), saved = saved,
        )
        mutableState.update { it.copy(corrections = ((it.corrections.filterNot { old -> old.id == item.id }) + item).takeLast(50)) }
    }

    fun toggleMicrophone() {
        if (microphoneJob?.isActive == true || state.value.phase != CallPhase.Connected) return
        microphoneJob = scope.launch {
            try {
                val muted = !state.value.muted
                check(room?.localParticipant?.setMicrophoneEnabled(!muted) == true)
                mutableState.update { it.copy(muted = muted, error = null) }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { mutableState.update { it.copy(error = "No se pudo cambiar el micrófono.") } }
        }
    }

    fun control(action: String, evidence: String) {
        val practice = state.value.practice ?: return
        if (state.value.phase != CallPhase.Connected) return
        scope.launch {
            try {
                val payload = JSONObject().put("action", action).put("evidence", evidence.trim().take(600))
                    .put("step_index", practice.index).put("request_id", UUID.randomUUID().toString())
                room?.localParticipant?.publishData(payload.toString().toByteArray(), topic = "practice-control")
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { mutableState.update { it.copy(error = "No se pudo enviar el control. Vuelve a intentarlo.") } }
        }
    }

    fun reportError(message: String) { mutableState.update { it.copy(error = message) } }

    fun end(message: String? = null) {
        // Mark idle before cancelling jobs; cancellation and SDK callbacks are reentrant.
        val wasActive = state.value.active
        mutableState.update { it.copy(phase = CallPhase.Idle, muted = false, error = message, practice = null, tutorReady = false) }
        connectionJob?.cancel()
        connectionJob = null
        waitingJob?.cancel()
        eventsJob?.cancel()
        microphoneJob?.cancel()
        streamsJob?.cancel()
        val previousRoom = room
        room = null
        runCatching { previousRoom?.release() }
        if (wasActive) onEnded?.invoke()
        onEnded = null
    }

    fun clear() {
        end()
        mutableState.value = CallState()
    }
}
