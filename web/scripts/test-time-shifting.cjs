const { dependency: i18nDependency } = require('./i18n-test-helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function compile(path, imports, globals = {}) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) =>
      name === '@/lib/correction-provider'
        ? compile('lib/correction-provider.ts', {}, globals)
        : (imports[name] ?? i18nDependency(name)),
    process: { env: { DEEPSEEK_API_KEY: 'test', GROQ_API_KEY: 'test' } },
    crypto: require('node:crypto').webcrypto,
    Buffer,
    URL,
    Request,
    Response,
    File,
    FormData,
    AbortSignal,
    console: { warn() {} },
    ...globals,
  });
  return exports;
}
const helpers = compile('lib/time-shifting.ts', {});
assert.equal(
  helpers.DRILL_STEPS.reduce((total, step) => total + step.seconds, 0),
  420
);
assert.equal(helpers.AGILITY_ROUNDS.map((step) => step.seconds).join(','), '240,180,120');
const corrections = helpers.validateCorrections(
  [
    {
      original: 'I work yesterday',
      corrected: 'I worked yesterday',
      explanation: 'Pasado',
      pattern: 'Past simple',
    },
    { original: 'invented quote', corrected: 'no', explanation: 'No', pattern: 'No' },
  ],
  'I work yesterday'
);
assert.equal(corrections.length, 1);
let authenticated = true;
let nativeLanguage = 'es',
  sentPrompt = '';
let calls = 0;
let recent = 0;
const writes = [];
let cached = null;
const correctionEnv = { DEEPSEEK_API_KEY: 'test', GROQ_API_KEY: 'test', GOOGLE_API_KEY: 'test' };
let providerFailure = false;
const route = compile(
  'app/api/time-shifting/route.ts',
  {
    'node:crypto': require('node:crypto'),
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/session': { currentLearnerId: async () => (authenticated ? 'learner-test' : null) },
    '@/lib/db': {
      getDb:
        () =>
        async (strings, ...values) => {
          if (strings.join('').includes("entry->>'cache_key'"))
            return cached?.cache_key === values[1] ? [{ entry: cached }] : [];
          if (strings.join('').includes('SELECT')) return [{ recent, daily: 0 }];
          const entry = JSON.parse(values[3]);
          if (entry.kind === 'drill_review' && !entry.reused) cached = entry;
          writes.push(values);
          return [];
        },
    },
    '@/lib/practice-options': { NATIVE_LANGUAGES: { es: 'Español', en: 'English' } },
    '@/lib/preferences': {
      currentPreferences: async () => ({ nativeLanguage, targetLanguage: 'en' }),
    },
    '@/lib/time-shifting': helpers,
  },
  {
    process: { env: correctionEnv },
    fetch: async (url, options) => {
      calls++;
      if (url.includes('/audio/transcriptions')) return Response.json({ text: 'I work yesterday' });
      const body = JSON.parse(options.body);
      sentPrompt = body.messages?.[0].content || body.systemInstruction?.parts[0].text;
      if (providerFailure) return Response.json({ secret: 'must-not-leak' }, { status: 429 });
      if (url.includes('generativelanguage.googleapis.com'))
        return Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [{ text: JSON.stringify({ corrections, feedback: 'Revisa el pasado.' }) }],
              },
            },
          ],
        });
      return Response.json({
        choices: [
          { message: { content: JSON.stringify({ corrections, feedback: 'Revisa el pasado.' }) } },
        ],
      });
    },
  }
);
function request(origin = 'http://localhost:3000', reference = '') {
  const body = new FormData();
  body.set('step', '1');
  body.set('routine', 'work');
  body.set('text', 'I work yesterday');
  body.set('previousPresent', reference);
  body.set('nativeLanguage', 'es');
  return new Request('http://localhost:3000/api/time-shifting', {
    method: 'POST',
    headers: { origin },
    body,
  });
}
(async () => {
  authenticated = false;
  assert.equal((await route.POST(request())).status, 401);
  authenticated = true;
  assert.equal((await route.POST(request('http://evil.test'))).status, 403);
  recent = 3;
  assert.equal((await route.POST(request())).status, 429);
  assert.equal(calls, 0);
  recent = 0;
  const response = await route.POST(request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.saved, true);
  assert.equal(result.attempt_type, 'repetition');
  assert.equal(result.kind, 'drill_review');
  assert.equal(result.corrections.length, 1);
  assert.equal(calls, 1);
  assert.equal(writes.length, 2);
  const reused = await route.POST(request());
  assert.equal((await reused.json()).reused, true);
  assert.equal(calls, 1);
  assert.equal(writes.length, 3);
  const changedContext = await route.POST(request('http://localhost:3000', 'I work daily.'));
  assert.equal(changedContext.status, 200);
  assert.equal(calls, 2);
  assert.equal(writes.length, 5);
  function audioRequest() {
    const body = new FormData();
    body.set('step', '0');
    body.set('routine', 'work');
    body.set('audio', new File(['simulated audio bytes'], 'answer.webm', { type: 'audio/webm' }));
    return new Request('http://localhost:3000/api/time-shifting', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      body,
    });
  }
  assert.equal((await route.POST(audioRequest())).status, 200);
  assert.equal(calls, 4);
  assert.equal((await (await route.POST(audioRequest())).json()).reused, true);
  assert.equal(calls, 4); // no extra Whisper OR DeepSeek call
  function agilityRequest(exercise = 'agility', step = '1') {
    const body = new FormData();
    body.set('exercise', exercise);
    body.set('step', step);
    body.set('routine', 'work');
    body.set('text', 'I work yesterday');
    return new Request('http://localhost:3000/api/time-shifting', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      body,
    });
  }
  const agility = await (await route.POST(agilityRequest())).json();
  assert.equal(agility.block, 4);
  assert.equal(agility.exercise, 'agility');
  assert.equal(agility.attempt_type, 'repetition');
  assert.equal(agility.saved, true);
  assert.equal(calls, 5); // Different exercise must not reuse the tense-drill cache.
  assert.equal((await (await route.POST(agilityRequest())).json()).reused, true);
  assert.equal(calls, 5);
  assert.equal((await route.POST(agilityRequest('unknown'))).status, 400);
  assert.equal((await route.POST(agilityRequest('agility', '3'))).status, 400);
  nativeLanguage = 'en';
  assert.equal((await route.POST(request())).status, 200);
  assert.match(sentPrompt, /Explain in English; examples\/corrections in English/);
  assert.equal(calls, 6, 'A different saved profile language must not reuse the previous review');
  const keys = new Set();
  for (const provider of ['groq', 'google', 'deepseek']) {
    correctionEnv.CORRECTION_PROVIDER = provider;
    correctionEnv.CORRECTION_MODEL = 'independent-correction-model';
    const before = calls;
    const reviewed = await (await route.POST(request())).json();
    assert.equal(reviewed.provider, provider);
    assert.equal(reviewed.model, 'independent-correction-model');
    assert.equal(reviewed.corrections.length, 1);
    assert.equal(calls, before + 1, 'changing provider must not reuse another provider review');
    keys.add(reviewed.cache_key);
    assert.equal((await (await route.POST(request())).json()).reused, true);
    assert.equal(calls, before + 1);
  }
  assert.equal(keys.size, 3);
  providerFailure = true;
  const beforeFailure = calls;
  const failed = await route.POST(request('http://localhost:3000', 'different context'));
  assert.equal(failed.status, 502);
  assert(!JSON.stringify(await failed.json()).includes('must-not-leak'));
  assert.equal(calls, beforeFailure + 1, 'no automatic retry or fallback');
  providerFailure = false;
  assert.equal(
    (await route.POST(request('http://localhost:3000', 'different context'))).status,
    200
  );
  correctionEnv.CORRECTION_PROVIDER = 'google';
  delete correctionEnv.GOOGLE_API_KEY;
  const beforeMissing = calls;
  assert.equal((await route.POST(request())).status, 503);
  assert.equal(calls, beforeMissing, 'missing selected key must not use available DeepSeek key');
  console.log(
    'PASS: 7-minute schedule, quote validation, authentication, origin, rate limit and saved text-only review. No real API calls.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
