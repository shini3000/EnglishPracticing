package com.englishpracticing.android.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONObject

data class ProgressState(val data: JSONObject? = null, val loading: Boolean = false, val window: String = "all", val error: String? = null)

class ProgressManager(private val scope: CoroutineScope, private val api: TutorApi = TutorApi()) {
    private val mutable = MutableStateFlow(ProgressState())
    val state = mutable.asStateFlow()
    private var owner: String? = null
    private var job: Job? = null
    private var generation = 0
    fun bindAccount(id: String?) {
        if (owner == id) return
        generation++; job?.cancel(); job = null; owner = id
        mutable.value = ProgressState()
    }
    fun load(window: String = state.value.window) {
        val account = owner ?: return
        if (window !in listOf("all", "last-5", "last-10", "week", "month")) return
        job?.cancel()
        val attempt = ++generation
        mutable.update { it.copy(loading = true, window = window, error = null) }
        job = scope.launch {
            try {
                val result = api.progress(window)
                require(result.has("statistics") && result.has("learning") && result.has("activity"))
                if (owner == account && generation == attempt) mutable.value = ProgressState(data = result, window = window)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                if (owner == account && generation == attempt) mutable.update { it.copy(loading = false, error = when {
                    error is ApiFailure && error.status == 401 -> "Tu sesión no se pudo validar. Vuelve a iniciar sesión."
                    error is ApiFailure && error.status == 404 -> "El servidor necesita la versión con estadísticas Android. No se pudieron cargar los datos."
                    else -> "No pudimos cargar tu progreso. Comprueba la conexión y que el servidor esté encendido."
                }) }
            }
        }
    }
    fun stop() {
        generation++; job?.cancel(); job = null
        mutable.update { it.copy(loading = false) }
    }
}
