package com.englishpracticing.android.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.media.AudioManager
import android.media.ToneGenerator
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.englishpracticing.android.practice.DrillManager
import com.englishpracticing.android.practice.fluencyBlocks
import kotlinx.coroutines.delay

@Composable
fun FluencyScreen(manager: DrillManager, onBack: () -> Unit, onTutor: (Int) -> Unit) {
    val state by manager.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var confirmExit by remember { mutableStateOf(false) }
    var permissionError by remember { mutableStateOf(false) }
    var showSteps by rememberSaveable(state.block) { mutableStateOf(false) }
    var materialUrl by rememberSaveable { mutableStateOf("") }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permissionError = !granted
        if (granted) manager.startRecording()
    }
    fun record() {
        permissionError = false
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) manager.startRecording()
        else permission.launch(Manifest.permission.RECORD_AUDIO)
    }
    fun back() {
        if (state.recording) confirmExit = true
        else if (!state.busy) { if (state.block >= 0) manager.selectMenu() else onBack() }
    }
    BackHandler { back() }
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) manager.background() }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer); manager.background() }
    }
    val tone = remember { runCatching { ToneGenerator(AudioManager.STREAM_NOTIFICATION, 55) }.getOrNull() }
    DisposableEffect(tone) { onDispose { tone?.release() } }
    var warned by rememberSaveable(state.block, state.step) { mutableStateOf(false) }
    var ended by rememberSaveable(state.block, state.step) { mutableStateOf(false) }
    LaunchedEffect(state.remaining, state.block, state.step) {
        if (state.block >= 0 && !state.finished && fluencyBlocks[state.block].steps.isNotEmpty()) {
            if (state.remaining == 10 && !warned) { warned = true; tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 120) }
            if (state.remaining == 0 && !ended) { ended = true; tone?.startTone(ToneGenerator.TONE_PROP_ACK, 350) }
            if (state.remaining > 10) { warned = false; ended = false }
        }
    }
    LaunchedEffect(state.deadline) {
        if (state.deadline != null) lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) { manager.clock(); delay(250) }
        }
    }
    val listState = rememberLazyListState()
    LaunchedEffect(state.block, state.step) { listState.scrollToItem(0) }
    LazyColumn(state = listState, contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = 12.dp, bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item {
            TextButton(onClick = { back() }, enabled = !state.busy) { Text(if (state.block < 0) "Volver al inicio" else "Volver a los bloques") }
            if (state.block < 0) {
                Text("Práctica B", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text("Cinco bloques para practicar a tu ritmo", Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("55 minutos en total", Modifier.padding(top = 6.dp), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            }
        }
        if (state.block < 0) {
            item { Text("Elige un bloque", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold) }
            fluencyBlocks.withIndex().toList().chunked(2).forEach { blockRow ->
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        blockRow.forEach { (index, block) ->
                            OutlinedCard(onClick = { manager.select(index) }, modifier = Modifier.weight(1f), colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                                Column(Modifier.fillMaxWidth().heightIn(min = 148.dp).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("Bloque ${index + 1}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                                    Text(block.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    Text(block.duration, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(if (index in state.completed) "Completado" else "Abrir bloque", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                        if (blockRow.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        } else {
            val block = fluencyBlocks[state.block]
            item {
                Text("Práctica B · Bloque ${state.block + 1} de 5", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                Text(block.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                if (block.startStep != null || state.finished) Text(block.description, Modifier.padding(top = 8.dp))
            }
            if (block.startStep != null) {
                item {
                    Text(if (state.block == 1) "Habla sobre un tema personal durante diez minutos. Usa anclajes como last year, recently o so far. Al terminar, espera las correcciones escritas antes de pasar al input."
                        else "Produce 60–90 segundos de habla espontánea. Identifica tus errores, practica las dos correcciones prioritarias y transfiérelas a un contexto nuevo con el tutor.")
                    Button(onClick = { onTutor(block.startStep) }, modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) { Text("Iniciar este bloque con el tutor") }
                }
            } else if (state.finished) {
                item {
                    Text("Terminaste los pasos de este bloque.", style = MaterialTheme.typography.titleLarge)
                    OutlinedButton(onClick = manager::restart) { Text("Repetir este bloque") }
                    if (state.block == 2) Text("Esta actividad es autoguiada: no se grabó ni evaluó el contenido que escuchaste.")
                    Button(onClick = { manager.select(state.block + 1) }, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) { Text("Continuar al bloque ${state.block + 2}") }
                }
            } else {
                val step = block.steps[state.step]
                item {
                    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Paso ${state.step + 1} de ${block.steps.size}", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                            LinearProgressIndicator(progress = { (state.step + 1).toFloat() / block.steps.size }, modifier = Modifier.fillMaxWidth())
                            Text(step.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text(step.instruction, style = MaterialTheme.typography.bodyLarge)
                            Text("%02d:%02d".format(state.remaining / 60, state.remaining % 60), style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                            if (state.remaining == 0) Text(if (state.recording) "Tiempo cumplido. Termina tu idea y pulsa Finalizar grabación." else "Tiempo cumplido. Continúa cuando estés listo.")
                        }
                    }
                }
                if (state.block == 0 || state.block == 3) item {
                    OutlinedTextField(value = state.routine, onValueChange = manager::routine, enabled = !state.recording && !state.busy && state.review == null && (state.block == 0 && state.step in listOf(0, 3) || state.block == 3 && state.step == 0),
                        label = { Text(if (state.block == 0) "Rutina de 3–4 acciones" else "Pregunta abierta o tema") }, modifier = Modifier.fillMaxWidth())
                }
                if (state.block == 2 && state.step == 0) item {
                    OutlinedTextField(value = materialUrl, onValueChange = { materialUrl = it.take(2000) }, label = { Text("Enlace HTTPS al video o podcast (opcional)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedButton(onClick = {
                        val uri = Uri.parse(materialUrl)
                        if (uri.scheme == "https" && !uri.host.isNullOrBlank()) runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    }, enabled = materialUrl.startsWith("https://")) { Text("Abrir material") }
                }
                if (permissionError) item { Text("Permite el micrófono para grabar o escribe tu respuesta.", color = MaterialTheme.colorScheme.error) }
                state.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
                if (step.speaking) {
                    item {
                        if (state.recording) Button(onClick = manager::stopRecording, modifier = Modifier.fillMaxWidth()) { Text("Finalizar grabación") }
                        else if (state.review == null) OutlinedButton(onClick = { record() }, enabled = state.routine.isNotBlank() && !state.busy, modifier = Modifier.fillMaxWidth()) {
                            Text(if (state.routine.isBlank()) {
                                if (state.block == 0) "Escribe tu rutina para grabar" else "Escribe tu tema para grabar"
                            } else if (state.audio == null) "Grabar respuesta" else "Volver a grabar")
                        }
                        Text("La grabación se cierra al ocultar la app. Se envía para transcribir y revisar solo al pulsar Revisar respuesta.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                        OutlinedTextField(value = state.text, onValueChange = manager::text, enabled = !state.recording && !state.busy && state.review == null,
                            label = { Text(if (state.audio != null && state.text.isBlank()) "Audio listo. Puedes revisarlo o escribir el texto." else "Respuesta en inglés (también puedes escribirla)") },
                            minLines = 3, modifier = Modifier.fillMaxWidth().padding(top = 12.dp))
                        if (!state.recording && state.review == null) Button(onClick = manager::review,
                            enabled = !state.busy && state.routine.isNotBlank() && (state.audio != null || state.text.isNotBlank()), modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                            Text(if (state.busy) "Revisando…" else "Revisar respuesta")
                        }
                    }
                    state.review?.let { result ->
                        item {
                            Text("Revisión escrita", style = MaterialTheme.typography.titleLarge)
                            Text(result.optString("feedback"), Modifier.padding(top = 8.dp))
                            Text(if (result.optBoolean("saved")) "Revisión guardada en tu historial." else "Guardado sin confirmar.", style = MaterialTheme.typography.bodySmall)
                        }
                        val cards = result.optJSONArray("corrections")
                        items(cards?.length() ?: 0) { index ->
                            val card = cards!!.getJSONObject(index)
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(card.optString("original"), color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(card.optString("corrected"), fontWeight = FontWeight.Bold)
                                Text(card.optString("explanation")); Text(card.optString("pattern"), style = MaterialTheme.typography.bodySmall)
                                HorizontalDivider()
                            }
                        }
                    }
                } else item {
                    Button(onClick = manager::toggleClock, enabled = state.remaining > 0 && !state.busy && (state.block != 3 || state.routine.isNotBlank())) {
                        Text(if (state.deadline == null) "Comenzar / Continuar" else "Pausar")
                    }
                }
                item {
                    OutlinedButton(onClick = manager::next,
                        enabled = !state.recording && !state.busy && (!step.speaking || state.review != null) && (state.block != 3 || state.routine.isNotBlank()),
                        modifier = Modifier.fillMaxWidth()) { Text(if (state.step == block.steps.lastIndex) "Terminar bloque" else "Siguiente paso") }
                }
                item { TextButton(onClick = { showSteps = !showSteps }) { Text(if (showSteps) "Ocultar recorrido" else "Ver recorrido de este bloque") } }
                if (showSteps) itemsIndexed(block.steps) { index, routeStep ->
                    Text("${if (index < state.step) "Completado" else if (index == state.step) "Paso actual" else "Pendiente"}: ${routeStep.title}",
                        color = if (index == state.step) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
    if (confirmExit) AlertDialog(onDismissRequest = { confirmExit = false }, title = { Text("¿Cerrar la grabación?") },
        text = { Text("Se cerrará el micrófono antes de volver a los bloques.") },
        confirmButton = { TextButton(onClick = { manager.stopRecording(); manager.selectMenu(); confirmExit = false }) { Text("Cerrar y volver") } },
        dismissButton = { TextButton(onClick = { confirmExit = false }) { Text("Seguir grabando") } })
}
