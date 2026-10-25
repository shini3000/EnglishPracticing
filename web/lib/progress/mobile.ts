import { buildGroupReport, buildParameters } from './analysis';
import { SESSION_FILTERS, errorsForSessions } from './filters';
import { PARAMETER_GROUPS, formatterFor } from './parameters';
import type { DisplayMessage, ParameterDelta, ParameterSummary, ProgressSummary } from './types';

type Translate = (source: string) => string;
type Message = (message: DisplayMessage | undefined, fallback: string) => string;

export function mobileStatistics(
  summary: ProgressSummary,
  windowKey: string,
  text: Translate,
  message: Message,
  now = new Date()
) {
  const filter = SESSION_FILTERS.find((item) => item.key === windowKey);
  if (!filter) throw new Error('Invalid session window');
  const format = (key: string, value: number | null) =>
    value === null ? null : formatterFor(key)(value).replace(/(\d)\.(\d)/g, '$1,$2');
  const delta = (key: string, value: ParameterDelta | null) =>
    value && {
      ...value,
      fromFormatted: format(key, value.from),
      toFormatted: format(key, value.to),
    };
  const parameter = (item: ParameterSummary) => ({
    ...item,
    label: text(item.label),
    caption: text(item.caption),
    gate: item.gate ? message(item.gateMessage, item.gate) : null,
    formattedCurrent: format(item.key, item.current),
    sinceStart: delta(item.key, item.sinceStart),
    recent: delta(item.key, item.recent),
    points: item.points.map((point) => ({ ...point, formatted: format(item.key, point.value) })),
  });
  const selected = filter.apply(summary.sessions, now);
  const selectedErrors = errorsForSessions(summary.errors, selected);
  const filteredParameters =
    windowKey === 'all' ? summary.parameters : buildParameters(selected, selectedErrors);
  const report = buildGroupReport(summary.parameters);
  return {
    learner: summary.learner,
    totals: summary.totals,
    level: summary.level,
    latestSummary: summary.latestSummary,
    dataQuality: summary.dataQuality,
    strengths: summary.strengths.map((item) => ({
      label: text(item.label),
      detail: message(item.detailMessage, item.detail),
    })),
    weaknesses: summary.weaknesses.map((item) => ({
      ...item,
      label: text(item.label),
      advice: text(item.advice),
      note: message(item.noteMessage, item.note),
    })),
    parameters: summary.parameters.map(parameter),
    groups: PARAMETER_GROUPS.map((group) => ({
      key: group.key,
      title: text(group.title),
      blurb: text(group.blurb),
    })),
    recentCorrections: summary.recentCorrections,
    window: {
      key: windowKey,
      label: text(filter.label),
      parameters: filteredParameters.map(parameter),
      sessions: selected
        .map((session) => ({
          ...session,
          metrics: summary.parameters.map((item) => ({
            key: item.key,
            label: text(item.label),
            caption: text(item.caption),
            formatted: format(
              item.key,
              item.points[summary.sessions.indexOf(session)]?.value ?? null
            ),
            typical: format(item.key, item.current),
          })),
          corrections: summary.errors.filter((error) => error.session_id === session.id),
        }))
        .reverse(),
    },
    trajectory: report
      ? {
          ...report,
          parameters: report.parameters.map((item) => ({
            ...item,
            label: text(item.label),
            formattedValues: item.values.map((value) => format(item.key, value)),
            delta: delta(item.key, item.delta),
          })),
        }
      : null,
  };
}
