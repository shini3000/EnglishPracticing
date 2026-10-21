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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react/jsx-runtime') return jsx;
    if (!(name in imports)) throw new Error(`Unexpected dependency in ${file}: ${name}`);
    return imports[name];
  }, Intl, Date, Map, Set, Promise });
  return exports;
}

(async () => {
  const dates = load('lib/progress/dates.ts');
  const types = load('lib/progress/types.ts');
  const cefr = load('lib/progress/cefr.ts', { './types': types });
  const analysis = load('lib/progress/analysis.ts', {
    './dates': dates, './cefr': cefr, './parameters': { PARAMETERS: [] },
    './taxonomy.json': require('../lib/progress/taxonomy.json'),
  });
  const overview = load('lib/progress/overview.ts', { './analysis': analysis });
  const rows = [
    { started_at: new Date('2026-10-20T05:01:00Z'), duration_seconds: 120, cefr_estimate: 'B1', cefr_confidence: 0.8 },
    { started_at: '2026-10-20T01:00:00Z', duration_seconds: 120, cefr_estimate: null, cefr_confidence: null },
    { started_at: '2026-10-19T15:00:00Z', duration_seconds: 60, cefr_estimate: 'A2', cefr_confidence: 0.7 },
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
  const gate = new Promise(resolve => { release = resolve; });
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
    const waiting = new Promise(resolve => { complete = resolve; });
    let count = 0;
    const pending = load(file, imports)[exportName](async (_strings, id) => {
      assert.equal(id, 'verified-learner'); count++; await waiting; return [];
    }, 'verified-learner');
    await new Promise(setImmediate);
    assert.equal(count, 2);
    complete(); await pending;
  }

  const link = ({ href, children, ...props }) => jsx.jsx('a', { href, ...props, children });
  const forbiddenControl = () => { throw new Error('Loading shell must not need Clerk context'); };
  const shell = load('components/layout/app-shell.tsx', {
    'next/link': link,
    '@/components/auth/account-button': { AccountButton: forbiddenControl },
    '@/components/layout/brand': { Brand: () => jsx.jsx('span', { children: 'English Practicing' }) },
    '@/components/layout/sign-out-button': { SignOutButton: forbiddenControl },
    '@/lib/shadcn/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  });
  const skeleton = load('components/ui/skeleton.tsx', {
    '@/lib/shadcn/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  });
  const skeletons = load('components/layout/page-skeletons.tsx', {
    '@/components/layout/app-shell': shell, '@/components/ui/skeleton': skeleton,
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
  let overviewCalls = 0, authenticated = true;
  const learner = { id: 'verified-learner', displayName: 'Ana', username: 'ana' };
  const Overview = async () => { overviewCalls++; return new Promise(() => {}); };
  const Home = () => null;
  const page = load('app/home/page.tsx', {
    react: React, 'next/link': link, 'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/components/home/practice-home': { PracticeHome: Home },
    '@/components/home/practice-overview': { PracticeOverview: Overview },
    '@/components/layout/page-skeletons': skeletons,
    '@/lib/db': { getDb: () => async () => { throw new Error('Page must not query progress'); } },
    '@/lib/guard': { requireLearnerId: async () => {
      if (!authenticated) throw new Error('unauthenticated'); return learner.id;
    } },
    '@/lib/learners': { getLearner: async (_sql, id) => { assert.equal(id, learner.id); return learner; } },
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
    '@/lib/progress/overview': { buildPracticeOverview: async () => { throw new Error('database offline'); } },
  });
  const failure = renderToStaticMarkup(await panel.PracticeOverview({ sql: null, learnerId: learner.id }));
  assert.match(failure, /Puedes elegir una práctica/);
  assert.doesNotMatch(failure, /Todavía no hay sesiones/); // An outage is not zero history.
  console.log('PASS: one scoped overview query, consistent indicators, parallel progress reads, immediate skeletons, non-blocking practices and session checks. No network.');
  // Optional local-only visual fixture, using existing compiled CSS, never real user data.
  if (process.argv.includes('--preview')) {
    const path = require('node:path');
    const cssRoot = process.env.PREVIEW_CSS_DIR || '.next/static/css';
    const css = fs.readdirSync(cssRoot, { recursive: true })
      .filter(file => file.endsWith('.css'))
      .map(file => fs.readFileSync(path.join(cssRoot, file), 'utf8')).join('\n');
    const server = require('node:http').createServer((req, res) => {
      const active = req.url === '/home' ? 'home' : 'progress';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1">'
        + '<title>Loading preview</title><style>' + css + '</style></head><body>'
        + renderToStaticMarkup(jsx.jsx(skeletons.PageSkeleton, { active })) + '</body></html>');
    });
    server.listen(0, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${server.address().port}`));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
