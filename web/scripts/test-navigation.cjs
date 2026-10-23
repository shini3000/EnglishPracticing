const { dependency: i18nDependency } = require('./i18n-test-helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (i18nDependency(name)) return i18nDependency(name);
      if (name === 'react/jsx-runtime') return jsx;
      if (!(name in imports)) throw new Error(`Unexpected dependency in ${file}: ${name}`);
      return imports[name];
    },
    Intl,
    Date,
    Map,
    Set,
    Promise,
  });
  return exports;
}

(async () => {
  const input = load('lib/input-replica.ts');
  assert.equal(
    input.INPUT_REPLICA_STEPS.reduce((sum, step) => sum + step.seconds, 0),
    900
  );
  let clock = input.inputClock(input.initialInputClock, { type: 'start', now: 1000 });
  clock = input.inputClock(clock, { type: 'pause', now: 121000 });
  assert.equal(clock.remaining, 180);
  clock = input.inputClock(clock, { type: 'tick', now: 999999 });
  assert.equal(clock.remaining, 180);
  clock = input.inputClock(clock, { type: 'start', now: 1000000 });
  clock = input.inputClock(clock, { type: 'tick', now: 2000000 });
  assert.equal(clock.remaining, 0);
  assert.equal(clock.deadline, null);
  assert.equal(clock.index, 0);
  for (let index = 1; index < 4; index++) {
    clock = input.inputClock(clock, { type: 'next' });
    assert.equal(clock.index, index);
    assert.equal(clock.deadline, null);
  }
  assert.equal(input.inputClock(clock, { type: 'next' }).finished, true);
  assert.equal(input.inputClock(clock, { type: 'reset' }).remaining, 240);
  const railLink = ({ href, children, ...props }) => jsx.jsx('a', { href, ...props, children });
  const blockRail = load('components/practice/block-rail.tsx', { 'next/link': railLink });
  const { InputReplica } = load('components/practice/input-replica.tsx', {
    react: { useReducer: (_reducer, initial) => [initial, () => {}], useEffect: () => {} },
    'next/link': railLink,
    '@/components/practice/fluency-blocks': { FluencyBlocks: () => null },
    '@/lib/input-replica': input,
  });
  const inputHtml = renderToStaticMarkup(React.createElement(InputReplica));
  assert.match(inputHtml, /Sin llamada/);
  assert.match(inputHtml, /5:00/);
  assert.match(inputHtml, /role="timer"/);
  assert.match(inputHtml, /practice-b\/agility/);
  const { AgilityDrill } = load('components/practice/agility-drill.tsx', {
    react: React,
    'next/link': railLink,
    '@/components/practice/fluency-blocks': { FluencyBlocks: () => null },
    '@/hooks/use-drill-call': {
      useDrillCall: (capture) => {
        assert.equal(capture, 'agility');
        return {
          connected: false,
          ready: false,
          capturing: false,
          pending: false,
          text: '',
          error: '',
        };
      },
    },
    '@/lib/practice-options': { NATIVE_LANGUAGES: { es: 'Español' } },
    '@/lib/time-shifting': load('lib/time-shifting.ts'),
  });
  const agilityHtml = renderToStaticMarkup(React.createElement(AgilityDrill));
  assert.match(agilityHtml, /no hay conversación ni voz del tutor/);
  assert.match(agilityHtml, /role="timer"/);
  assert.match(agilityHtml, /Pregunta abierta/);
  assert.match(agilityHtml, /Preparación opcional/);
  assert.match(agilityHtml, /gap-x-6/);
  assert.match(agilityHtml, /micrófono y la transcripción se activan al iniciar la ronda/);
  assert.doesNotMatch(agilityHtml, /<textarea/);
  const { PracticeRoadmap } = load('components/app/practice-roadmap.tsx', {
    '@/components/practice/block-rail': blockRail,
  });
  const route = [
    { label: 'Rutina', minutes: 1, block: 'Bloque 1', completed: false },
    { label: 'Monólogo', minutes: 10, block: 'Bloque 2', completed: false },
    { label: 'Escucha', minutes: 5, block: 'Bloque 3', completed: false },
  ];
  const roadmap = renderToStaticMarkup(
    React.createElement(PracticeRoadmap, { steps: route, current: 1, finished: false })
  );
  assert.match(roadmap, /Bloque 2 · Actual/);
  assert.match(roadmap, /aria-current="step"/);
  assert.match(roadmap, /Monólogo/);
  assert.match(roadmap, /Bloque 3/);
  assert.doesNotMatch(roadmap, /Registrado/);
  const finishedRoadmap = renderToStaticMarkup(
    React.createElement(PracticeRoadmap, { steps: route, current: 2, finished: true })
  );
  assert.doesNotMatch(finishedRoadmap, /aria-current/);
  const dates = load('lib/progress/dates.ts');
  const types = load('lib/progress/types.ts');
  const cefr = load('lib/progress/cefr.ts', { './types': types });
  const analysis = load('lib/progress/analysis.ts', {
    './dates': dates,
    './cefr': cefr,
    './parameters': { PARAMETERS: [] },
    './taxonomy.json': require('../lib/progress/taxonomy.json'),
  });
  const overview = load('lib/progress/overview.ts', { './analysis': analysis });
  const rows = [
    {
      started_at: new Date('2026-10-20T05:01:00Z'),
      duration_seconds: 120,
      cefr_estimate: 'B1',
      cefr_confidence: 0.8,
    },
    {
      started_at: '2026-10-20T01:00:00Z',
      duration_seconds: 120,
      cefr_estimate: null,
      cefr_confidence: null,
    },
    {
      started_at: '2026-10-19T15:00:00Z',
      duration_seconds: 60,
      cefr_estimate: 'A2',
      cefr_confidence: 0.7,
    },
  ];
  let queries = 0;
  const result = await overview.buildPracticeOverview(async (strings, ...values) => {
    queries++;
    const query = strings.join('?');
    assert.ok(query.includes('FROM sessions WHERE learner_id ='));
    assert.ok(query.includes('LIMIT 200'));
    assert.doesNotMatch(query, /session_errors|learner_vocabulary|SELECT\s+\*/i);
    assert.equal(values[0], 'verified-learner');
    return rows;
  }, 'verified-learner');
  assert.equal(queries, 1);
  assert.equal(result.sessions, 3);
  assert.equal(result.practiceMinutes, 5);
  assert.equal(result.currentStreakDays, 2); // Two same-day attempts are not extra practice days.
  assert.equal(result.level.band, analysis.estimateLevel(rows).band);
  assert.equal(result.level.isProvisional, true);
  const empty = await overview.buildPracticeOverview(async () => [], 'new-learner');
  assert.equal(empty.sessions, 0);
  assert.equal(empty.level.band, null);

  // The existing summary rules stay intact; its independent queries start together.
  const summary = load('lib/progress/summary.ts', { './analysis': analysis });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = [];
  const summaryResult = summary.buildSummary(async (strings, ...values) => {
    assert.equal(values[0], 'verified-learner');
    const query = strings.join('?');
    if (query.includes('FROM learners')) return [{ id: 'verified-learner', display_name: 'Ana' }];
    started.push(query);
    await gate;
    return [];
  }, 'verified-learner');
  await new Promise(setImmediate);
  assert.equal(started.length, 3);
  release();
  assert.equal((await summaryResult).totals.sessions, 0);

  for (const [file, exportName, imports] of [
    ['lib/progress/activity.ts', 'getActivity', { './dates': dates }],
    ['lib/progress/learning.ts', 'buildLearningSummary', {}],
  ]) {
    let complete;
    const waiting = new Promise((resolve) => {
      complete = resolve;
    });
    let count = 0;
    const pending = load(file, imports)[exportName](async (_strings, id) => {
      assert.equal(id, 'verified-learner');
      count++;
      await waiting;
      return [];
    }, 'verified-learner');
    await new Promise(setImmediate);
    assert.equal(count, 2);
    complete();
    await pending;
  }

  const link = ({ href, children, ...props }) => jsx.jsx('a', { href, ...props, children });
  const { FluencyBlocks } = load('components/practice/fluency-blocks.tsx', {
    'next/link': link,
    '@/components/practice/block-rail': blockRail,
  });
  const blockChoices = renderToStaticMarkup(React.createElement(FluencyBlocks, { current: 2 }));
  for (const target of ['/drill', 'anchors', 'input', 'agility', 'audit'])
    assert.ok(blockChoices.includes(target));
  assert.match(blockChoices, /aria-current="step"/);
  assert.match(blockChoices, /practice-block-rail/);
  assert.match(blockChoices, /practice-block-touch/);
  assert.match(blockChoices, /aria-label="Bloque 3/);
  const cards = renderToStaticMarkup(React.createElement(FluencyBlocks, { variant: 'cards' }));
  assert.match(cards, /fluency-block-grid/);
  assert.equal((cards.match(/class="fluency-block-card"/g) || []).length, 5);
  assert.doesNotMatch(cards, /practice-block-rail|practice-block-touch/);
  for (const target of ['/drill', 'anchors', 'input', 'agility', 'audit'])
    assert.ok(cards.includes(target));
  const lockedChoices = renderToStaticMarkup(
    React.createElement(FluencyBlocks, { current: 0, disabled: true })
  );
  assert.doesNotMatch(lockedChoices, /href=/);
  const forbiddenControl = () => {
    throw new Error('Loading shell must not need Clerk context');
  };
  const shell = load('components/layout/app-shell.tsx', {
    'next/link': link,
    '@/components/auth/account-button': { AccountButton: forbiddenControl },
    '@/components/layout/brand': {
      Brand: () => jsx.jsx('span', { children: 'English Practicing' }),
    },
    '@/components/layout/sign-out-button': { SignOutButton: forbiddenControl },
    '@/lib/shadcn/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  });
  const skeleton = load('components/ui/skeleton.tsx', {
    '@/lib/shadcn/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  });
  const callSkeleton = load('components/app/call-preparation-skeleton.tsx', {
    'next/link': link,
    '@/components/ui/skeleton': skeleton,
  });
  const callLoading = load('app/call/loading.tsx', {
    '@/components/app/call-preparation-skeleton': callSkeleton,
  });
  const callLoadingHtml = renderToStaticMarkup(jsx.jsx(callLoading.default, {}));
  assert.match(callLoadingHtml, /Cargando la preparación de tu llamada/);
  assert.match(callLoadingHtml, /aria-busy="true"/);
  assert.match(callLoadingHtml, /call-preparation-grid/);
  assert.match(callLoadingHtml, /La llamada no empezará/);
  assert.match(callLoadingHtml, /motion-safe:animate-pulse/);
  assert.doesNotMatch(callLoadingHtml, /<button|<select/); // No pretend controls or calls while loading.
  let navigating = false;
  const continueLink = load('components/practice/continue-call-link.tsx', {
    'next/link': {
      default: link,
      __esModule: true,
      useLinkStatus: () => ({ pending: navigating }),
    },
  });
  const renderContinue = () => renderToStaticMarkup(jsx.jsx(continueLink.ContinueCallLink, {}));
  assert.match(renderContinue(), /href="\/call\?practice=fluency&amp;start=anchors"/);
  assert.match(renderContinue(), /Continuar al bloque 2/);
  navigating = true;
  assert.match(renderContinue(), /Cargando la preparación de la llamada/);
  assert.match(renderContinue(), /aria-busy="true"/);
  navigating = false;
  assert.match(renderContinue(), /Continuar al bloque 2/); // No sticky state if router cancels.
  const skeletons = load('components/layout/page-skeletons.tsx', {
    '@/components/layout/app-shell': shell,
    '@/components/ui/skeleton': skeleton,
  });
  for (const active of ['home', 'progress']) {
    const html = renderToStaticMarkup(jsx.jsx(skeletons.PageSkeleton, { active }));
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /role="status"/);
    assert.match(html, /motion-safe:animate-pulse/);
    assert.match(html, /aria-current="page"/);
    assert.ok(html.includes(active === 'home' ? 'Cargando prácticas' : 'Cargando tu progreso'));
  }

  // Page construction must finish before the optional overview runs or finishes.
  let overviewCalls = 0,
    authenticated = true;
  const learner = { id: 'verified-learner', displayName: 'Ana', username: 'ana' };
  const Overview = async () => {
    overviewCalls++;
    return new Promise(() => {});
  };
  const Home = () => null;
  const page = load('app/home/page.tsx', {
    react: React,
    'next/link': link,
    'next/navigation': {
      redirect: () => {
        throw new Error('redirect');
      },
    },
    '@/components/home/practice-home': { PracticeHome: Home },
    '@/components/home/practice-overview': { PracticeOverview: Overview },
    '@/components/layout/page-skeletons': skeletons,
    '@/lib/db': {
      getDb: () => async () => {
        throw new Error('Page must not query progress');
      },
    },
    '@/lib/guard': {
      requireLearnerId: async () => {
        if (!authenticated) throw new Error('unauthenticated');
        return learner.id;
      },
    },
    '@/lib/learners': {
      getLearner: async (_sql, id) => {
        assert.equal(id, learner.id);
        return learner;
      },
    },
  });
  const home = await page.default();
  assert.equal(home.type, Home);
  assert.equal(home.props.overview.type, React.Suspense);
  assert.equal(home.props.overview.props.children.type, Overview);
  assert.equal(home.props.overview.props.children.props.learnerId, learner.id);
  assert.equal(overviewCalls, 0);
  authenticated = false;
  await assert.rejects(page.default(), /unauthenticated/);

  const panel = load('components/home/practice-overview.tsx', {
    '@/lib/progress/overview': {
      buildPracticeOverview: async () => {
        throw new Error('database offline');
      },
    },
  });
  const failure = renderToStaticMarkup(
    await panel.PracticeOverview({ sql: null, learnerId: learner.id })
  );
  assert.match(failure, /Puedes elegir una práctica/);
  assert.doesNotMatch(failure, /Todavía no hay sesiones/); // An outage is not zero history.
  console.log(
    'PASS: one scoped overview query, consistent indicators, parallel progress reads, immediate skeletons, non-blocking practices and session checks. No network.'
  );
  // Optional local-only visual fixture, using existing compiled CSS, never real user data.
  if (process.argv.includes('--preview')) {
    const path = require('node:path');
    const cssRoot = process.env.PREVIEW_CSS_DIR || '.next/static/css';
    const css = process.argv.includes('--fresh-css')
      ? (
          await require('node:module')
            .createRequire(require.resolve('@tailwindcss/postcss'))('postcss')([
              require('@tailwindcss/postcss')(),
            ])
            .process(fs.readFileSync('styles/globals.css', 'utf8'), {
              from: path.resolve('styles/globals.css'),
            })
        ).css
      : fs
          .readdirSync(cssRoot, { recursive: true })
          .filter((file) => file.endsWith('.css'))
          .map((file) => fs.readFileSync(path.join(cssRoot, file), 'utf8'))
          .join('\n');
    const server = require('node:http').createServer((req, res) => {
      const active = req.url === '/home' ? 'home' : 'progress';
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(
        '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<title>Loading preview</title><style>' +
          css +
          fs
            .readFileSync('styles/globals.css', 'utf8')
            .split('.fluency-block-grid {')[1]
            ?.replace(/^/, '.fluency-block-grid {') +
          '</style></head><body>' +
          (req.url === '/agility'
            ? renderToStaticMarkup(React.createElement(AgilityDrill))
            : req.url === '/input'
              ? renderToStaticMarkup(React.createElement(InputReplica))
              : req.url === '/blocks'
                ? renderToStaticMarkup(
                    jsx.jsxs('main', {
                      className: 'mx-auto max-w-2xl px-6 py-10',
                      children: [
                        jsx.jsx('h1', {
                          className: 'study-title',
                          children: 'Fluidez y resistencia',
                        }),
                        jsx.jsx(FluencyBlocks, { variant: 'cards' }),
                        jsx.jsx('p', {
                          className: 'mt-6',
                          children: 'Elige por dónde empezar o retoma el bloque donde te quedaste.',
                        }),
                      ],
                    })
                  )
                : renderToStaticMarkup(jsx.jsx(skeletons.PageSkeleton, { active }))) +
          '</body></html>'
      );
    });
    server.listen(0, '127.0.0.1', () =>
      console.log(`Preview: http://127.0.0.1:${server.address().port}`)
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
