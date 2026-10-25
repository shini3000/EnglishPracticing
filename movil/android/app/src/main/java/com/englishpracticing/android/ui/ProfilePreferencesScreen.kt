package com.englishpracticing.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun ProfilePreferencesScreen(model: PracticeViewModel, userId: String) {
    val preferences = model.preferences
    val state by preferences.state.collectAsStateWithLifecycle()
    LaunchedEffect(userId) {
        model.bindAccount(userId)
        preferences.load()
    }
    DisposableEffect(preferences, userId) { onDispose { preferences.stopLoading() } }
    LazyColumn(contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item {
            Text("Preferencias de práctica", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Se guardan en tu cuenta y se comparten con la web y tus próximas prácticas.", Modifier.padding(top = 12.dp))
        }
        if (state.loading) item {
            CircularProgressIndicator()
            Text("Cargando tus preferencias…", Modifier.padding(top = 12.dp))
        }
        state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error) } }
        if (!state.loading && state.saved == null) item {
            Button(onClick = preferences::load) { Text("Reintentar") }
        }
        if (state.saved != null && !state.loading) {
            item {
                Text("Idioma nativo", style = MaterialTheme.typography.titleMedium)
                Text("Idioma para las explicaciones y correcciones del tutor. La interfaz de Android seguirá en español.", Modifier.padding(top = 8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 12.dp)) {
                    listOf("es" to "Español", "en" to "English").forEach { (value, label) ->
                        FilterChip(selected = state.selected == value, onClick = { preferences.select(value) }, enabled = !state.saving, label = { Text(label) })
                    }
                }
            }
            item {
                HorizontalDivider()
                Text("Idioma que practicas", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 20.dp))
                Text("English", Modifier.padding(top = 8.dp), fontWeight = FontWeight.Bold)
                Text("El inglés es el idioma de práctica de este proyecto.", Modifier.padding(top = 8.dp))
            }
            item {
                Button(onClick = preferences::save, enabled = !state.saving && state.selected != null, modifier = Modifier.fillMaxWidth()) {
                    Text(if (state.saving) "Guardando…" else "Guardar preferencias")
                }
                if (state.savedNotice) Text("Preferencias guardadas en tu cuenta.", Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
