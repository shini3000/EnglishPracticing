/**
 * Deterministic date formatting for the dashboard.
 *
 * NOT `toLocaleDateString`: the page is server-rendered and then hydrated, and a locale- or
 * timezone-dependent formatter can produce different text on the server than in the browser.
 * Always use explicit America/Bogota on both sides; UTC remains the storage format.
 */

export const PRACTICE_TIME_ZONE = 'America/Bogota';

export function practiceDay(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PRACTICE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function formatPracticeDateTime(iso: string, locale = 'es'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: PRACTICE_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** "14 Jul" — compact, for session rows and group headers. */
export function formatShortDate(iso: string, locale = 'es'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: PRACTICE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}
