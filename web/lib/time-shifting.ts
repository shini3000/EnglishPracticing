export const DRILL_STEPS = [
  {
    label: 'A · Presente',
    seconds: 60,
    instruction: 'Describe 3–4 acciones de tu rutina en presente simple o continuo.',
  },
  {
    label: 'B · Pasado terminado',
    seconds: 120,
    instruction:
      'Narra las mismas acciones como algo ocurrido el año pasado. Usa pasado simple o continuo.',
  },
  {
    label: 'C · Experiencia acumulada',
    seconds: 120,
    instruction:
      'Transforma las mismas acciones en experiencia hasta hoy usando present perfect, sin fechas de pasado terminado.',
  },
  {
    label: 'D · Segundo ejemplo cotidiano',
    seconds: 120,
    instruction: 'Elige otra rutina y exprésala en presente, pasado y present perfect.',
  },
] as const;

export const AGILITY_ROUNDS = [
  {
    label: 'Ronda de 4 minutos',
    seconds: 240,
    instruction: 'Develop an answer to the open question freely for four minutes.',
  },
  {
    label: 'Ronda de 3 minutos',
    seconds: 180,
    instruction:
      'Retell the SAME ideas in three minutes, removing digressions and improving connections.',
  },
  {
    label: 'Ronda de 2 minutos',
    seconds: 120,
    instruction: 'Retell the SAME core argument concisely in two minutes.',
  },
] as const;

export type DrillCorrection = {
  original: string;
  corrected: string;
  explanation: string;
  pattern: string;
};

export function validateCorrections(value: unknown, text: string): DrillCorrection[] {
  if (!Array.isArray(value)) throw new Error('Invalid corrections');
  return value.slice(0, 4).flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const c = row as Record<string, unknown>;
    if (
      !['original', 'corrected', 'explanation', 'pattern'].every(
        (k) =>
          typeof c[k] === 'string' && (c[k] as string).trim() && (c[k] as string).length <= 1000
      )
    )
      return [];
    if (!text.includes(c.original as string) || c.original === c.corrected) return [];
    return [c as DrillCorrection];
  });
}
