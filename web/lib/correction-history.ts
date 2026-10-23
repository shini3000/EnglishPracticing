export type JournalEntry = { kind: string; date: string; [key: string]: unknown };
export type CorrectionItem = {
  id: string;
  date: string;
  source: string;
  learner_text: string;
  corrected_text: string;
  pattern: string;
  explanation: string;
  recovery_task: string;
};
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Use the same practice-day boundary as persistence, not the browser's time zone. */
export function correctionDay(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function correctionsForDay(items: CorrectionItem[], day: string): CorrectionItem[] {
  return items
    .filter((item) => correctionDay(item.date) === day)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function mergeJournalEntries(...groups: unknown[][]): JournalEntry[] {
  const entries = new Map<string, JournalEntry>();
  for (const group of groups)
    for (const raw of group) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const entry = raw as JournalEntry;
      if (typeof entry.kind !== 'string') continue;
      const id = text(entry.event_id) || JSON.stringify(entry);
      entries.set(id, entry);
    }
  return [...entries.values()].sort((a, b) =>
    text(a.recorded_at || a.date).localeCompare(text(b.recorded_at || b.date))
  );
}

export function correctionHistory(entries: JournalEntry[]): CorrectionItem[] {
  return mergeJournalEntries(entries).flatMap((entry) => {
    const id = text(entry.event_id) || JSON.stringify(entry);
    const date = text(entry.recorded_at) || text(entry.date);
    if (
      entry.kind === 'correction' &&
      text(entry.learner_text).trim() &&
      text(entry.corrected_text).trim()
    ) {
      return [
        {
          id,
          date,
          source: 'Tutor',
          learner_text: text(entry.learner_text),
          corrected_text: text(entry.corrected_text),
          pattern: text(entry.pattern),
          explanation: text(entry.explanation),
          recovery_task: text(entry.recovery_task),
        },
      ];
    }
    if (entry.kind !== 'drill_review' || !Array.isArray(entry.corrections)) return [];
    return entry.corrections.flatMap((raw, index) => {
      if (!raw || typeof raw !== 'object') return [];
      const correction = raw as Record<string, unknown>;
      if (!text(correction.original).trim() || !text(correction.corrected).trim()) return [];
      return [
        {
          id: `${id}:${index}`,
          date,
          source: entry.block === 4 ? 'Bloque 4 · Rondas 4–3–2' : 'Bloque 1 · Gimnasia temporal',
          learner_text: text(correction.original),
          corrected_text: text(correction.corrected),
          pattern: text(correction.pattern),
          explanation: text(correction.explanation),
          recovery_task: '',
        },
      ];
    });
  });
}
