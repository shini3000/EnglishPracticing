package com.englishpracticing.android.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.clerk.api.Clerk
import com.clerk.ui.auth.AuthMode
import com.clerk.ui.auth.AuthView
import com.clerk.ui.userprofile.UserProfileView
import com.clerk.ui.userprofile.custom.UserProfileCustomRow
import com.clerk.ui.userprofile.custom.UserProfileRowIcon
import com.englishpracticing.android.BuildConfig
import com.englishpracticing.android.R
import com.englishpracticing.android.call.CallPhase
import com.englishpracticing.android.call.CallState
import kotlinx.coroutines.delay

private enum class PracticeMode(val wire: String, val title: Int, val description: Int) {
    Fluency("fluency", R.string.practice_fluency, R.string.practice_fluency_description),
    Daily("daily", R.string.practice_daily, R.string.practice_daily_description),
    Diagnostic("diagnostic", R.string.practice_diagnostic, R.string.practice_diagnostic_description),
}

@Composable
fun EnglishPracticingApp(model: PracticeViewModel = viewModel()) {
    if (BuildConfig.CLERK_PUBLISHABLE_KEY.isBlank() || BuildConfig.API_BASE_URL.isBlank()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text("Esta versión todavía no tiene configurado el acceso. Instala una versión configurada de la app.")
        }
        return
    }
    val initialized by Clerk.isInitialized.collectAsStateWithLifecycle()
    val initializationError by Clerk.initializationError.collectAsStateWithLifecycle()
    val user by Clerk.userFlow.collectAsStateWithLifecycle()
    val call by model.calls.state.collectAsStateWithLifecycle()
    var showProfile by rememberSaveable { mutableStateOf(false) }
    var showAuth by rememberSaveable { mutableStateOf(false) }
    var registerAccount by rememberSaveable { mutableStateOf(false) }
    var slowInitialization by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(initialized) {
        if (!initialized) { delay(15_000); slowInitialization = true }
        else slowInitialization = false
    }
    LaunchedEffect(initialized, user?.id) {
        if (initialized) model.bindAccount(user?.id)
        if (user != null) showAuth = false
        else showProfile = false
    }
    if (!initialized) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (initializationError == null) CircularProgressIndicator()
                Text(if (initializationError != null || slowInitialization) "No pudimos preparar el acceso. Comprueba tu conexión e inténtalo otra vez." else "Preparando tu acceso…")
                if (initializationError != null) Button(onClick = { Clerk.reinitialize() }) { Text("Reintentar") }
            }
        }
        return
    }
    if (user == null && showAuth) {
        key(registerAccount) {
            AuthView(
                mode = if (registerAccount) AuthMode.SignUp else AuthMode.SignIn,
                isDismissible = true,
                onDismiss = { showAuth = false },
                preferGoogleOneTap = false,
                startSocialOAuthAsSignUp = registerAccount,
                persistIdentifiers = false,
            )
        }
        return
    }
    if (user != null && showProfile) {
        key(user!!.id) {
            UserProfileView(
                customRows = listOf(UserProfileCustomRow(routeKey = "preferences", title = "Preferencias",
                    icon = UserProfileRowIcon.Resource(R.drawable.ic_preferences))),
                customDestination = { route -> if (route == "preferences") ProfilePreferencesScreen(model, user!!.id) },
                onDismiss = { showProfile = false },
            )
        }
        return
    }
    val drill by model.drills.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showFluency by rememberSaveable { mutableStateOf(false) }
    var pendingStartStep by rememberSaveable { mutableStateOf(0) }
    var pendingMode by rememberSaveable { mutableStateOf<String?>(null) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        val mode = pendingMode
        pendingMode = null
        if (grants[Manifest.permission.RECORD_AUDIO] == true && mode != null) model.start(mode, pendingStartStep)
        else model.calls.reportError("Necesitamos acceso al micrófono para conversar. Puedes habilitarlo en los ajustes de la app.")
    }
    fun begin(mode: String, startStep: Int = 0) {
        pendingStartStep = startStep
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) model.start(mode, pendingStartStep)
        else {
            pendingMode = mode
            permission.launch(buildList {
                add(Manifest.permission.RECORD_AUDIO)
                if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            }.toTypedArray())
        }
    }
    var confirmEnd by rememberSaveable { mutableStateOf(false) }
    BackHandler(call.active) { confirmEnd = true }
    Scaffold(containerColor = MaterialTheme.colorScheme.background) { insets ->
        Column(Modifier.fillMaxSize().padding(insets)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.app_name), Modifier.weight(1f), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                if (user != null && !call.active) TextButton(onClick = { showProfile = true }, enabled = !drill.recording && !drill.busy) { Text("Mi perfil") }
            }
            if (call.active) CallScreen(call, model, onEnd = { confirmEnd = true }, onBlock = { block ->
                model.calls.end(); model.drills.select(block); showFluency = true
            })
            else if (showFluency && user != null) FluencyScreen(model.drills, onBack = { showFluency = false }, onTutor = { begin("fluency", it) })
            else {
                LazyColumn(contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    item {
                        Text(stringResource(R.string.home_title), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                        Text(if (user == null) "Entra con tu cuenta para practicar y conservar tu progreso." else "Elige cómo quieres practicar hoy.", Modifier.padding(top = 16.dp))
                        if (user == null) {
                            Button(onClick = { registerAccount = false; showAuth = true }, modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) {
                                Text("Iniciar sesión")
                            }
                            OutlinedButton(onClick = { registerAccount = true; showAuth = true }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                                Text("Crear cuenta")
                            }
                        }
                    }
                    call.error?.let { item { ErrorMessage(it) } }
                    items(PracticeMode.entries, key = { it.wire }) { mode ->
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            HorizontalDivider()
                            Text(stringResource(mode.title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text(stringResource(mode.description), color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Button(onClick = { if (user == null) { registerAccount = false; showAuth = true } else if (mode == PracticeMode.Fluency) { model.drills.selectMenu(); showFluency = true } else begin(mode.wire) }, enabled = pendingMode == null, modifier = Modifier.fillMaxWidth()) {
                                Text(if (user == null) "Entrar para practicar" else if (mode == PracticeMode.Fluency) "Ver los cinco bloques" else "Iniciar llamada")
                            }
                        }
                    }
                    item { Text("Para practicar, el servidor que configuraste debe estar encendido y conectado.", style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
    }
    if (confirmEnd) AlertDialog(
        onDismissRequest = { confirmEnd = false }, title = { Text("¿Finalizar la llamada?") },
        text = { Text("Se cerrará el micrófono y el tutor terminará esta sesión.") },
        confirmButton = { TextButton(onClick = { confirmEnd = false; model.calls.end() }) { Text("Finalizar") } },
        dismissButton = { TextButton(onClick = { confirmEnd = false }) { Text("Continuar") } },
    )
}

@Composable
private fun CallScreen(call: CallState, model: PracticeViewModel, onEnd: () -> Unit, onBlock: (Int) -> Unit) {
    var tab by rememberSaveable { mutableStateOf(0) }
    var evidence by rememberSaveable(call.practice?.index) { mutableStateOf("") }
    var now by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(call.practice?.running, call.practice?.receivedAt, tab) {
        now = SystemClock.elapsedRealtime()
        if (call.practice?.running == true && tab == 0) lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) { now = SystemClock.elapsedRealtime(); delay(1000) }
        }
    }
    val status = when (call.phase) {
        CallPhase.Connecting -> "Preparando la llamada…"
        CallPhase.Reconnecting -> "Recuperando la conexión…"
        else -> if (call.tutorReady) "Tutor conectado" else "Esperando al tutor…"
    }
    Column(Modifier.fillMaxSize()) {
        Text(status, Modifier.padding(horizontal = 24.dp, vertical = 8.dp), style = MaterialTheme.typography.titleMedium)
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = model.calls::toggleMicrophone, enabled = call.phase == CallPhase.Connected, modifier = Modifier.weight(1f)) { Text(if (call.muted) "Activar micrófono" else "Silenciar") }
            Button(onClick = onEnd, modifier = Modifier.weight(1f)) { Text("Finalizar") }
        }
        TabRow(selectedTabIndex = tab) {
            listOf("Práctica", "Conversación", "Correcciones").forEachIndexed { index, title ->
                Tab(selected = tab == index, onClick = { tab = index }, text = { Text(title) })
            }
        }
        val listState = key(tab) { rememberLazyListState() }
        LaunchedEffect(tab, call.transcript.size) {
            if (tab == 1 && call.transcript.isNotEmpty() && !listState.isScrollInProgress) {
                listState.animateScrollToItem(call.transcript.lastIndex + if (call.error != null) 1 else 0)
            }
        }
        LazyColumn(state = listState, contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            call.error?.let { item { ErrorMessage(it) } }
            when (tab) {
                0 -> {
                    val practice = call.practice
                    if (practice == null) item { Text("Cuando se una el tutor, aparecerán aquí la actividad y su cronómetro.") }
                    else {
                        item {
                            if (call.mode == "fluency") Text("Bloque ${when (practice.index) { in 0..3 -> 1; 4 -> 2; in 5..8 -> 3; in 9..14 -> 4; else -> 5 }} de 5", color = MaterialTheme.colorScheme.primary)
                            Text(practice.step, style = MaterialTheme.typography.headlineSmall)
                            val seconds = practice.remaining(now)
                            Text("%02d:%02d".format(seconds / 60, seconds % 60), style = MaterialTheme.typography.displaySmall)
                        }
                        if (practice.feedback.isNotBlank()) item { Text(practice.feedback) }
                        if (call.mode == "fluency" && practice.index == 4) item {
                            OutlinedButton(onClick = { onBlock(2) }, enabled = practice.feedbackReady || practice.feedback.isNotBlank()) {
                                Text("Continuar al bloque 3 · Input y réplica")
                            }
                            if (!practice.feedbackReady && practice.feedback.isBlank()) Text("Al terminar el monólogo, espera la devolución escrita del tutor antes de continuar.", style = MaterialTheme.typography.bodySmall)
                        }
                        if (practice.finished) item { Text("Práctica terminada. Puedes finalizar la llamada.") }
                        else if (practice.independentBlock) item {
                            Text("Este bloque se practica sin conversación. Los ejercicios autónomos de esta parte de la ruta B todavía no están disponibles en Android.")
                            Text("Puedes finalizar la llamada; no se marcará el bloque como completado.", Modifier.padding(top = 12.dp))
                        } else {
                            item { OutlinedTextField(value = evidence, onValueChange = { evidence = it.take(600) }, label = { Text(if (!practice.started) "Tema y objetivo de práctica" else "¿Qué completaste en esta actividad?") }, modifier = Modifier.fillMaxWidth()) }
                            item {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Button(onClick = { model.calls.control(if (!practice.started) "start" else if (practice.running) "pause" else "resume", evidence) }, enabled = call.phase == CallPhase.Connected && (practice.started || evidence.isNotBlank())) {
                                        Text(if (!practice.started) "Comenzar" else if (practice.running) "Pausar" else "Continuar")
                                    }
                                    if (practice.started) OutlinedButton(onClick = { model.calls.control("next", evidence) }, enabled = evidence.isNotBlank() && call.phase == CallPhase.Connected) { Text("Siguiente") }
                                }
                            }
                        }
                    }
                }
                1 -> {
                    if (call.transcript.isEmpty()) item { Text("La transcripción aparecerá mientras conversas.") }
                    items(call.transcript, key = { it.id }) { line ->
                        Column {
                            Text(line.speaker, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                            Text(line.text, Modifier.padding(top = 4.dp))
                        }
                    }
                }
                2 -> {
                    if (call.corrections.isEmpty()) item { Text("Aquí verás las correcciones escritas que prepare el tutor.") }
                    items(call.corrections.asReversed(), key = { it.id }) { correction ->
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(correction.original, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(correction.corrected, fontWeight = FontWeight.Bold)
                            Text(correction.explanation)
                            if (correction.exercise.isNotBlank()) Text(correction.exercise)
                            if (!correction.saved) Text("Pendiente de confirmar guardado", style = MaterialTheme.typography.bodySmall)
                            HorizontalDivider()
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ErrorMessage(text: String) {
    Text(text, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
}
