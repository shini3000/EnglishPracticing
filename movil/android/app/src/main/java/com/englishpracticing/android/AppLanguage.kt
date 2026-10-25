package com.englishpracticing.android

import android.content.Context
import android.content.res.Configuration
import java.util.Locale

/** Interface language is fixed independently of the learner's practice preferences. */
internal fun spanishContext(base: Context): Context {
    val locale = Locale.forLanguageTag("es")
    val configuration = Configuration(base.resources.configuration).apply {
        setLocale(locale)
        setLayoutDirection(locale)
    }
    return base.createConfigurationContext(configuration)
}
