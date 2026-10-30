package com.englishpracticing.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun VocabularyScreen(model: PracticeViewModel, userId: String, onBack: () -> Unit, onStart: () -> Unit) {
    val state by model.progress.state.collectAsStateWithLifecycle()
    LaunchedEffect(userId) { model.bindAccount(userId); model.progress.load("all") }
    DisposableEffect(userId) { onDispose { model.progress.stop() } }
    BackHandler(onBack = onBack)
    val learning = state.data?.optJSONObject("learning")
    val pending = learning?.objects("items")?.filter { it.text("item_type") == "vocabulary" && !it.optJSONObject("vocabulary_block").let { p -> p?.optBoolean("completed") ?: false } } ?: emptyList()
    LazyColumn(contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { TextButton(onClick = onBack) { Text("Volver") }; Text("Vocabulario en contexto", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold) }
        item { Text("El tutor explica una palabra y sus usos; después practicas tus palabras pendientes en distintos contextos.") }
        item { Text("Una práctica exitosa cuenta una vez al día. Un fallo o tres días completos sin usarla reinician la racha; al llegar a 10 deja de ser obligatoria.", style = MaterialTheme.typography.bodySmall) }
        if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error); TextButton(onClick = { model.progress.load("all") }) { Text("Reintentar") } } }
        if (learning != null && !learning.optBoolean("available")) item { Text("No se pudieron consultar las palabras guardadas.", color = MaterialTheme.colorScheme.error) }
        if (learning?.optBoolean("available") == true) {
            item { Text("Palabras pendientes (${pending.size})", style = MaterialTheme.typography.titleLarge) }
            if (pending.isEmpty()) item { Text("No tienes palabras pendientes. Puedes pedir al tutor que te enseñe una nueva.") }
            items(pending, key = { it.text("key") }) { word ->
                val progress = word.optJSONObject("vocabulary_block")
                OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
                    Text(word.text("label"), fontWeight = FontWeight.Bold)
                    Text("${progress?.optInt("streak") ?: 0} de 10 días exitosos")
                } }
            }
            item { Button(onClick = onStart, enabled = !state.loading && state.error == null, modifier = Modifier.fillMaxWidth()) { Text("Practicar con el tutor") } }
        }
    }
}
