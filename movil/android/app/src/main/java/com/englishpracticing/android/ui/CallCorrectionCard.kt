package com.englishpracticing.android.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.englishpracticing.android.call.WrittenCorrection

@Composable
internal fun CallCorrectionCard(correction: WrittenCorrection) {
    val current = correction.currentCall
    val foreground = if (current) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.outlinedCardColors(
            containerColor = if (current) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
            contentColor = foreground,
        ),
        border = BorderStroke(if (current) 2.dp else 1.dp,
            if (current) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (current) Text("Nueva en esta llamada", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
            Text(correction.original)
            Text(correction.corrected, fontWeight = FontWeight.Bold)
            Text(correction.explanation)
            if (correction.exercise.isNotBlank()) Text(correction.exercise)
            if (!correction.saved) Text("Pendiente de confirmar guardado", style = MaterialTheme.typography.bodySmall)
        }
    }
}
