package com.englishpracticing.android

import android.content.Context

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.englishpracticing.android.ui.EnglishPracticingApp
import com.englishpracticing.android.ui.theme.EnglishPracticingTheme

class MainActivity : ComponentActivity() {
    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(spanishContext(base))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            EnglishPracticingTheme {
                EnglishPracticingApp()
            }
        }
    }
}
