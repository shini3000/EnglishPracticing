package com.englishpracticing.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF2457BC),
    onPrimary = Color.White,
    background = Color(0xFFF3F6FA),
    onBackground = Color(0xFF18243A),
    surface = Color.White,
    onSurface = Color(0xFF18243A),
    onSurfaceVariant = Color(0xFF4D5D75),
    outlineVariant = Color(0xFFD5DFEC),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9BBCFF),
    onPrimary = Color(0xFF082C6E),
    background = Color(0xFF141E2D),
    onBackground = Color(0xFFE6EDF8),
    surface = Color(0xFF1D2A3D),
    onSurface = Color(0xFFE6EDF8),
    onSurfaceVariant = Color(0xFFBBC9DD),
    outlineVariant = Color(0xFF3A4D69),
)

@Composable
fun EnglishPracticingTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
