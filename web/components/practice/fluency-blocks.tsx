import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { BlockRail } from '@/components/practice/block-rail';
import { translateStatic } from '@/i18n/static-text';

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
  const t = useTranslations('ui');

  if (variant === 'cards') {
    return (
      <nav aria-label={t('m7362694bbacc')} className="fluency-block-grid">
        {BLOCKS.map(([title, duration, href], index) => (
          <Link key={href} href={href} className="fluency-block-card">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-primary font-semibold">
                {t('mf8b1f3d598e5')} {index + 1}
              </span>
              <span className="text-muted-foreground">{translateStatic(t, duration)}</span>
            </div>
            <h2 className="mt-5 text-xl font-semibold">{translateStatic(t, title)}</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              {translateStatic(t, DESCRIPTIONS[index])}
            </p>
            <span className="text-primary mt-auto block pt-6 text-sm font-semibold">
              {t('m8ca4d58be9c0')}
            </span>
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <BlockRail
      label={t('m7362694bbacc')}
      current={current}
      blocks={BLOCKS.map(([title, duration, href], index) => ({
        label: `${t('mf8b1f3d598e5')} ${index + 1} · ${translateStatic(t, title)}`,
        detail: disabled ? t('finishRecording') : translateStatic(t, duration),
        href,
        disabled,
      }))}
    />
  );
}
