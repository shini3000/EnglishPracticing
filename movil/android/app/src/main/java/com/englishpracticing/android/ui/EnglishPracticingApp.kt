package com.englishpracticing.android.ui

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.englishpracticing.android.R
import com.englishpracticing.android.ui.theme.EnglishPracticingTheme

private enum class PracticeMode(
    @StringRes val title: Int,
    @StringRes val focus: Int,
    @StringRes val description: Int,
) {
    Daily(R.string.practice_daily, R.string.practice_daily_focus, R.string.practice_daily_description),
    Fluency(R.string.practice_fluency, R.string.practice_fluency_focus, R.string.practice_fluency_description),
    Diagnostic(R.string.practice_diagnostic, R.string.practice_diagnostic_focus, R.string.practice_diagnostic_description),
}

@Composable
fun EnglishPracticingApp() {
    var selectedModeName by rememberSaveable { mutableStateOf<String?>(null) }
    val selectedMode = PracticeMode.entries.find { it.name == selectedModeName }

    Scaffold(containerColor = MaterialTheme.colorScheme.background) { insets ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(insets),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        stringResource(R.string.app_name),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        stringResource(R.string.home_title),
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        stringResource(R.string.home_description),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(PracticeMode.entries, key = { it.name }) { mode ->
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    Text(
                        stringResource(mode.title),
                        modifier = Modifier.padding(top = 8.dp),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(stringResource(mode.focus), style = MaterialTheme.typography.titleMedium)
                    Text(
                        stringResource(mode.description),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(
                        onClick = { selectedModeName = mode.name },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(stringResource(R.string.view_practice))
                    }
                }
            }
        }
    }

    if (selectedMode != null) {
        AlertDialog(
            onDismissRequest = { selectedModeName = null },
            title = { Text(stringResource(selectedMode.title)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(stringResource(selectedMode.description))
                    Text(stringResource(R.string.integration_pending))
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedModeName = null }) {
                    Text(stringResource(R.string.close))
                }
            },
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun HomePreview() {
    EnglishPracticingTheme { EnglishPracticingApp() }
}
