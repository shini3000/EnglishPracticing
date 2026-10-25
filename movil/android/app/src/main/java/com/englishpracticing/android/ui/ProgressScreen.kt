package com.englishpracticing.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.json.JSONObject

private val windows = listOf("all" to "Todas", "last-5" to "Últimas 5", "last-10" to "Últimas 10", "week" to "7 días", "month" to "30 días")

@Composable
fun ProgressScreen(model: PracticeViewModel, userId: String, onBack: () -> Unit) {
    val state by model.progress.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable(userId) { mutableStateOf(0) }
    var learningFilter by rememberSaveable(userId) { mutableStateOf("all") }
    var shown by rememberSaveable(tab, learningFilter, state.window) { mutableStateOf(30) }
    LaunchedEffect(userId) { model.bindAccount(userId); model.progress.load() }
    DisposableEffect(userId) { onDispose { model.progress.stop() } }
    BackHandler(onBack = onBack)
    val listState = rememberLazyListState()
    LaunchedEffect(tab, learningFilter, state.window) { listState.scrollToItem(0) }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onBack) { Text("Volver") }
            OutlinedButton(onClick = { model.progress.load() }, enabled = !state.loading) { Text(if (state.loading) "Actualizando…" else "Actualizar") }
        }
        Text("Mi progreso", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp))
        ScrollableTabRow(selectedTabIndex = tab, edgePadding = 16.dp) {
            listOf("Resumen", "Aprendizaje", "Métricas", "Sesiones", "Actividad").forEachIndexed { index, title ->
                Tab(selected = tab == index, onClick = { tab = index }, text = { Text(title) })
            }
        }
        LazyColumn(state = listState, contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (state.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()); Text("Consultando tu progreso guardado…", Modifier.padding(top = 8.dp)) }
            state.error?.let { error -> item {
                Text(error, color = MaterialTheme.colorScheme.error)
                if (state.data != null) Text("Se muestran los últimos datos cargados, sin sustituirlos por ceros.", style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = { model.progress.load() }, enabled = !state.loading) { Text("Reintentar") }
            } }
            val payload = state.data
            if (payload == null) {
                if (!state.loading && state.error == null) item { Text("Abre o actualiza esta pantalla para consultar tu progreso.") }
            } else {
                val stats = payload.getJSONObject("statistics")
                when (tab) {
                    0 -> summarySection(stats)
                    1 -> learningSection(payload.getJSONObject("learning"), learningFilter, { learningFilter = it }, shown, { shown += 30 })
                    2, 3 -> {
                        item {
                            Text("Ventana de sesiones", style = MaterialTheme.typography.titleMedium)
                            androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(windows) { (value, title) -> FilterChip(selected = state.window == value,
                                    onClick = { model.progress.load(value) }, enabled = !state.loading, label = { Text(title) }) }
                            }
                            Text("Los totales y el nivel global no cambian con este filtro.", style = MaterialTheme.typography.bodySmall)
                            Text("Datos mostrados: ${stats.getJSONObject("window").text("label")}", style = MaterialTheme.typography.bodySmall)
                        }
                        if (tab == 2) metricsSection(stats) else sessionsSection(stats, shown, { shown += 30 })
                    }
                    4 -> activitySection(payload.getJSONObject("activity"), shown, { shown += 30 })
                }
                item {
                    Text("Son los mismos cálculos y registros que utiliza la web. El nivel es una estimación, no una certificación. Una repetición no demuestra dominio; una medición ausente no es cero.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

private fun LazyListScope.summarySection(stats: JSONObject) {
    val totals = stats.getJSONObject("totals")
    val level = stats.getJSONObject("level")
    item {
        Text("Nivel estimado", style = MaterialTheme.typography.titleMedium)
        Text(level.text("band", "Aún sin evaluar"), style = MaterialTheme.typography.displaySmall)
        Text(if (level.optBoolean("isProvisional")) "Primera impresión: aún hay pocas sesiones evaluadas." else "Estimación agregada de tus sesiones evaluadas.")
        val confidence = level.number("confidence")
        if (level.text("band").isNotBlank() && confidence != null) Text("Confianza: ${kotlin.math.round(confidence * 100).toInt()}%", style = MaterialTheme.typography.bodySmall)
    }
    statRows(listOf("Sesiones" to totalValue(totals, "sessions"), "Minutos de conversación" to totalValue(totals, "practiceMinutes"),
        "Palabras pronunciadas" to totalValue(totals, "wordsSpoken"), "Palabras distintas usadas" to totalValue(totals, "vocabularySize"),
        "Racha de días" to totalValue(totals, "currentStreakDays")))
    item {
        val quality = stats.getJSONObject("dataQuality")
        Text("${totalValue(quality, "gradedSessions")} sesiones evaluadas · ${totalValue(quality, "ungradedSessions")} sin evaluación.")
        Text("Hasta las últimas 200 llamadas. Los ejercicios independientes aparecen en Actividad; no se cuentan como llamadas.", style = MaterialTheme.typography.bodySmall)
        if (totals.optInt("sessions") == 0) Text("Todavía no hay llamadas guardadas para analizar. Puedes consultar tus ejercicios y evidencias en las otras pestañas.", Modifier.padding(top = 12.dp))
        if (stats.text("latestSummary").isNotBlank()) { Text("Última devolución", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 16.dp)); Text(stats.text("latestSummary"), Modifier.padding(top = 8.dp)) }
    }
    item { Text("Fortalezas", style = MaterialTheme.typography.titleLarge) }
    val strengths = stats.objects("strengths")
    if (strengths.isEmpty()) item { Text("Aún no hay evidencia suficiente para describir mejoras.") }
    items(strengths) { item -> OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(item.text("label"), fontWeight = FontWeight.Bold); Text(item.text("detail")) } } }
    item { Text("Prioridades de práctica", style = MaterialTheme.typography.titleLarge) }
    val weaknesses = stats.objects("weaknesses")
    if (weaknesses.isEmpty()) item { Text("No hay dificultades registradas suficientes para detectar un patrón.") }
    items(weaknesses) { item ->
        OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(item.text("label"), fontWeight = FontWeight.Bold)
            Text(when (item.text("status")) { "regressed" -> "Reapareció"; "persistent" -> "Persistente"; "new" -> "Reciente"; else -> "En seguimiento" }, color = MaterialTheme.colorScheme.primary)
            Text(item.text("note")); Text(item.text("advice"))
            if (item.text("category") != "metric") Text("${item.optInt("totalErrors")} errores · ${item.optInt("sessionsAffected")} sesiones", style = MaterialTheme.typography.bodySmall)
        } }
    }
    item { Text("Correcciones recientes de llamadas", style = MaterialTheme.typography.titleLarge) }
    val corrections = stats.objects("recentCorrections")
    if (corrections.isEmpty()) item { Text("No hay correcciones de llamadas guardadas.") }
    items(corrections) { row -> CorrectionCard(row.text("learner_text"), row.text("corrected_text"), row.text("explanation")) }
}

private fun LazyListScope.metricsSection(stats: JSONObject) {
    val window = stats.getJSONObject("window")
    val metrics = window.objects("parameters")
    if (window.objects("sessions").isEmpty()) item { Text("No hay sesiones en esta ventana.") }
    stats.objects("groups").forEach { group ->
        val rows = metrics.filter { it.text("group") == group.text("key") }
        if (rows.isNotEmpty()) {
            item { Text(group.text("title"), style = MaterialTheme.typography.titleLarge); Text(group.text("blurb"), style = MaterialTheme.typography.bodySmall) }
            items(rows, key = { "metric:${it.text("key")}" }) { MetricCard(it, window.text("key")) }
        }
    }
    item { Text("Trayectoria global", style = MaterialTheme.typography.titleLarge) }
    val report = stats.optJSONObject("trajectory")
    if (report == null) item { Text("Todavía no hay suficientes sesiones para comparar grupos.") }
    else item { TrajectoryCard(report) }
}

@Composable
private fun TrajectoryCard(report: JSONObject) {
    val parameters = report.objects("parameters")
    var chosen by rememberSaveable { mutableStateOf("") }
    var menu by remember { mutableStateOf(false) }
    val metric = parameters.find { it.text("key") == chosen } ?: parameters.firstOrNull() ?: return
    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Grupos de ${report.optInt("groupSize")} sesiones. Usa el historial global, sin aplicar el filtro anterior.")
        Box {
            OutlinedButton(onClick = { menu = true }) { Text(metric.text("label")) }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                parameters.forEach { item -> DropdownMenuItem(text = { Text(item.text("label")) }, onClick = { chosen = item.text("key"); menu = false }) }
            }
        }
        val values = metric.optJSONArray("formattedValues")?.strings() ?: emptyList()
        report.objects("groups").forEachIndexed { index, group ->
            Text("Sesiones ${group.text("label")}: ${values.getOrNull(index) ?: "Sin datos"}", fontWeight = FontWeight.Medium)
            Text("${dateLabel(group.text("startDate"))} → ${dateLabel(group.text("endDate"))}", style = MaterialTheme.typography.bodySmall)
        }
        DeltaLine("Primer grupo frente al último", metric.optJSONObject("delta"))
        if (metric.optBoolean("cumulative")) Text("Este indicador es acumulativo; no se presenta como una mejora porcentual.", style = MaterialTheme.typography.bodySmall)
    } }
}

private fun LazyListScope.sessionsSection(stats: JSONObject, shown: Int, more: () -> Unit) {
    val sessions = stats.getJSONObject("window").objects("sessions")
    item { Text("${sessions.size} sesiones en esta ventana", style = MaterialTheme.typography.titleLarge) }
    if (sessions.isEmpty()) item { Text("No hay sesiones que coincidan con el filtro.") }
    items(sessions.take(shown), key = { "session:${it.text("id")}" }) { SessionCard(it) }
    if (sessions.size > shown) item { OutlinedButton(onClick = more) { Text("Mostrar más sesiones") } }
}

@Composable
private fun SessionCard(session: JSONObject) {
    var expanded by rememberSaveable(session.text("id")) { mutableStateOf(false) }
    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(dateLabel(session.text("started_at")), style = MaterialTheme.typography.titleMedium)
        Text("${session.optInt("word_count")} palabras · ${session.optInt("duration_seconds") / 60} min ${session.optInt("duration_seconds") % 60} s")
        Text(if (session.text("cefr_estimate").isBlank()) "Evaluación pendiente o no disponible" else "Evaluación de esta sesión: ${session.text("cefr_estimate")}")
        TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Ocultar detalles" else "Ver métricas y correcciones") }
        if (expanded) {
            Text("Una sesión aislada depende del tema y no sustituye el nivel global.", style = MaterialTheme.typography.bodySmall)
            if (session.text("summary").isNotBlank()) Text(session.text("summary"))
            session.objects("metrics").forEach { metric ->
                Text("${metric.text("label")}: ${metric.text("formatted", "Sin datos")}", fontWeight = FontWeight.Medium)
                Text("Valor habitual: ${metric.text("typical", "Sin datos")}", style = MaterialTheme.typography.bodySmall)
            }
            val corrections = session.objects("corrections")
            if (corrections.isEmpty()) Text("No hay correcciones registradas para esta llamada.")
            corrections.forEach { row -> CorrectionCard(row.text("learner_text"), row.text("corrected_text"), row.text("explanation")) }
        }
    } }
}

private fun LazyListScope.learningSection(data: JSONObject, filter: String, select: (String) -> Unit, shown: Int, more: () -> Unit) {
    if (!data.optBoolean("available")) { item { Text("El aprendizaje no está disponible. No se sustituye por contadores en cero; revisa el esquema o actualiza más tarde.") }; return }
    val totals = data.getJSONObject("totals")
    statRows(listOf("Elementos introducidos" to totalValue(totals, "introduced"), "En consolidación" to totalValue(totals, "consolidating"),
        "Consolidados" to totalValue(totals, "consolidated"), "Repasos pendientes" to totalValue(totals, "due"),
        "Días con evidencia" to totalValue(totals, "practiceDays"), "Minutos medidos por el reloj" to totalValue(totals, "measuredMinutes"),
        "Recuperaciones sin ayuda" to totalValue(totals, "unaided"), "Éxito sin ayuda" to (totals.number("successRate")?.let { "${it.toInt()}%" } ?: "Sin datos")))
    item { Text("${totalValue(totals, "vocabulary")} elementos de vocabulario · ${totalValue(totals, "structures")} estructuras · ${totalValue(totals, "helped")} intentos con ayuda · ${totalValue(totals, "failed")} fallidos.", style = MaterialTheme.typography.bodySmall) }
    item { LearningTrend(data.objects("trend")) }
    item {
        Text("Vocabulario y estructuras", style = MaterialTheme.typography.titleLarge)
        androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(listOf("all" to "Todo", "vocabulary" to "Vocabulario", "structure" to "Estructuras", "due" to "Para repasar")) { (key, label) ->
                FilterChip(selected = filter == key, onClick = { select(key) }, label = { Text(label) })
            }
        }
    }
    val items = data.objects("items").filter { filter == "all" || it.text("item_type") == filter || filter == "due" && it.optBoolean("due") }
    if (items.isEmpty()) item { Text("No hay elementos para este filtro. Las repeticiones no se convierten automáticamente en aprendizaje consolidado.") }
    items(items.take(shown), key = { "learning:${it.text("item_type")}:${it.text("key")}" }) { LearningItemCard(it) }
    if (items.size > shown) item { OutlinedButton(onClick = more) { Text("Mostrar más elementos") } }
}

@Composable
private fun LearningItemCard(item: JSONObject) {
    var expanded by rememberSaveable(item.text("key"), item.text("item_type")) { mutableStateOf(false) }
    var shown by rememberSaveable(item.text("key")) { mutableStateOf(20) }
    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(item.text("label"), style = MaterialTheme.typography.titleMedium)
        Text(item.text("state"), color = MaterialTheme.colorScheme.primary)
        Text("${item.optInt("unaided_successes")} recuperaciones sin ayuda · ${item.optInt("context_count")} contextos · ${item.optInt("span_days")} días de intervalo.")
        Text("Próximo repaso: ${item.text("next_review").takeIf { it.isNotBlank() }?.let(::dateLabel) ?: "Sin programar"}${if (item.optBoolean("due")) " · Pendiente" else ""}")
        TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Ocultar evidencias" else "Ver ${item.optInt("attempt_count")} intentos") }
        if (expanded) {
            val policy = item.optJSONObject("policy")
            if (policy != null) Text("Criterio: ${policy.optInt("min_days")} días, ${policy.optInt("min_contexts")} contextos y ${policy.optInt("min_span_days")} días de intervalo.", style = MaterialTheme.typography.bodySmall)
            val attempts = item.objects("attempts").asReversed()
            attempts.take(shown).forEach { attempt ->
                HorizontalDivider()
                Text("${dateLabel(attempt.text("date"))} · ${when (attempt.text("result")) { "unaided" -> "Sin ayuda"; "helped" -> "Con ayuda"; else -> "Fallido" }}", fontWeight = FontWeight.Medium)
                Text(attempt.text("context")); Text(attempt.text("evidence"))
                if (!attempt.optBoolean("observed") || attempt.text("attempt_type") !in listOf("review", "transfer")) Text("Ensayo o evidencia sin observación: no certifica recuperación independiente.", style = MaterialTheme.typography.bodySmall)
            }
            if (attempts.size > shown) TextButton(onClick = { shown += 20 }) { Text("Ver más intentos") }
        }
    } }
}

private fun LazyListScope.activitySection(data: JSONObject, shown: Int, more: () -> Unit) {
    if (!data.optBoolean("available")) { item { Text("No se pudo consultar la actividad. Actualiza para reintentar.") }; return }
    val entries = data.objects("items")
    item { Text("Llamadas y ejercicios revisados", style = MaterialTheme.typography.titleLarge); Text("Las revisiones independientes no se cuentan como sesiones de conversación.", style = MaterialTheme.typography.bodySmall) }
    if (entries.isEmpty()) item { Text("Todavía no hay actividad guardada.") }
    items(entries.take(shown), key = { "activity:${it.text("type")}:${it.text("id")}" }) { ActivityCard(it) }
    if (entries.size > shown) item { OutlinedButton(onClick = more) { Text("Mostrar más actividad") } }
}

@Composable
private fun ActivityCard(item: JSONObject) {
    var expanded by rememberSaveable(item.text("id")) { mutableStateOf(false) }
    OutlinedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(item.text("label"), style = MaterialTheme.typography.titleMedium)
        Text(dateLabel(item.text("at")))
        if (item.text("type") == "drill") {
            TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Ocultar revisión" else "Ver respuesta y correcciones") }
            if (expanded) {
                Text(item.text("text")); Text(item.text("feedback"))
                val cards = item.objects("corrections")
                if (cards.isEmpty()) Text("Esta revisión no contiene correcciones escritas.")
                cards.forEach { CorrectionCard(it.text("original"), it.text("corrected"), it.text("explanation")) }
            }
        }
    } }
}
