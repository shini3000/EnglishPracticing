import { BlockRail } from '@/components/practice/block-rail';

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
  const blocks = [...new Set(steps.map((step) => step.block))];
  return (
    <BlockRail
      label="Recorrido de la práctica"
      current={finished ? undefined : blocks.indexOf(steps[current]?.block)}
      blocks={blocks.map((block) => {
        const first = steps.findIndex((step) => step.block === block);
        const active = block === steps[current]?.block;
        return {
          label: block,
          detail: active
            ? `${steps[current].label} · Paso ${current + 1} de ${steps.length}`
            : `${steps.filter((step) => step.block === block).reduce((total, step) => total + step.minutes, 0)} min · Ir al comienzo de este bloque`,
          disabled: disabled || finished || active,
          onSelect: onSelectBlock ? () => onSelectBlock(first) : undefined,
        };
      })}
    />
  );
}
