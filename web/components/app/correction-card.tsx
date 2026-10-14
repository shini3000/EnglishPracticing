type Correction = {
  [key: string]: unknown;
  learner_text?: unknown;
  corrected_text?: unknown;
  pattern?: unknown;
  explanation?: unknown;
  recovery_task?: unknown;
};

export function CorrectionCard({ entry }: { entry: Correction }) {
  const fields: [string, unknown][] = [
    ['Lo que dijiste', entry.learner_text],
    ['Frase corregida', entry.corrected_text],
    ['Estructura', entry.pattern],
    ['Por qué', entry.explanation],
    ['Ahora practica', entry.recovery_task],
  ];
  return (
    <section
      aria-label="Corrección escrita"
      className="mt-3 rounded-lg border border-blue-500/40 bg-blue-500/5 p-3"
    >
      <h2 className="font-semibold">Corrección escrita</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Lee la explicación y luego reformula sin mirar.
      </p>
      <dl className="mt-3 space-y-3">
        {fields.map(
          ([label, value]) =>
            typeof value === 'string' &&
            value.trim() && (
              <div key={String(label)}>
                <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
                <dd
                  className={
                    label === 'Estructura'
                      ? 'bg-muted mt-1 rounded p-2 font-mono text-sm break-words'
                      : 'mt-1 text-sm break-words whitespace-pre-wrap'
                  }
                >
                  {value}
                </dd>
              </div>
            )
        )}
      </dl>
    </section>
  );
}
