package com.englishpracticing.android.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.englishpracticing.android.EnglishPracticingApplication
import com.englishpracticing.android.call.CallService
import kotlinx.coroutines.launch

class PracticeViewModel(application: Application) : AndroidViewModel(application) {
    val calls = (application as EnglishPracticingApplication).calls
    val drills = com.englishpracticing.android.practice.DrillManager(application)
    val preferences = com.englishpracticing.android.data.ProfilePreferences(viewModelScope)
    private var accountId: String? = null
    fun bindAccount(id: String?) {
        calls.bindAccount(id)
        preferences.bindAccount(id)
        if (accountId != id) { drills.reset(); accountId = id }
    }
    override fun onCleared() { drills.reset(); super.onCleared() }
    fun start(mode: String, startStep: Int = 0) {
        if (Clerk.user == null) return
        try { CallService.start(getApplication(), mode, startStep) }
        catch (_: Exception) { calls.reportError("No se pudo iniciar la llamada. Mantén la app abierta y vuelve a intentarlo.") }
    }
    fun signOut() {
        calls.clear()
        drills.reset()
        preferences.bindAccount(null)
        viewModelScope.launch {
            if (Clerk.auth.signOut() is ClerkResult.Failure) {
                calls.reportError("No se pudo cerrar sesión. Comprueba tu conexión y vuelve a intentarlo.")
            }
        }
    }
}
