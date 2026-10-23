import { numberToCefr } from '@/lib/progress/cefr';
import type { DisplayMessage } from '@/lib/progress/types';

type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Structured product copy, not translation of learner evidence or AI feedback. */
export function progressText(t: Translator, message: DisplayMessage): string {
  if (message.key !== 'metricTrend') return t(message.key, message.values);
  const { parameter, value, ...values } = message.values;
  const key = String(parameter);
  const numeric = Number(value);
  const percent = [
    'advanced_word_ratio',
    'type_token_ratio',
    'complex_sentence_ratio',
    'question_ratio',
  ].includes(key);
  const decimal = [
    'errors_per_100_words',
    'mean_sentence_length',
    'sentence_length_stdev',
    'filler_rate',
    'self_correction_rate',
  ].includes(key);
  const formatted = percent
    ? Math.round(numeric * 100)
    : decimal
      ? numeric.toFixed(1)
      : Math.round(numeric);
  const description =
    key === 'cefr'
      ? numberToCefr(numeric)
      : t(key.startsWith('mistake:') ? 'perSession' : `describe_${key}`, { value: formatted });
  return t('metricTrend', { ...values, description });
}
