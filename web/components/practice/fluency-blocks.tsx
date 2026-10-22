import Link from 'next/link';
import { BlockRail } from '@/components/practice/block-rail';

const BLOCKS = [
  ['Gimnasia temporal', '7 min', '/drill'],
  ['Monólogo con anclajes', '10 min', '/call?practice=fluency&start=anchors'],
  ['Input activo con réplica inmediata', '15 min · Sin llamada', '/practice-b/input'],
  ['Agilidad y síntesis · 4–3–2', '15 min · Corrección escrita', '/practice-b/agility'],
  ['Microauditoría', '8 min', '/call?practice=fluency&start=audit'],
];

const DESCRIPTIONS = [
  'Cuenta la misma rutina en presente, pasado y present perfect.',
  'Sostén una idea y conecta tus experiencias con referencias de tiempo.',
  'Escucha, resume el argumento y desarrolla tu propia postura.',
  'Expresa las mismas ideas en rondas de cuatro, tres y dos minutos.',
  'Revisa tus errores prioritarios y practica la corrección en otro contexto.',
];

export function FluencyBlocks({
  current,
  disabled = false,
  variant = 'rail',
}: {
  current?: number;
  disabled?: boolean;
  variant?: 'rail' | 'cards';
}) {
  if (variant === 'cards') {
    return (
      <nav aria-label="Elegir bloque de la práctica B" className="fluency-block-grid">
        {BLOCKS.map(([title, duration, href], index) => (
          <Link key={href} href={href} className="fluency-block-card">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-primary font-semibold">Bloque {index + 1}</span>
              <span className="text-muted-foreground">{duration}</span>
            </div>
            <h2 className="mt-5 text-xl font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-6">{DESCRIPTIONS[index]}</p>
            <span className="text-primary mt-auto block pt-6 text-sm font-semibold">
              Elegir este bloque
            </span>
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <BlockRail
      label="Elegir bloque de la práctica B"
      current={current}
      blocks={BLOCKS.map(([title, duration, href], index) => ({
        label: `Bloque ${index + 1} · ${title}`,
        detail: disabled ? 'Termina la grabación o espera la revisión antes de cambiar.' : duration,
        href,
        disabled,
      }))}
    />
  );
}
