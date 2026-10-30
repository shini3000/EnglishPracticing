package com.englishpracticing.android.reminder

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.englishpracticing.android.MainActivity
import com.englishpracticing.android.R
import java.util.Calendar

object PracticeReminder {
    private const val PREFS = "practice_reminder"
    fun enabled(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", false)
    fun hour(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("hour", 15)
    fun minute(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("minute", 30)
    fun days(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("days", 127) and 127
    fun setDays(context: Context, days: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("days", days and 127).apply()
        schedule(context)
    }
    fun nextOccurrence(now: Calendar, hour: Int, minute: Int, days: Int): Calendar? {
        if (days and 127 == 0) return null
        val next = now.clone() as Calendar
        next.set(Calendar.HOUR_OF_DAY, hour); next.set(Calendar.MINUTE, minute)
        next.set(Calendar.SECOND, 0); next.set(Calendar.MILLISECOND, 0)
        for (offset in 0..7) {
            val bit = 1 shl (next.get(Calendar.DAY_OF_WEEK) - 1)
            if (days and bit != 0 && next.timeInMillis > now.timeInMillis) return next
            next.add(Calendar.DAY_OF_YEAR, 1)
        }
        return null
    }
    fun configure(context: Context, enabled: Boolean, hour: Int, minute: Int) {
        require(hour in 0..23 && minute in 0..59)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", enabled).putInt("hour", hour).putInt("minute", minute).apply()
        schedule(context)
    }
    fun schedule(context: Context) {
        val alarm = context.getSystemService(AlarmManager::class.java)
        val pending = PendingIntent.getBroadcast(context, 0, Intent(context, PracticeReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        alarm.cancel(pending)
        if (!enabled(context)) return
        val next = nextOccurrence(Calendar.getInstance(), hour(context), minute(context), days(context)) ?: return
        alarm.set(AlarmManager.RTC_WAKEUP, next.timeInMillis, pending)
    }
}

class PracticeReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!PracticeReminder.enabled(context)) return
        PracticeReminder.schedule(context)
        if (PracticeReminder.days(context) and (1 shl (Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1)) == 0) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("practice-reminders", "Recordatorios de práctica", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = android.app.Notification.Builder(context, "practice-reminders")
            .setSmallIcon(R.drawable.ic_launcher).setContentTitle("Es hora de practicar inglés")
            .setContentText("Abre la app y continúa tu práctica.").setContentIntent(open).setAutoCancel(true).build()
        if (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED) manager.notify(21, notification)
    }
}

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) PracticeReminder.schedule(context)
    }
}
