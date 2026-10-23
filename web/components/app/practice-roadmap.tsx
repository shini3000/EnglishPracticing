import { useTranslations } from 'next-intl';
import { BlockRail } from '@/components/practice/block-rail';
import { translateStatic } from '@/i18n/static-text';

export type RouteStep = { label: string; minutes: number; block: string; completed: boolean };

export function PracticeRoadmap({
  steps,
  current,
  finished,
  onSelectBlock,
  disabled,
}: {
  steps: RouteStep[];
  current: number;
  finished: boolean;
  onSelectBlock?: (index: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('ui');

  const blocks = [...new Set(steps.map((step) => step.block))];
  return (
    <BlockRail
      label={t('m8fd9e838e6d6')}
      current={finished ? undefined : blocks.indexOf(steps[current]?.block)}
      blocks={blocks.map((block) => {
        const first = steps.findIndex((step) => step.block === block);
        const active = block === steps[current]?.block;
        return {
          label: translateStatic(t, block),
          detail: active
            ? `${translateStatic(t, steps[current].label)} · ${t('stepOf', { step: current + 1, total: steps.length })}`
            : t('blockStart', {
                minutes: steps
                  .filter((step) => step.block === block)
                  .reduce((total, step) => total + step.minutes, 0),
              }),
          disabled: disabled || finished || active,
          onSelect: onSelectBlock ? () => onSelectBlock(first) : undefined,
        };
      })}
    />
  );
}
