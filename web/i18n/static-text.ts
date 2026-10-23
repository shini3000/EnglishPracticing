import ids from './static-message-ids.json';

// Only fixed product labels/instructions pass through this adapter. Learner
// quotes, model feedback and historic evidence are never machine-translated.
export function translateStatic(t: (key: string) => string, source: string): string {
  const key = (ids as Record<string, string>)[source];
  return key ? t(key) : source;
}
