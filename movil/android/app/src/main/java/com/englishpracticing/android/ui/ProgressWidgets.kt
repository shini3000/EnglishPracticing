package com.englishpracticing.android.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.englishpracticing.android.data.measuredSegments
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

internal fun JSONObject.text(key: String, fallback: String = ""): String = opt(key)?.takeUnless { it == JSONObject.NULL }?.toString() ?: fallback
internal fun JSONObject.number(key: String): Double? = (opt(key) as? Number)?.toDouble()?.takeIf { it.isFinite() }
internal fun JSONObject.objects(key: String): List<JSONObject> = optJSONArray(key)?.objects() ?: emptyList()
internal fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
internal fun JSONArray.strings(): List<String> = (0 until length()).map { if (isNull(it)) "Sin datos" else optString(it) }
internal fun dateLabel(value: String): String = runCatching {
    if (value.length == 10) LocalDate.parse(value).format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.forLanguageTag("es")))
    else Instant.parse(value).atZone(ZoneId.of("America/Bogota")).format(DateTimeFormatter.ofPattern("d MMM yyyy · HH:mm", Locale.forLanguageTag("es")))
}.getOrDefault("Fecha no disponible")
internal fun totalValue(data: JSONObject?, key: String): String = data?.number(key)?.let { java.text.NumberFormat.getNumberInstance(Locale.forLanguageTag("es")).format(it) } ?: "Sin datos"

internal fun LazyListScope.statRows(values: List<Pair<String, String>>) {
    values.chunked(2).forEach { row -> item {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            row.forEach { (label, value) -> OutlinedCard(modifier = Modifier.weight(1f)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(label, style = MaterialTheme.typography.bodySmall)
                }
            } }
            if (row.size == 1) Spacer(Modifier.weight(1f))
        }
    } }
}

@Composable
internal fun MeasurementChart(points: List<JSONObject>, title: String) {
    val values = remember(points) { points.map { it.number("value") } }
    val smooth = remember(points) { points.map { it.number("smoothed") } }
    val known = (values + smooth).filterNotNull()
    if (known.isEmpty()) { Text("Todavía no hay mediciones para esta gráfica."); return }
    val low = known.min(); val high = known.max()
    val series = MaterialTheme.colorScheme.primary
    val raw = MaterialTheme.colorScheme.onSurfaceVariant
    val grid = MaterialTheme.colorScheme.outlineVariant
    Canvas(Modifier.fillMaxWidth().height(145.dp).semantics {
        contentDescription = "$title. ${values.count { it != null }} mediciones de ${values.size} sesiones. Los huecos son datos sin medir."
    }) {
        val pad = 10.dp.toPx()
        fun position(index: Int, value: Double): Offset = Offset(
            if (points.size <= 1) size.width / 2 else pad + index.toFloat() / (points.size - 1) * (size.width - 2 * pad),
            if (high == low) size.height / 2 else size.height - pad - ((value - low) / (high - low)).toFloat() * (size.height - 2 * pad))
        drawLine(grid, Offset(pad, size.height - pad), Offset(size.width - pad, size.height - pad), 1.dp.toPx())
        measuredSegments(smooth).forEach { segment ->
            val path = Path()
            segment.forEachIndexed { i, pair -> val at = position(pair.first, pair.second); if (i == 0) path.moveTo(at.x, at.y) else path.lineTo(at.x, at.y) }
            drawPath(path, series, style = Stroke(2.dp.toPx()))
        }
        values.forEachIndexed { index, value -> if (value != null) drawCircle(raw, 3.dp.toPx(), position(index, value)) }
    }
    Text("Puntos: sesión · Línea: tendencia suavizada · Huecos: sin medición", style = MaterialTheme.typography.bodySmall)
    if (points.isNotEmpty()) Text("${dateLabel(points.first().text("date"))} → ${dateLabel(points.last().text("date"))}", style = MaterialTheme.typography.bodySmall)
}

@Composable
internal fun DeltaLine(title: String, delta: JSONObject?) {
    if (delta == null) return
    val verdict = when (delta.text("verdict")) { "improved" -> "Mejoró"; "slipped" -> "Retrocedió"; "steady" -> "Estable"; else -> "Cambió" }
    Text("$title: ${delta.text("fromFormatted", "—")} → ${delta.text("toFormatted", "—")} · $verdict", style = MaterialTheme.typography.bodyMedium)
    Text("Comparación con ${delta.optInt("windowSize")} sesiones por ventana.", style = MaterialTheme.typography.bodySmall)
}

@Composable
internal fun MetricCard(metric: JSONObject, window: String) {
    var expanded by rememberSaveable(metric.text("key"), window) { mutableStateOf(false) }
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(metric.text("label"), style = MaterialTheme.typography.titleMedium)
            Text(metric.text("formattedCurrent", "Sin datos"), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            DeltaLine("Desde el inicio", metric.optJSONObject("sinceStart"))
            DeltaLine("Cambio reciente", metric.optJSONObject("recent"))
            val gate = metric.text("gate")
            if (gate.isNotBlank()) Text(gate, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { expanded = !expanded }) { Text(if (expanded) "Ocultar gráfica y valores" else "Ver gráfica y valores") }
            if (expanded) {
                Text(metric.text("caption"), style = MaterialTheme.typography.bodySmall)
                val points = metric.objects("points")
                MeasurementChart(points, metric.text("label"))
                Text("Valores recientes", fontWeight = FontWeight.Bold)
                points.takeLast(10).reversed().forEach { point -> Text("${dateLabel(point.text("date"))}: ${point.text("formatted", "Sin datos")}", style = MaterialTheme.typography.bodySmall) }
                Text("${metric.optInt("knownCount")} sesiones con medición.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
internal fun CorrectionCard(original: String, corrected: String, explanation: String) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(original, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(corrected, fontWeight = FontWeight.Bold)
        if (explanation.isNotBlank()) Text(explanation)
        HorizontalDivider(Modifier.padding(top = 8.dp))
    }
}

@Composable
internal fun LearningTrend(all: List<JSONObject>) {
    var showAll by rememberSaveable { mutableStateOf(false) }
    val points = if (showAll) all else all.takeLast(30)
    Text("Evolución de recuperaciones", style = MaterialTheme.typography.titleLarge)
    if (points.isEmpty()) { Text("No hay intentos observados de repaso o transferencia para trazar una evolución."); return }
    val colors = listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.tertiary, MaterialTheme.colorScheme.error)
    val keys = listOf("unaided", "helped", "failed")
    val max = points.maxOf { point -> keys.maxOf { point.optInt(it) } }.coerceAtLeast(1)
    Canvas(Modifier.fillMaxWidth().height(145.dp).semantics { contentDescription = "Recuperaciones sin ayuda, con ayuda y fallidas en ${points.size} días con evidencia." }) {
        val groupWidth = size.width / points.size
        val barWidth = groupWidth / 4
        points.forEachIndexed { index, point -> keys.forEachIndexed { kind, key ->
            val height = point.optInt(key).toFloat() / max * (size.height - 8.dp.toPx())
            drawRect(colors[kind], topLeft = Offset(index * groupWidth + kind * barWidth, size.height - height), size = androidx.compose.ui.geometry.Size(barWidth * .85f, height))
        } }
    }
    Text("Cada grupo: sin ayuda · con ayuda · fallido. Se muestran ${points.size} días con actividad.", style = MaterialTheme.typography.bodySmall)
    points.takeLast(7).reversed().forEach { point -> Text("${dateLabel(point.text("date"))}: ${point.optInt("unaided")} sin ayuda / ${point.optInt("helped")} con ayuda / ${point.optInt("failed")} fallidos", style = MaterialTheme.typography.bodySmall) }
    if (all.size > 30) TextButton(onClick = { showAll = !showAll }) { Text(if (showAll) "Ver últimos 30 días con actividad" else "Ver todo el historial en la gráfica") }
}
