export type VocabularyAttempt = {
  date: string;
  result: string;
  practice_block?: string;
  observed: boolean;
  attempt_type: string;
  context: string;
};

/** Recalculate on every read: snapshots cannot expire on their own. Dates are Colombia calendar dates. */
export function vocabularyBlockProgress(attempts: VocabularyAttempt[], today: string) {
  const days = new Map<string, Set<string>>();
  for (const attempt of attempts) {
    if (
      attempt.practice_block !== 'vocabulary' ||
      !attempt.observed ||
      !['review', 'transfer'].includes(attempt.attempt_type) ||
      !attempt.context ||
      !/^\d{4}-\d{2}-\d{2}$/.test(attempt.date) ||
      attempt.date > today
    )
      continue;
    if (!days.has(attempt.date)) days.set(attempt.date, new Set());
    days.get(attempt.date)!.add(attempt.result);
  }
  const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86400000;
  let streak = 0,
    completedOn: string | null = null,
    lastUsed: string | null = null;
  for (const [day, results] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    if (completedOn) break;
    if (lastUsed && dayNumber(day) - dayNumber(lastUsed) >= 4) streak = 0;
    if (results.has('failed')) streak = 0;
    else if (results.has('unaided')) {
      streak++;
      if (streak >= 10) completedOn = day;
    }
    if (results.has('unaided') || results.has('helped')) lastUsed = day;
  }
  if (!completedOn && lastUsed && dayNumber(today) - dayNumber(lastUsed) >= 4) streak = 0;
  return { streak, target: 10, completed: completedOn !== null, completed_on: completedOn };
}
