const { dependency: i18nDependency } = require('./i18n-test-helpers.cjs');
// Render and exercise the real component with hook/network doubles. No audio or APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');

const slots = [],
  effects = [],
  intervals = new Set();
let cursor = 0,
  queued = [],
  tree;
const react = {
  useRef(value) {
    const i = cursor++;
    return (slots[i] ??= { current: value });
  },
  useState(value) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = value;
    return [
      slots[i],
      (next) => {
        slots[i] = typeof next === 'function' ? next(slots[i]) : next;
      },
    ];
  },
  useEffect(fn, deps) {
    const i = cursor++,
      old = effects[i];
    if (!old || deps.some((dep, n) => dep !== old.deps[n]))
      queued.push(() => {
        old?.cleanup?.();
        effects[i] = { deps, cleanup: fn() };
      });
  },
};
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      require(name) {
        if (i18nDependency(name)) return i18nDependency(name);
        assert.ok(name in imports, name);
        return imports[name];
      },
      Date,
      Object,
      FormData,
      localStorage: { getItem: () => null, setItem() {} },
      setInterval(fn) {
        intervals.add(fn);
        return fn;
      },
      clearInterval(fn) {
        intervals.delete(fn);
      },
      ...globals,
    }
  );
  return exports;
}
const helpers = load('lib/time-shifting.ts', {});
let starts = 0,
  finishes = 0,
  releaseStart,
  failReview = false;
const requests = [];
const call = {
  capturing: false,
  connected: false,
  pending: false,
  ready: false,
  text: '',
  error: '',
  async start(language, agentName) {
    starts++;
    assert.equal(language, 'es');
    assert.equal(agentName, 'test-agent');
    if (releaseStart !== false)
      await new Promise((resolve) => {
        releaseStart = resolve;
      });
    call.connected = true;
    call.capturing = true;
    call.text = '';
    return true;
  },
  async finish() {
    finishes++;
    call.capturing = false;
    return call.text || 'I work every day.';
  },
  async disconnect() {
    call.connected = false;
    call.capturing = false;
  },
};
const classes = Object.fromEntries(
  [
    'header',
    'title',
    'steps',
    'content',
    'setup',
    'preview',
    'routine',
    'actions',
    'connection',
    'spinner',
  ].map((name) => [name, `temporal-${name}`])
);
const { TimeShiftingDrill } = load(
  'components/practice/time-shifting-drill.tsx',
  {
    react,
    'react/jsx-runtime': jsx,
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => jsx.jsx('a', { ...props, children }),
    },
    '@/components/practice/continue-call-link': {
      ContinueCallLink: () =>
        jsx.jsx('a', { href: '/practice-b', children: 'Continuar con los bloques' }),
    },
    '@/components/practice/fluency-blocks': { FluencyBlocks: () => null },
    '@/hooks/use-drill-call': { useDrillCall: () => call },
    '@/lib/practice-options': { NATIVE_LANGUAGES: { es: 'Español', en: 'English' } },
    '@/lib/time-shifting': helpers,
    './time-shifting-drill.module.css': classes,
  },
  {
    fetch: async (url, options) => {
      assert.equal(url, '/api/time-shifting');
      requests.push(Object.fromEntries(options.body.entries()));
      if (failReview)
        return {
          ok: false,
          json: async () => ({ error: 'Inténtalo de nuevo; conservamos tu respuesta.' }),
        };
      return {
        ok: true,
        json: async () => ({
          text: options.body.get('text'),
          corrections: [],
          feedback: 'Buen intento. Sigue practicando.',
          saved: true,
        }),
      };
    },
  }
);
function render() {
  for (let pass = 0; pass < 3; pass++) {
    cursor = 0;
    tree = TimeShiftingDrill({ agentName: 'test-agent' });
    const tasks = queued;
    queued = [];
    tasks.forEach((task) => task());
  }
  return tree;
}
function all(element) {
  if (!arguments.length) element = tree;
  if (!element || typeof element !== 'object') return [];
  return [element, ...[element.props?.children].flat(Infinity).flatMap((child) => all(child))];
}
function text(element) {
  if (element == null || typeof element === 'boolean') return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  return [element?.props?.children]
    .flat(Infinity)
    .map((child) => text(child))
    .join('');
}
function button(label) {
  const result = all().find((item) => item.type === 'button' && text(item).includes(label));
  assert.ok(result, `Missing button: ${label}`);
  return result;
}
function html() {
  return renderToStaticMarkup(render());
}
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  render();
}
async function click(label) {
  const element = button(label);
  assert.ok(!element.props.disabled, `${label} is disabled`);
  element.props.onClick();
  await settle();
}
const previews = {};

(async () => {
  render();
  previews.setup = html();
  assert.equal(button('Empezar práctica').props.disabled, true);
  assert.doesNotMatch(
    previews.setup,
    /Conectar llamada|Terminé este paso|Continuar cronómetro|<textarea/
  );
  assert.equal(starts, 0);
  assert.equal(intervals.size, 0);
  all()
    .find((item) => item.type === 'input')
    .props.onChange({ target: { value: 'Preparar café, desayunar, trabajar' } });
  render();
  assert.equal(button('Empezar práctica').props.disabled, false);
  all()
    .find((item) => item.type === 'form')
    .props.onSubmit({ preventDefault() {} });
  await settle();
  assert.match(html(), /Preparando micrófono|Conectando y preparando/);
  assert.ok(button('Cancelar'));
  assert.equal(intervals.size, 0, 'The timer cannot run while connecting');
  releaseStart();
  releaseStart = false;
  await settle();
  assert.equal(starts, 1);
  assert.equal(call.capturing, true);
  assert.equal(intervals.size, 1);
  assert.ok(button('Terminar y ver correcciones'));
  assert.doesNotMatch(html(), /<input/);
  call.text = 'I work every day.';
  render();
  previews.speaking = html();
  assert.match(previews.speaking, /I work every day/);
  await click('Pausar cronómetro');
  assert.equal(intervals.size, 0);
  assert.equal(call.capturing, true, 'Pausing the clock must not cut speech');
  await click('Continuar cronómetro');
  failReview = true;
  await click('Terminar y ver correcciones');
  assert.match(html(), /I work every day/);
  assert.ok(button('Reintentar revisión'));
  assert.equal(intervals.size, 0);
  failReview = false;
  await click('Reintentar revisión');
  assert.equal(finishes, 1, 'Retry review must not reconnect or recapture');
  previews.review = html();
  assert.match(previews.review, /Revisión escrita/);
  assert.match(previews.review, /Preparar café, desayunar, trabajar/);
  assert.equal(requests[0].routine, 'Preparar café, desayunar, trabajar');
  await click('Continuar: B');
  assert.equal(starts, 2, 'One click starts the next round');
  assert.equal(call.capturing, true);
  assert.match(html(), /2:00/);
  call.text = 'I worked yesterday.';
  render();
  await click('Terminar y ver correcciones');
  assert.equal(requests.at(-1).step, '1');
  assert.equal(requests.at(-1).previousPresent, 'I work every day.');
  await click('Continuar: C');
  call.text = 'I have worked today.';
  render();
  await click('Terminar y ver correcciones');
  await click('Preparar otra rutina');
  assert.equal(starts, 3, 'Final round waits for the second routine');
  assert.equal(all().find((item) => item.type === 'input').props.value, '');
  assert.equal(button('Empezar última ronda').props.disabled, true);
  all()
    .find((item) => item.type === 'input')
    .props.onChange({ target: { value: 'Caminar, cocinar, leer' } });
  render();
  all()
    .find((item) => item.type === 'form')
    .props.onSubmit({ preventDefault() {} });
  await settle();
  call.text = 'I read every day.';
  render();
  await click('Terminar y ver correcciones');
  assert.equal(requests.at(-1).routine, 'Caminar, cocinar, leer');
  assert.equal(
    requests.at(-1).previousPresent,
    '',
    'A different routine must not inherit the first answer'
  );
  assert.match(html(), /Continuar con los bloques/);
  effects.forEach((effect) => effect?.cleanup?.());
  assert.equal(intervals.size, 0);
  console.log(
    'PASS: routine-first single action, loading before timer, automatic next rounds, retained review retry and second routine. No APIs.'
  );

  if (process.argv.includes('--preview')) {
    const path = require('node:path');
    const cssFiles = fs.readdirSync('.next/static/css').filter((name) => name.endsWith('.css'));
    const compiled = cssFiles
      .map((name) => fs.readFileSync(path.join('.next/static/css', name), 'utf8'))
      .join('\n');
    const css = fs
      .readFileSync('components/practice/time-shifting-drill.module.css', 'utf8')
      .replace(
        /\.(header|title|steps|content|setup|preview|routine|actions|connection|spinner)\b/g,
        (_, name) => '.' + classes[name]
      );
    const server = require('node:http')
      .createServer((req, res) => {
        const state = new URL(req.url, 'http://localhost').searchParams.get('state') || 'setup';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gimnasia temporal · vista local sin micrófono</title><style>${compiled}\n${css}</style><body>${previews[state] || previews.setup}</body></html>`
        );
      })
      .listen(0, '127.0.0.1', () =>
        console.log(`Preview: http://127.0.0.1:${server.address().port}`)
      );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
