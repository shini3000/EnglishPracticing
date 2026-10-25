package com.englishpracticing.android

import android.content.Context

import android.app.Application
import com.clerk.api.Clerk
import com.englishpracticing.android.call.CallManager

class EnglishPracticingApplication : Application() {
    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(spanishContext(base))
    }

    val calls by lazy { CallManager(this) }

    override fun onCreate() {
        super.onCreate()
        java.util.Locale.setDefault(java.util.Locale.forLanguageTag("es"))
        // Recordings from a terminated process cannot be resumed; do not retain them.
        cacheDir.listFiles()?.filter { it.name.startsWith("practice-") && it.extension == "m4a" }?.forEach { it.delete() }
        if (BuildConfig.CLERK_PUBLISHABLE_KEY.isNotBlank()) {
            Clerk.initialize(this, publishableKey = BuildConfig.CLERK_PUBLISHABLE_KEY)
        }
    }
}
