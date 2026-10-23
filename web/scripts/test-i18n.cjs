// Real catalogs, components and route logic; no Clerk, database, mic or model calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextResponse } = require('next/server');
const { intl, dependency } = require('./i18n-test-helpers.cjs');
const catalogs = { es: require('../messages/es.json'), en: require('../messages/en.json') };
const previews = {};
function RequiresIntlContext() {
  return require('next-intl').useTranslations('profile')('native');
}
assert.match(
  renderToStaticMarkup(
    React.createElement(
      require('next-intl').NextIntlClientProvider,
      { locale: 'es', messages: catalogs.es, timeZone: 'America/Bogota' },
      React.createElement(RequiresIntlContext)
    )
  ),
  /Idioma nativo/
);
assert.throws(
  () => renderToStaticMarkup(React.createElement(RequiresIntlContext)),
  Error,
  'The real library must reject a missing provider, so the profile regression cannot be hidden by a hook mock'
);
assert.deepEqual(Object.keys(catalogs.es.ui).sort(), Object.keys(catalogs.en.ui).sort());
assert.deepEqual(Object.keys(catalogs.es.profile).sort(), Object.keys(catalogs.en.profile).sort());
for (const locale of ['es', 'en'])
  for (const namespace of ['ui', 'profile']) {
    const t = intl(locale).useTranslations(namespace);
    for (const [key, value] of Object.entries(catalogs[locale][namespace])) {
      const values = Object.fromEntries(
        [...value.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => [m[1], 3])
      );
      values.verdict = 'improved';
      assert.equal(typeof t(key, values), 'string', `${locale}.${namespace}.${key}`);
    }
    if (namespace === 'profile') assert.match(t('title'), locale === 'es' ? /perfil/ : /profile/);
  }
function load(file, imports = {}, locale = 'es') {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
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
        if (name in imports) return imports[name];
        if (name === 'react/jsx-runtime') return jsx;
        if (name === 'react') return React;
        if (name === 'next/server') return { NextResponse };
        if (name === 'next/link')
          return {
            __esModule: true,
            default: ({ children, ...props }) => jsx.jsx('a', { ...props, children }),
          };
        if (name.startsWith('../messages/')) return require('../' + name.slice(3));
        const mock = dependency(name, locale);
        if (mock) return mock;
        throw Error(file + ': unexpected import ' + name);
      },
      URL,
      Request,
      Response,
      console: { warn() {} },
      process: { env: { NODE_ENV: 'test' } },
    }
  );
  return exports;
}
const locales = load('i18n/locales.ts');
let user = 'learner-a',
  writes = 0,
  available = true,
  cookie = 'en';
const saved = new Map();
const calls = [];
async function sql(strings, ...values) {
  const query = strings.join('?');
  calls.push({ query, values });
  if (query.includes('INSERT')) {
    writes++;
    saved.set(values[0], values[1]);
    return [];
  }
  if (query.includes('SELECT'))
    return saved.has(values[0]) ? [{ native_language: saved.get(values[0]) }] : [];
  throw Error('Unexpected SQL');
}
const session = { currentLearnerId: async () => user };
const db = { getDb: () => (available ? sql : null) };
const prefs = load('lib/preferences.ts', {
  react: { cache: (fn) => fn },
  '@/i18n/locales': locales,
  '@/lib/db': db,
  '@/lib/session': session,
});
const route = load('app/api/profile/route.ts', {
  '@/i18n/locales': locales,
  '@/lib/db': db,
  '@/lib/session': session,
  '@/lib/preferences': prefs,
});
function request(body, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}
(async () => {
  user = null;
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.PATCH(request({ nativeLanguage: 'en' }))).status, 401);
  assert.equal(writes, 0);
  user = 'learner-a';
  for (const body of [
    { nativeLanguage: 'fr' },
    { nativeLanguage: 'EN' },
    { nativeLanguage: 'en', targetLanguage: 'es' },
    { nativeLanguage: 'en', learnerId: 'learner-b' },
    null,
    [],
  ])
    assert.equal((await route.PATCH(request(body))).status, 400);
  assert.equal(
    (await route.PATCH(request({ nativeLanguage: 'en' }, 'https://untrusted.invalid'))).status,
    403
  );
  const invalid = new Request('http://localhost:3000/api/profile', {
    method: 'PATCH',
    headers: { origin: 'http://localhost:3000' },
    body: '{',
  });
  assert.equal((await route.PATCH(invalid)).status, 400);
  assert.equal(writes, 0);
  const response = await route.PATCH(request({ nativeLanguage: 'en', targetLanguage: 'en' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { nativeLanguage: 'en', targetLanguage: 'en' });
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.match(response.headers.get('set-cookie'), /app_locale=en/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.equal(calls.at(-1).values.join(','), 'learner-a,en,en');
  assert.equal((await (await route.GET()).json()).nativeLanguage, 'en');
  user = 'learner-b';
  assert.equal((await (await route.GET()).json()).nativeLanguage, 'es');
  const config = load('i18n/request.ts', {
    'next-intl/server': { getRequestConfig: (fn) => fn },
    'next/headers': { cookies: async () => ({ get: () => ({ value: cookie }) }) },
    '@/i18n/locales': locales,
    '@/lib/session': session,
    '@/lib/preferences': prefs,
  }).default;
  assert.equal(
    (await config()).locale,
    'es',
    'Signed-in accounts must ignore another account’s cookie'
  );
  user = 'learner-a';
  assert.equal((await config()).locale, 'en', 'Saved language must survive a new request');
  await route.PATCH(request({ nativeLanguage: 'es' }));
  assert.equal((await config()).locale, 'es');
  user = null;
  cookie = 'en';
  assert.equal((await config()).locale, 'en');
  cookie = 'fr';
  assert.equal((await config()).locale, 'es');
  user = 'learner-a';
  available = false;
  assert.equal((await route.PATCH(request({ nativeLanguage: 'en' }))).status, 503);
  available = true;
  const before = writes;
  for (const locale of ['es', 'en']) {
    const { ProfileSettings } = load(
      'components/profile/profile-settings.tsx',
      {
        // Use the real library, not our hook stub: no IntlProvider surrounds
        // this render. A context-dependent form must fail this regression.
        'next-intl': require('next-intl'),
        '@/i18n/locales': locales,
        'next/navigation': {
          useRouter: () => ({
            refresh() {
              throw Error('Rendering must not save');
            },
          }),
        },
      },
      locale
    );
    const html = renderToStaticMarkup(
      React.createElement(ProfileSettings, {
        initial: { nativeLanguage: locale, targetLanguage: 'en' },
        labels: catalogs[locale].profile,
      })
    );
    assert.equal((html.match(/<select/g) || []).length, 1, 'Only native language is selectable');
    assert.match(html, locale === 'es' ? /Idioma nativo/ : /Native language/);
    assert.match(html, locale === 'es' ? /Guardar preferencias/ : /Save preferences/);
    assert.match(html, /value="es"/);
    assert.match(html, /value="en"/);
    assert.doesNotMatch(html, /value="fr"/);
    const tp = intl(locale).useTranslations('profile');
    const brand = load(
      'components/layout/brand.tsx',
      { '@/lib/shadcn/utils': { cn: (...values) => values.filter(Boolean).join(' ') } },
      locale
    );
    const shell = load(
      'components/layout/app-shell.tsx',
      {
        '@/components/auth/account-button': { AccountButton: () => null },
        '@/components/layout/brand': brand,
        '@/components/layout/sign-out-button': { SignOutButton: () => null },
        '@/lib/shadcn/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
      },
      locale
    );
    previews[locale] = renderToStaticMarkup(
      React.createElement(
        shell.AppShell,
        { active: 'profile', learner: { displayName: 'Demo' } },
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'header',
            { className: 'mb-8 max-w-2xl' },
            React.createElement('h1', { className: 'study-title' }, tp('title')),
            React.createElement(
              'p',
              { className: 'text-muted-foreground mt-4 leading-7' },
              tp('description')
            )
          ),
          React.createElement(ProfileSettings, {
            initial: { nativeLanguage: locale, targetLanguage: 'en' },
            labels: catalogs[locale].profile,
          })
        )
      )
    );
    const blockRail = load('components/practice/block-rail.tsx', {}, locale);
    const { FluencyBlocks } = load(
      'components/practice/fluency-blocks.tsx',
      { '@/components/practice/block-rail': blockRail },
      locale
    );
    const blocks = renderToStaticMarkup(React.createElement(FluencyBlocks, { variant: 'cards' }));
    assert.match(blocks, locale === 'es' ? /Gimnasia temporal/ : /Time-shifting drill/);
    assert.match(blocks, locale === 'es' ? /Sin llamada/ : /No call/);
    assert.doesNotMatch(blocks, locale === 'es' ? /Time-shifting drill/ : /Gimnasia temporal/);
    const t = intl(locale).useTranslations('ui');
    assert.equal(
      t('correctionCount', { count: 1 }),
      locale === 'es' ? '1 corrección' : '1 correction'
    );
    assert.equal(t('dayCount', { count: 2 }), locale === 'es' ? '2 días' : '2 days');
    const { default: ProfilePage } = load(
      'app/profile/page.tsx',
      {
        '@/components/layout/app-shell': {
          AppShell: ({ children }) => jsx.jsx(React.Fragment, { children }),
        },
        '@/components/profile/profile-settings': { ProfileSettings },
        '@/lib/db': { getDb: () => ({}) },
        '@/lib/guard': { requireLearnerId: async () => 'test-learner' },
        '@/lib/learners': { getLearner: async () => ({ displayName: 'Test' }) },
        '@/lib/preferences': {
          currentPreferences: async () => ({ nativeLanguage: locale, targetLanguage: 'en' }),
        },
        'next/navigation': {
          redirect: () => {
            throw Error('Unexpected redirect');
          },
        },
      },
      locale
    );
    const pageHtml = renderToStaticMarkup(await ProfilePage());
    assert.match(
      pageHtml,
      locale === 'es' ? /Guardar preferencias/ : /Save preferences/,
      'The real server page must pass translated labels to the real client form without an intl context'
    );
  }
  assert.equal(writes, before, 'Rendering and switching UI must not write or invoke a model');
  for (const file of [
    'components/app/app.tsx',
    'components/practice/time-shifting-drill.tsx',
    'components/practice/agility-drill.tsx',
  ])
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      /localStorage\.(?:getItem|setItem)\('native-language'/
    );
  console.log(
    'PASS: ES/EN catalogs and ICU, real profile page/form without an intl context, profile validation, CSRF, account isolation, durable preferences, fixed English and no model calls.'
  );
  if (process.argv.includes('--preview')) {
    const path = require('node:path');
    const css = fs
      .readdirSync('.next/static/css')
      .filter((name) => name.endsWith('.css'))
      .map((name) => fs.readFileSync(path.join('.next/static/css', name), 'utf8'))
      .join('\n');
    const server = require('node:http').createServer((req, res) => {
      if (['/tutor-logo.svg', '/tutor-logo-dark.svg'].includes(req.url)) {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(fs.readFileSync('public' + req.url));
        return;
      }
      const locale = req.url === '/en' ? 'en' : 'es';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        `<!doctype html><html lang="${locale}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile · local component preview</title><style>${css}</style><body>${previews[locale]}</body></html>`
      );
    });
    server.listen(0, '127.0.0.1', () =>
      console.log('PREVIEW http://127.0.0.1:' + server.address().port + '/es')
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
