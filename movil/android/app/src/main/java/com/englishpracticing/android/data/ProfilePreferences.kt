package com.englishpracticing.android.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PracticePreferences(val nativeLanguage: String)
data class ProfilePreferencesState(
    val saved: PracticePreferences? = null,
    val selected: String? = null,
    val loading: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
    val savedNotice: Boolean = false,
)

class ProfilePreferences(private val scope: CoroutineScope, private val api: TutorApi = TutorApi()) {
    private val mutable = MutableStateFlow(ProfilePreferencesState())
    val state = mutable.asStateFlow()
    private var owner: String? = null
    private var request: Job? = null

    fun bindAccount(id: String?) {
        if (id == owner) return
        request?.cancel(); request = null
        owner = id
        mutable.value = ProfilePreferencesState()
    }
    fun select(language: String) {
        if (language !in listOf("es", "en") || state.value.saving || state.value.loading || state.value.saved == null) return
        mutable.update { it.copy(selected = language, savedNotice = false, error = null) }
    }
    fun load() {
        val id = owner ?: return
        if (state.value.saving || state.value.loading) return
        request?.cancel()
        mutable.update { it.copy(loading = true, error = null, savedNotice = false) }
        request = scope.launch {
            try {
                val result = api.preferences()
                if (owner == id) mutable.value = ProfilePreferencesState(saved = result, selected = result.nativeLanguage)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { if (owner == id) mutable.update { it.copy(loading = false, error = message(error, false)) } }
        }
    }
    fun stopLoading() {
        if (state.value.loading) {
            request?.cancel(); request = null
            mutable.update { it.copy(loading = false) }
        }
    }
    fun save() {
        val id = owner ?: return
        val language = state.value.selected ?: return
        if (state.value.saved == null || state.value.loading || state.value.saving) return
        mutable.update { it.copy(saving = true, error = null, savedNotice = false) }
        request = scope.launch {
            try {
                val result = api.savePreferences(language)
                if (owner == id) mutable.value = ProfilePreferencesState(saved = result, selected = result.nativeLanguage, savedNotice = true)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { if (owner == id) mutable.update { it.copy(saving = false, error = message(error, true)) } }
        }
    }
    private fun message(error: Exception, saving: Boolean): String = when {
        error is ApiFailure && error.status == 401 -> "Tu sesión no se pudo validar. Vuelve a iniciar sesión."
        error is ApiFailure && error.status == 503 -> "El perfil no está disponible en el servidor. Reintenta cuando esté listo."
        saving -> "No pudimos confirmar el guardado. Tu selección sigue aquí; comprueba la conexión y vuelve a intentarlo."
        else -> "No pudimos cargar tus preferencias. Comprueba Internet y que la VM esté encendida."
    }
}
