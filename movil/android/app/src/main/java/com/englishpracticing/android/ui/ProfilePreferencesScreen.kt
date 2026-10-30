package com.englishpracticing.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.Manifest
import android.app.TimePickerDialog
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.englishpracticing.android.reminder.PracticeReminder

@Composable
fun ProfilePreferencesScreen(model: PracticeViewModel, userId: String) {
    val preferences = model.preferences
    val state by preferences.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var reminderEnabled by remember { mutableStateOf(PracticeReminder.enabled(context)) }
    var reminderHour by remember { mutableIntStateOf(PracticeReminder.hour(context)) }
    var reminderMinute by remember { mutableIntStateOf(PracticeReminder.minute(context)) }
    var reminderDays by remember { mutableIntStateOf(PracticeReminder.days(context)) }
    var permissionDenied by remember { mutableStateOf(false) }
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permissionDenied = !granted
        if (granted) { reminderEnabled = true; PracticeReminder.configure(context, true, reminderHour, reminderMinute) }
    }
    LaunchedEffect(userId) {
        model.bindAccount(userId)
        preferences.load()
    }
    DisposableEffect(preferences, userId) { onDispose { preferences.stopLoading() } }
    LazyColumn(contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item {
            Text("Preferencias de práctica", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("El idioma se guarda en tu cuenta; el recordatorio se configura en este teléfono.", Modifier.padding(top = 12.dp))
        }
        if (state.loading) item {
            CircularProgressIndicator()
            Text("Cargando tus preferencias…", Modifier.padding(top = 12.dp))
        }
        state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error) } }
        item {
            HorizontalDivider()
            Text("Recordatorio de práctica", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 20.dp))
            Text("Se guarda en este teléfono y puede llegar unos minutos después de la hora elegida.", Modifier.padding(top = 8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(if (reminderEnabled) "Activado" else "Desactivado")
                Switch(checked = reminderEnabled, onCheckedChange = { enable ->
                    if (enable && Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        reminderEnabled = enable; permissionDenied = false
                        PracticeReminder.configure(context, enable, reminderHour, reminderMinute)
                    }
                })
            }
            OutlinedButton(onClick = {
                TimePickerDialog(context, { _, hour, minute ->
                    reminderHour = hour; reminderMinute = minute
                    PracticeReminder.configure(context, reminderEnabled, hour, minute)
                }, reminderHour, reminderMinute, false).show()
            }) { Text("Hora: ${if (reminderHour % 12 == 0) 12 else reminderHour % 12}:${reminderMinute.toString().padStart(2, '0')} ${if (reminderHour < 12) "a. m." else "p. m."}") }
            Text("Días para practicar", style = MaterialTheme.typography.titleSmall)
            val days = listOf(2 to "Lun", 3 to "Mar", 4 to "Mié", 5 to "Jue", 6 to "Vie", 7 to "Sáb", 1 to "Dom")
            days.chunked(4).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { (day, label) ->
                        val bit = 1 shl (day - 1)
                        FilterChip(selected = reminderDays and bit != 0, onClick = {
                            reminderDays = reminderDays xor bit
                            PracticeReminder.setDays(context, reminderDays)
                        }, label = { Text(label) })
                    }
                }
            }
            if (reminderDays == 0) Text("Selecciona al menos un día para recibir recordatorios.", color = MaterialTheme.colorScheme.error)
            if (permissionDenied) Text("Activa las notificaciones en los ajustes del teléfono para recibir recordatorios.", color = MaterialTheme.colorScheme.error)
        }
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
