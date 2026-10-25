const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(path, imports, env = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    process: { env },
    Buffer,
    URL,
  });
  return exports;
}

(async () => {
  const env = {};
  const config = compile('lib/auth-config.ts', {}, env);
  assert.equal(config.clerkConfiguration().configured, false);

  let middlewareCalls = 0;
  let middlewareOptions;
  const middleware = compile(
    'middleware.ts',
    {
      'next/server': { NextResponse: { next: () => 'setup-only' } },
      '@clerk/nextjs/server': {
        clerkMiddleware: (_handler, options) => (request) => {
          middlewareCalls++;
          middlewareOptions = options(request);
          return 'clerk-context';
        },
      },
      '@/lib/auth-config': config,
    },
    env
  );
  assert.equal(middleware.default({}, {}), 'setup-only');
  assert.equal(middlewareCalls, 0);
  env.CLERK_AUTHORIZED_PARTIES = ' , ';
  assert.equal(config.clerkAuthorizedParties()[0], 'http://localhost:3000');

  const learners = compile('lib/learners.ts', {});
  const rows = new Map();
  const legacy = { id: 'legacy-uuid', display_name: 'Ana', clerk_user_id: null };
  let queries = 0;
  const sql = async (strings, ...values) => {
    queries++;
    const query = strings.join('?');
    if (query.includes('INSERT INTO learners')) {
      // Mimic the unique-index upsert under parallel provisioning.
      if (!rows.has(values[0]))
        rows.set(values[0], {
          id: `uuid-${rows.size + 1}`,
          clerk_user_id: values[0],
          display_name: values[1],
        });
      return [rows.get(values[0])];
    }
    assert.ok(query.includes('WHERE clerk_user_id ='));
    return rows.has(values[0]) ? [rows.get(values[0])] : [];
  };
  let subject = null,
    profileCalls = 0,
    authCalls = 0,
    dbAvailable = true;
  const session = compile(
    'lib/session.ts',
    {
      '@clerk/nextjs/server': {
        auth: async () => {
          authCalls++;
          return { userId: subject };
        },
        currentUser: async () => {
          profileCalls++;
          return { id: subject, fullName: 'Ana' };
        },
      },
      react: { cache: (fn) => fn },
      crypto: require('node:crypto'),
      '@/lib/auth-config': config,
      '@/lib/db': { getDb: () => (dbAvailable ? sql : null) },
      '@/lib/learners': learners,
    },
    env
  );
  assert.equal(await session.currentLearnerId(), null);
  assert.equal(authCalls, 0); // Missing configuration never activates keyless mode.
  env.CLERK_PUBLISHABLE_KEY = 'pk_test_fake';
  env.CLERK_SECRET_KEY = 'sk_test_fake';
  assert.equal(middleware.default({}, {}), 'clerk-context');
  assert.equal(middlewareOptions.publishableKey, 'pk_test_fake');
  assert.equal('secretKey' in middlewareOptions, false); // No dynamic-secret encryption requirement.
  assert.equal('secretKey' in config.clerkConfiguration(), false);
  const nativeRequest = (path, method = 'GET', extraHeaders = {}) =>
    new Request(`https://tutor.example.com${path}`, {
      method,
      headers: { authorization: 'Bearer header.payload.signature', ...extraHeaders },
    });
  for (const [path, method] of [
    ['/api/token', 'POST'],
    ['/api/time-shifting', 'POST'],
    ['/api/profile', 'GET'],
    ['/api/profile', 'PATCH'],
    ['/api/progress', 'GET'],
    ['/api/mobile-progress', 'GET'],
    ['/api/practice-journal', 'GET'],
  ]) {
    const request = nativeRequest(path, method);
    assert.equal(config.isNativeBearerRequest(request), true);
    assert.equal(middleware.default(request, {}), 'clerk-context');
    assert.equal(middlewareOptions.authorizedParties, undefined);
  }
  for (const request of [
    nativeRequest('/home'),
    nativeRequest('/api/time-shifting', 'POST', { cookie: 'session=anything' }),
    nativeRequest('/api/time-shifting', 'POST', { origin: 'https://untrusted.example' }),
    nativeRequest('/api/progress', 'PATCH'),
    nativeRequest('/api/mobile-progress', 'POST'),
    nativeRequest('/api/mobile-progress', 'GET', { origin: 'https://untrusted.example' }),
    nativeRequest('/api/profile', 'PATCH', { origin: 'https://untrusted.example' }),
    nativeRequest('/api/profile', 'PATCH', { cookie: '__session=anything' }),
    nativeRequest('/api/token', 'POST', { cookie: '__session=anything' }),
    nativeRequest('/api/token', 'POST', { origin: 'https://untrusted.example' }),
    nativeRequest('/api/token', 'POST', { origin: '' }),
    nativeRequest('/api/token', 'POST', { authorization: 'Bearer malformed' }),
  ]) {
    assert.equal(config.isNativeBearerRequest(request), false);
    middleware.default(request, {});
    assert.equal(middlewareOptions.authorizedParties[0], 'http://localhost:3000');
  }
  env.APP_PASSCODE = 'legacy-passcode';
  env.LIVEKIT_API_SECRET = 'legacy-secret';
  assert.equal(await session.currentLearnerId(), null); // Legacy secrets cannot sign in.
  assert.equal(queries, 0); // No session means no profile reads or writes.
  subject = 'user_a';
  const a = await session.currentLearnerId();
  assert.equal(await session.currentLearnerId(), a);
  assert.equal(profileCalls, 1); // Normal requests need no profile API call.
  subject = 'user_b';
  const b = await session.currentLearnerId();
  assert.notEqual(a, b); // Same display name, different identity and progress.
  assert.notEqual(a, legacy.id);
  assert.equal(legacy.clerk_user_id, null);
  subject = 'user_a';
  assert.equal(await session.currentLearnerId(), a); // New device/session, same subject.
  // Even an obsolete environment restriction cannot block a registered account.
  env.CLERK_ALLOWED_USER_IDS = 'user_b';
  assert.equal(await session.currentLearnerId(), a);
  subject = null;
  assert.equal(await session.currentLearnerId(), null); // A signed-out user is still denied.
  subject = 'user_a';
  dbAvailable = false;
  assert.equal(await session.currentLearnerId(), null); // No untracked calls.
  const parallel = await Promise.all([
    learners.resolveClerkLearner(sql, 'user_c', async () => 'Ana'),
    learners.resolveClerkLearner(sql, 'user_c', async () => 'Ana'),
  ]);
  assert.equal(parallel[0], parallel[1]);

  const response = { 'next/server': { NextResponse: { json: Response.json.bind(Response) } } };
  assert.equal((await compile('app/api/login/route.ts', response).POST()).status, 410);
  assert.equal((await compile('app/api/logout/route.ts', response).POST()).status, 410);

  let active = a;
  const progress = compile('app/api/progress/route.ts', {
    ...response,
    '@/lib/session': { currentLearnerId: async () => active },
    '@/lib/db': { getDb: () => sql },
    '@/lib/progress/summary': { buildSummary: async (_sql, id) => ({ learner: id }) },
  });
  const request = new Request(`http://localhost/api/progress?learnerId=${b}`);
  assert.equal((await (await progress.GET(request)).json()).learner, a);
  active = b;
  assert.equal((await (await progress.GET(request)).json()).learner, b);
  active = null;
  assert.equal((await progress.GET(request)).status, 401);

  const journal = compile('app/api/practice-journal/route.ts', {
    ...response,
    '@/lib/session': { currentLearnerId: async () => active },
    '@/lib/db': { getDb: () => async (_query, id) => [{ entry: { owner: id } }] },
  });
  for (const id of [a, b]) {
    active = id;
    const result = await journal.GET(request);
    assert.equal((await result.json()).entries[0].owner, id);
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
  }
  active = null;
  assert.equal((await journal.GET(request)).status, 401);
  console.log(
    'PASS: self-service Clerk accounts, session checks, isolated profiles/progress, legacy rejection and concurrent provisioning. No network.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
