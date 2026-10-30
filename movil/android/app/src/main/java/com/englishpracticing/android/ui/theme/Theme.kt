package com.englishpracticing.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.clerk.api.ui.ClerkColors
import com.clerk.api.ui.ClerkTheme

val IndigoClerkTheme = ClerkTheme(
    lightColors = ClerkColors(
        primary = Color(0xFF5C1FE0), background = Color(0xFFEFE9FC),
        input = Color.White, foreground = Color(0xFF12062D),
        mutedForeground = Color(0xFF371287), primaryForeground = Color.White,
        inputForeground = Color(0xFF12062D), border = Color(0xFF7D4BE7),
        ring = Color(0xFF5C1FE0), secondaryButtonBackground = Color(0xFFDED2F9),
        secondaryButtonForeground = Color(0xFF250C5A),
    ),
    darkColors = ClerkColors(
        primary = Color(0xFFBEA5F3), background = Color(0xFF0D041F),
        input = Color(0xFF250C5A), foreground = Color(0xFFEFE9FC),
        mutedForeground = Color(0xFFDED2F9), primaryForeground = Color(0xFF12062D),
        inputForeground = Color(0xFFEFE9FC), border = Color(0xFF7D4BE7),
        ring = Color(0xFFBEA5F3), secondaryButtonBackground = Color(0xFF371287),
        secondaryButtonForeground = Color(0xFFEFE9FC),
    ),
)

private val LightColors = lightColorScheme(
    primary = Color(0xFF5C1FE0),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDED2F9),
    onPrimaryContainer = Color(0xFF250C5A),
    secondary = Color(0xFF4A18B4),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFEFE9FC),
    onSecondaryContainer = Color(0xFF250C5A),
    tertiary = Color(0xFF371287),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFDED2F9),
    onTertiaryContainer = Color(0xFF250C5A),
    background = Color(0xFFEFE9FC),
    onBackground = Color(0xFF12062D),
    surface = Color.White,
    onSurface = Color(0xFF12062D),
    surfaceVariant = Color(0xFFEFE9FC),
    onSurfaceVariant = Color(0xFF371287),
    outline = Color(0xFF4A18B4),
    outlineVariant = Color(0xFF7D4BE7),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFBEA5F3),
    onPrimary = Color(0xFF12062D),
    primaryContainer = Color(0xFF371287),
    onPrimaryContainer = Color(0xFFEFE9FC),
    secondary = Color(0xFFDED2F9),
    onSecondary = Color(0xFF250C5A),
    secondaryContainer = Color(0xFF250C5A),
    onSecondaryContainer = Color(0xFFDED2F9),
    tertiary = Color(0xFF9D78ED),
    onTertiary = Color(0xFF0D041F),
    tertiaryContainer = Color(0xFF371287),
    onTertiaryContainer = Color(0xFFEFE9FC),
    background = Color(0xFF0D041F),
    onBackground = Color(0xFFEFE9FC),
    surface = Color(0xFF12062D),
    onSurface = Color(0xFFEFE9FC),
    surfaceVariant = Color(0xFF250C5A),
    onSurfaceVariant = Color(0xFFDED2F9),
    outline = Color(0xFFBEA5F3),
    outlineVariant = Color(0xFF7D4BE7),
)

@Composable
fun EnglishPracticingTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
