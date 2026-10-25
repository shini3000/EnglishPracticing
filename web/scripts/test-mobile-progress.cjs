const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { intl } = require('./i18n-test-helpers.cjs');
const cache = new Map();
function load(file, mocks = {}) {
  const full = path.resolve(file);
  if (cache.has(full)) return cache.get(full);
  const exports = {};
  cache.set(full, exports);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    Date,
    Intl,
    URL,
    Promise,
    console,
    require(name) {
      if (name in mocks) return mocks[name];
      const base = name.startsWith('@/')
        ? path.resolve(name.slice(2))
        : path.resolve(path.dirname(full), name);
      if (name.endsWith('.json')) return JSON.parse(fs.readFileSync(base, 'utf8'));
      return load(base + '.ts', mocks);
    },
  });
  return exports;
}
const analysis = load('lib/progress/analysis.ts');
const { mobileStatistics } = load('lib/progress/mobile.ts');
const sessions = Array.from({ length: 12 }, (_, index) => ({
  id: `session-${index}`,
  started_at: `2026-10-${String(index + 1).padStart(2, '0')}T15:00:00Z`,
  duration_seconds: 120,
  user_turns: 10,
  word_count: 100,
  unique_word_count: 50,
  type_token_ratio: 0.5,
  advanced_word_ratio: 0.1,
  new_word_count: 5,
  mean_sentence_length: 10,
  sentence_length_stdev: 2,
  complex_sentence_ratio: 0.2,
  words_per_minute: 50,
  filler_rate: 1,
  self_correction_rate: 1,
  question_ratio: 0.2,
  error_count: 0,
  errors_per_100_words: index === 11 ? null : 0,
  cefr_estimate: index === 11 ? null : 'B1',
  cefr_confidence: 0.7,
  summary: null,
}));
function fixture(id) {
  return {
    learner: { id, displayName: 'Test' },
    sessions,
    errors: [],
    parameters: analysis.buildParameters(sessions, []),
    totals: {
      sessions: 12,
      practiceMinutes: 24,
      wordsSpoken: 1200,
      vocabularySize: 50,
      currentStreakDays: 0,
    },
    level: analysis.estimateLevel([...sessions].reverse()),
    latestSummary: null,
    dataQuality: { gradedSessions: 11, ungradedSessions: 1 },
    strengths: [],
    weaknesses: [],
    recentCorrections: [],
  };
}
const summary = fixture('a');
const identity = (value) => value;
const message = (_value, fallback) => fallback;
const mobile = mobileStatistics(summary, 'last-5', identity, message);
assert.equal(mobile.window.sessions.length, 5);
assert.equal(mobile.window.sessions[0].id, 'session-11');
assert.equal(mobile.totals.sessions, 12, 'filtering never alters global totals');
const expected = analysis.buildParameters(sessions.slice(-5), []);
assert.equal(
  JSON.stringify(mobile.window.parameters.map((p) => p.points.map((x) => [x.value, x.smoothed]))),
  JSON.stringify(expected.map((p) => p.points.map((x) => [x.value, x.smoothed])))
);
const accuracy = mobile.parameters.find((p) => p.key === 'errors_per_100_words');
assert.equal(accuracy.points[0].value, 0);
assert.equal(accuracy.points[0].formatted, '0,0');
assert.equal(accuracy.points.at(-1).value, null);
assert.equal(accuracy.points.at(-1).formatted, null, 'ungraded measurements never become zero');
assert(mobile.trajectory);
const blank = {
  ...summary,
  sessions: [],
  parameters: analysis.buildParameters([], []),
  errors: [],
};
assert.equal(mobileStatistics(blank, 'all', identity, message).trajectory, null);
assert.throws(() => mobileStatistics(summary, 'other', identity, message));

let user = null,
  available = true,
  activityFails = false,
  summaryFails = false;
const owners = [];
const route = load('app/api/mobile-progress/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
  'next-intl/server': {
    getTranslations: async (options) => {
      assert.equal(options.locale, 'es');
      return intl('es').useTranslations('ui');
    },
  },
  '@/lib/session': { currentLearnerId: async () => user },
  '@/lib/db': { getDb: () => (available ? {} : null) },
  '@/lib/progress/summary': {
    buildSummary: async (_sql, id) => {
      owners.push(id);
      if (summaryFails) throw Error('private-error');
      return fixture(id);
    },
  },
  '@/lib/progress/learning': {
    buildLearningSummary: async (_sql, id) => {
      owners.push(id);
      return { available: false };
    },
  },
  '@/lib/progress/activity': {
    getActivity: async (_sql, id) => {
      owners.push(id);
      if (activityFails) throw Error('private-error');
      return [];
    },
  },
});
const request = (query = '') => new Request('https://example.com/api/mobile-progress' + query);
(async () => {
  assert.equal((await route.GET(request())).status, 401);
  assert.equal(owners.length, 0);
  user = 'a';
  for (const query of ['?window=bad', '?learnerId=b'])
    assert.equal((await route.GET(request(query))).status, 400);
  available = false;
  assert.equal((await route.GET(request())).status, 503);
  available = true;
  for (const id of ['a', 'b']) {
    user = id;
    owners.length = 0;
    const response = await route.GET(request('?window=last-5'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    const body = await response.json();
    assert.equal(body.statistics.learner.id, id);
    assert.equal(body.statistics.window.sessions.length, 5);
    assert(
      owners.every((owner) => owner === id),
      'all queries belong to the verified account'
    );
    assert.equal(body.learning.available, false, 'unavailable learning is not presented as zero');
  }
  activityFails = true;
  const partial = await (await route.GET(request())).json();
  assert.equal(partial.activity.available, false);
  assert.equal(partial.statistics.totals.sessions, 12);
  summaryFails = true;
  const failure = await route.GET(request());
  assert.equal(failure.status, 503);
  assert(!JSON.stringify(await failure.json()).includes('private-error'));
  console.log(
    'PASS: mobile statistics reuse web calculations, preserve nulls and global totals, translate UI to Spanish, isolate accounts and expose partial failures. No network or model calls.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
