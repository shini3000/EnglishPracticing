package com.englishpracticing.android.reminder

import java.util.Calendar
import java.util.TimeZone
import org.junit.Assert.*
import org.junit.Test

class PracticeReminderTest {
    private fun date(day: Int, hour: Int, minute: Int) = Calendar.getInstance(TimeZone.getTimeZone("America/Bogota")).apply {
        clear(); set(2026, Calendar.NOVEMBER, day, hour, minute)
    }

    @Test fun skipsUnselectedDaysAndSchedulesNextWeekAfterTimePasses() {
        val monday = 1 shl (Calendar.MONDAY - 1)
        val wednesday = 1 shl (Calendar.WEDNESDAY - 1)
        val next = PracticeReminder.nextOccurrence(date(2, 16, 0), 15, 30, monday or wednesday)!!
        assertEquals(4, next.get(Calendar.DAY_OF_MONTH))
        assertEquals(15, next.get(Calendar.HOUR_OF_DAY))
        assertEquals(30, next.get(Calendar.MINUTE))
        val nextWeek = PracticeReminder.nextOccurrence(date(2, 15, 30), 15, 30, monday)!!
        assertEquals(9, nextWeek.get(Calendar.DAY_OF_MONTH))
    }

    @Test fun noDaysProducesNoAlarmAndMidnightIsHandled() {
        assertNull(PracticeReminder.nextOccurrence(date(2, 12, 0), 0, 0, 0))
        val tuesday = 1 shl (Calendar.TUESDAY - 1)
        val next = PracticeReminder.nextOccurrence(date(2, 23, 59), 0, 0, tuesday)!!
        assertEquals(3, next.get(Calendar.DAY_OF_MONTH))
        assertEquals(0, next.get(Calendar.HOUR_OF_DAY))
    }
}
