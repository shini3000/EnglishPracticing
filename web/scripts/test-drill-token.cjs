const { dependency: i18nDependency } = require('./i18n-test-helpers.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let nativeLanguage = 'es';
let authenticated = true,
  options;
class Token {
  constructor(key, secret, value) {
    options = value;
  }
  addGrant() {}
  async toJwt() {
    return 'test-token';
  }
}
class NextResponse extends Response {
  static json(body, options) {
    return Response.json(body, options);
  }
}
const exportsObject = {};
const imports = {
  'next/server': { NextResponse },
  'livekit-server-sdk': { AccessToken: Token },
  '@livekit/protocol': { RoomConfiguration: class {} },
  '@/lib/avatars': {},
  '@/lib/db': {},
  '@/lib/practice-options': { NATIVE_LANGUAGES: { es: 'Español', en: 'English' } },
  '@/lib/preferences': {
    currentPreferences: async () => ({ nativeLanguage, targetLanguage: 'en' }),
  },
  '@/lib/session': { currentLearnerId: async () => (authenticated ? 'test-learner' : null) },
};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('app/api/token/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: exportsObject,
    require: (name) => imports[name] ?? i18nDependency(name),
    process: {
      env: {
        LIVEKIT_URL: 'wss://test.invalid',
        LIVEKIT_API_KEY: 'test',
        LIVEKIT_API_SECRET: 'test',
      },
    },
    crypto: require('node:crypto').webcrypto,
    Response,
    Headers,
    console,
  }
);
function request(mode, extra = {}) {
  return new Request('http://localhost/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capture: 'time-shifting',
      practiceMode: mode,
      nativeLanguage: 'es',
      ...extra,
    }),
  });
}
(async () => {
  authenticated = false;
  assert.equal((await exportsObject.POST(request('fluency'))).status, 401);
  authenticated = true;
  assert.equal((await exportsObject.POST(request('fluency'))).status, 200);
  assert.equal(options.attributes.practice_capture, 'time-shifting');
  assert.equal((await exportsObject.POST(request('fluency', { capture: 'agility' }))).status, 200);
  assert.equal(options.attributes.practice_capture, 'agility');
  await exportsObject.POST(request('daily', { capture: 'agility' }));
  assert.equal(options.attributes.practice_capture, '');
  await exportsObject.POST(request('fluency'));
  assert.equal(options.identity, 'learner_test-learner');
  nativeLanguage = 'en';
  await exportsObject.POST(request('fluency', { nativeLanguage: 'es' }));
  assert.equal(
    options.attributes.native_language,
    'en',
    'The signed token uses the saved profile, never an untrusted client override'
  );
  assert.equal(options.attributes.target_language, 'en');
  nativeLanguage = 'es';
  for (const startStep of [0, 4, 15]) {
    assert.equal((await exportsObject.POST(request('fluency', { startStep }))).status, 200);
    assert.equal(options.attributes.practice_start_step, String(startStep));
  }
  for (const startStep of [-1, 2, 5, 9, 16, '5', true]) {
    assert.equal((await exportsObject.POST(request('fluency', { startStep }))).status, 400);
  }
  assert.equal((await exportsObject.POST(request('daily', { startStep: 5 }))).status, 400);
  await exportsObject.POST(request('daily'));
  assert.equal(options.attributes.practice_capture, '');
  await exportsObject.POST(request('diagnostic'));
  assert.equal(options.attributes.practice_capture, '');
  console.log(
    'PASS: authentication and signed capture attribute restricted to practice B. No real tokens or network.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
