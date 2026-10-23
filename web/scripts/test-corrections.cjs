const { dependency: i18nDependency } = require('./i18n-test-helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      require(name) {
        if (i18nDependency(name)) return i18nDependency(name);
        if (name === 'react/jsx-runtime') return jsx;
        assert.ok(name in imports, `Unexpected dependency: ${name}`);
        return imports[name];
      },
      Intl,
      Date,
      Map,
    }
  );
  return exports;
}
const history = load('lib/correction-history.ts');
const card = load('components/app/correction-card.tsx');
const { CorrectionsHistory } = load('components/app/corrections-history.tsx', {
  react: React,
  'next/link': ({ children, ...props }) => jsx.jsx('a', { ...props, children }),
  '@/components/app/correction-card': card,
  '@/lib/correction-history': history,
});
const first = {
  kind: 'correction',
  event_id: 'first',
  date: '2026-10-22',
  recorded_at: '2026-10-22T15:00:00Z',
  learner_text: 'I did went yesterday.',
  corrected_text: 'I went yesterday.',
  pattern: 'Past simple',
  explanation: 'No combines did con un verbo en pasado.',
  recovery_task: 'Cuenta otra acción de ayer.',
};
const second = {
  ...first,
  event_id: 'second',
  recorded_at: '2026-10-22T15:01:00Z',
  learner_text: 'She work every day.',
  corrected_text: 'She works every day.',
  pattern: 'Third person singular',
};
const third = {
  ...first,
  event_id: 'third',
  recorded_at: '2026-10-22T15:02:00Z',
  learner_text: 'I am agree.',
  corrected_text: 'I agree.',
  pattern: 'Agree',
};
const entries = history.mergeJournalEntries([second, first], [second, third]);
assert.equal(entries.length, 3);
assert.equal(entries.map((entry) => entry.event_id).join(','), 'first,second,third');
assert.equal(
  history.mergeJournalEntries(entries, [{ ...first, explanation: 'Updated' }])[0].explanation,
  'Updated'
);
assert.equal(
  history.mergeJournalEntries(entries, [{ ...first, event_id: 'new-attempt' }]).length,
  4,
  'Repeated words with a new event ID remain separate'
);
assert.equal(history.mergeJournalEntries([null, false, {}, []]).length, 0);
assert.equal(
  history.correctionHistory([...entries, { kind: 'drill_attempt', event_id: 'noise' }]).length,
  3
);
assert.equal(
  history.correctionHistory([
    {
      kind: 'drill_review',
      block: 4,
      event_id: 'round',
      corrections: [
        {
          original: 'I am agree.',
          corrected: 'I agree.',
          explanation: 'Agree es un verbo.',
          pattern: 'Agree',
        },
      ],
    },
  ])[0].source,
  'Bloque 4 · Rondas 4–3–2'
);
const html = renderToStaticMarkup(
  React.createElement(CorrectionsHistory, { entries, selectedDay: '2026-10-22' })
);
for (const quote of [first.learner_text, second.learner_text, third.learner_text])
  assert.ok(html.includes(quote));
assert.ok(html.indexOf(first.learner_text) > html.indexOf(third.learner_text));
assert.match(html, /Corrección 1/);
assert.match(html, /Corrección 3/);
assert.match(html, /Buscar una frase/);
assert.doesNotMatch(html, /Registro acumulativo|event_id|recorded_at|<pre/);
const hidden = renderToStaticMarkup(
  React.createElement(card.CorrectionCard, { entry: first, answersVisible: false })
);
assert.match(hidden, /I did went yesterday/);
assert.ok(!hidden.includes(first.corrected_text));
assert.ok(!hidden.includes(first.explanation));
assert.match(
  renderToStaticMarkup(
    React.createElement(CorrectionsHistory, { entries: [], available: false, queued: true })
  ),
  /pendiente de sincronizar/
);
assert.match(
  renderToStaticMarkup(React.createElement(CorrectionsHistory, { entries: [], loading: true })),
  /Cargando tus correcciones/
);
console.log(
  'PASS: live/history merging, deduplication, stable chronology, prior corrections, drill normalization and hidden answers. No network.'
);

const workspaceClasses = Object.fromEntries(
  ['layout', 'left', 'session', 'controls', 'corrections'].map((name) => [
    name,
    `call-workspace-${name}`,
  ])
);
const workspace = load('components/app/call-workspace.tsx', {
  './call-workspace.module.css': workspaceClasses,
});
let timerInjected = false,
  entriesInjected = false,
  feedbackReady = false;
const { PracticePanel } = load('components/app/practice-panel.tsx', {
  react: {
    useEffect() {},
    useState(initial) {
      if (Array.isArray(initial) && !entriesInjected) {
        entriesInjected = true;
        return React.useState(entries);
      }
      if (typeof initial === 'function') return React.useState('2026-10-22');
      if (initial === null && !timerInjected) {
        timerInjected = true;
        return React.useState({
          step: 'Monólogo con anclajes',
          step_index: 4,
          step_count: 16,
          block: 'Bloque 2 · Anclajes temporales',
          remaining_seconds: 512,
          elapsed_seconds: 88,
          step_duration_seconds: 600,
          running: true,
          started: true,
          finished: false,
          feedback_ready: feedbackReady,
        });
      }
      return React.useState(initial);
    },
  },
  'next/navigation': { useRouter: () => ({ push() {} }) },
  '@livekit/components-react': {
    useSessionContext: () => ({ isConnected: true, end() {} }),
    useDataChannel: () => ({ send() {}, isSending: false }),
  },
  '@/components/app/call-workspace': workspace,
  '@/components/app/corrections-history': { CorrectionsHistory },
  '@/components/app/practice-roadmap': { PracticeRoadmap: () => null },
  '@/lib/correction-history': history,
  '@/lib/practice-guidance': load('lib/practice-guidance.ts'),
});
const session = jsx.jsxs('section', {
  className: 'call-session-view bg-background flex flex-col items-center justify-center gap-5 p-8',
  children: [
    jsx.jsx('p', {
      className: 'text-muted-foreground text-sm',
      children: 'Prueba de la interfaz real · sin conexión de audio',
    }),
    jsx.jsx('h2', {
      className: 'text-2xl font-semibold',
      children: 'Tutor y controles de llamada',
    }),
  ],
});
function renderWorkspace() {
  timerInjected = false;
  entriesInjected = false;
  return renderToStaticMarkup(jsx.jsx(PracticePanel, { mode: 'fluency', children: session }));
}
const workspaceHtml = renderWorkspace();
assert.match(workspaceHtml, /<button[^>]*disabled=""[^>]*>Abrir bloque 3 sin llamada<\/button>/);
assert.match(workspaceHtml, /Terminé, dame mi feedback/);
feedbackReady = true;
assert.match(
  renderWorkspace(),
  /<button(?![^>]*\sdisabled=)[^>]*>Abrir bloque 3 sin llamada<\/button>/
);
feedbackReady = false;
assert.match(workspaceHtml, /data-call-layout="split"/);
assert.match(workspaceHtml, /call-workspace-left/);
assert.match(workspaceHtml, /call-workspace-corrections/);
assert.ok(
  workspaceHtml.indexOf('Tutor y controles') < workspaceHtml.indexOf('Tu práctica en curso')
);
assert.ok(
  workspaceHtml.indexOf('Tu práctica en curso') < workspaceHtml.indexOf('Tus correcciones')
);
assert.doesNotMatch(workspaceHtml, /sm:w-96|Mostrar última corrección/);
assert.match(
  fs.readFileSync('components/app/view-controller.tsx', 'utf8'),
  /<PracticePanel[\s\S]*<MotionSessionView/
);

if (process.argv.includes('--preview')) {
  const path = require('node:path');
  const cssRoot = process.env.PREVIEW_CSS_DIR || '.next/static/css';
  const compiled = fs
    .readdirSync(cssRoot, { recursive: true })
    .filter((name) => name.endsWith('.css'))
    .map((name) => fs.readFileSync(path.join(cssRoot, name), 'utf8'))
    .join('\n');
  const source = fs.readFileSync('styles/globals.css', 'utf8');
  const moduleCss = fs
    .readFileSync('components/app/call-workspace.module.css', 'utf8')
    .replace(/:global\(([^)]+)\)/g, '$1')
    .replace(
      /\.(layout|left|session|controls|corrections)\b/g,
      (_match, name) => '.' + workspaceClasses[name]
    );
  const css = compiled + source.slice(source.indexOf('.call-session-view {')) + moduleCss;
  assert.ok(moduleCss.includes('.call-workspace-layout {'));
  const content = renderWorkspace();
  const server = require('node:http').createServer((_request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(
      '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Correcciones · vista previa</title><style>' +
        css +
        '</style></head><body>' +
        content +
        '</body></html>'
    );
  });
  server.listen(0, '127.0.0.1', () =>
    console.log(`Preview: http://127.0.0.1:${server.address().port}`)
  );
}
