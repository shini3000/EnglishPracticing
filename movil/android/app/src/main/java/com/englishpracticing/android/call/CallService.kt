package com.englishpracticing.android.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.content.ContextCompat
import com.englishpracticing.android.EnglishPracticingApplication
import com.englishpracticing.android.MainActivity
import com.englishpracticing.android.R

class CallService : Service() {
    private val calls get() = (application as EnglishPracticingApplication).calls
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action != START) {
            calls.end()
            stopSelf()
            return START_NOT_STICKY
        }
        if (calls.state.value.active) return START_NOT_STICKY
        val mode = intent.getStringExtra(MODE)
        if (mode !in setOf("daily", "diagnostic", "fluency")) {
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL, "Llamadas de práctica", NotificationManager.IMPORTANCE_LOW))
            val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val end = PendingIntent.getService(this, 1, Intent(this, CallService::class.java).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val notification = Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_launcher).setContentTitle(getString(R.string.app_name))
                .setContentText("Llamada de práctica en curso").setContentIntent(open).setOngoing(true)
                .addAction(Notification.Action.Builder(null, "Finalizar", end).build()).build()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            } else startForeground(NOTIFICATION, notification)
            calls.connect(requireNotNull(mode), intent.getIntExtra("start-step", 0)) { stopSelf() }
        } catch (_: Exception) {
            calls.end("No se pudo iniciar el audio. Abre la app y comprueba el permiso del micrófono.")
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        calls.end(calls.state.value.error)
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        calls.end()
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    companion object {
        private const val CHANNEL = "practice-call"
        private const val NOTIFICATION = 10
        private const val START = "com.englishpracticing.android.START_CALL"
        private const val STOP = "com.englishpracticing.android.STOP_CALL"
        private const val MODE = "practice-mode"
        fun start(context: Context, mode: String, startStep: Int = 0) {
            ContextCompat.startForegroundService(context, Intent(context, CallService::class.java).setAction(START).putExtra(MODE, mode).putExtra("start-step", startStep))
        }
    }
}
