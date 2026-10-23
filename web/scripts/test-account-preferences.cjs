// Clerk's public composition API + real app logic; no sign-in, database or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
const { dependency } = require('./i18n-test-helpers.cjs');
function load(file, imports, globals = {}) {
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
        throw Error('Unexpected dependency: ' + name);
      },
      AbortController,
      ...globals,
    }
  );
  return exports;
}
const profile = require('../messages/es.json').profile;
const labels = { ...profile, form: profile };
let userId = 'user-a',
  requests = [];
const UserButton = Object.assign(
  function UserButton() {
    return null;
  },
  {
    MenuItems: 'clerk-menu',
    Action: 'clerk-action',
    UserProfilePage: 'clerk-page',
  }
);
const Form = () => null;
const button = load('components/auth/account-button.tsx', {
  '@clerk/nextjs': { UserButton, useUser: () => ({ user: { id: userId } }) },
  '@phosphor-icons/react/dist/ssr': { SlidersHorizontalIcon: () => null },
  '@/components/profile/account-preferences': { AccountPreferences: Form },
}).AccountButton;
let registration = button({ labels });
assert.equal(registration.type, UserButton);
const [menu, page] = registration.props.children;
const actions = menu.props.children;
assert.equal(actions[0].props.label, 'manageAccount');
assert.equal(actions[1].props.label, 'Preferencias');
assert.equal(actions[1].props.open, page.props.url);
assert.equal(page.props.url, 'preferences');
assert.equal(actions[2].props.label, 'signOut');
assert.equal(page.props.children.key, 'user-a');
userId = 'user-b';
registration = button({ labels });
assert.equal(
  registration.props.children[1].props.children.key,
  'user-b',
  'Switching Clerk accounts remounts preferences; no cross-account UI cache'
);
assert.equal(requests.length, 0, 'Avatar registration must not load preferences');

// The header has only practice/progress tabs, and passes translated copy down.
const shell = load('components/layout/app-shell.tsx', {
  'next-intl': dependency('next-intl'),
  'next/link': {
    __esModule: true,
    default: ({ children, ...props }) => jsx.jsx('a', { ...props, children }),
  },
  '@/components/auth/account-button': {
    AccountButton: ({ labels: copy }) => {
      assert.equal(copy.menu, 'Preferencias');
      return null;
    },
  },
  '@/components/layout/brand': { Brand: () => null },
  '@/components/layout/sign-out-button': { SignOutButton: () => null },
  '@/i18n/static-text': dependency('@/i18n/static-text'),
  '@/lib/shadcn/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
}).AppShell;
const header = renderToStaticMarkup(
  React.createElement(shell, { active: 'home', learner: { displayName: 'Demo' } })
);
assert.match(header, /href="\/home"/);
assert.match(header, /href="\/progress"/);
assert.doesNotMatch(
  header,
  /href="\/profile"/,
  'Preferences belong in the account menu, not a third navigation tab'
);

const state = [],
  effects = [];
let cursor = 0,
  queued = [],
  stateWrites = 0;
const hooks = {
  useState(initial) {
    const i = cursor++;
    if (!(i in state)) state[i] = initial;
    return [
      state[i],
      (next) => {
        stateWrites++;
        state[i] = typeof next === 'function' ? next(state[i]) : next;
      },
    ];
  },
  useEffect(fn, deps) {
    const i = cursor++,
      old = effects[i];
    if (!old || deps.some((value, n) => value !== old.deps[n]))
      queued.push(() => {
        old?.cleanup?.();
        effects[i] = { deps, cleanup: fn() };
      });
  },
};
let reply = { nativeLanguage: 'en', targetLanguage: 'en' },
  status = 200,
  held;
const panel = load(
  'components/profile/account-preferences.tsx',
  {
    react: hooks,
    '@/components/profile/profile-settings': { ProfileSettings: Form },
    '@/components/ui/skeleton': { Skeleton: () => null },
    '@/i18n/locales': { isAppLocale: (value) => value === 'es' || value === 'en' },
  },
  {
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (held)
        await new Promise((resolve) => {
          held = resolve;
        });
      return { ok: status === 200, json: async () => reply };
    },
  }
).AccountPreferences;
function render() {
  cursor = 0;
  const tree = panel({ labels });
  const work = queued;
  queued = [];
  work.forEach((fn) => fn());
  return tree;
}
function descendants(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(descendants)];
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
function reset() {
  effects.forEach((effect) => effect?.cleanup?.());
  state.length = 0;
  effects.length = 0;
  queued = [];
}
(async () => {
  let tree = render();
  assert.ok(descendants(tree).some((node) => node.props?.role === 'status'));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/profile');
  assert.equal(requests[0].options.cache, 'no-store');
  assert.equal(requests[0].options.body, undefined);
  await settle();
  tree = render();
  let form = descendants(tree).find((node) => node.type === Form);
  assert.equal(form.props.initial.nativeLanguage, 'en');
  assert.equal(form.props.embedded, true);
  assert.equal(requests.length, 1, 'Rerenders do not reload preferences');
  reset();
  status = 503;
  tree = render();
  await settle();
  tree = render();
  assert.ok(descendants(tree).some((node) => node.props?.role === 'alert'));
  assert.ok(
    !descendants(tree).some((node) => node.type === Form),
    'Failed load must not show fabricated default preferences'
  );
  status = 200;
  descendants(tree)
    .find((node) => node.type === 'button')
    .props.onClick();
  render();
  await settle();
  tree = render();
  assert.ok(
    descendants(tree).some((node) => node.type === Form),
    'Retry recovers the saved preferences'
  );
  reset();
  reply = { nativeLanguage: 'en', targetLanguage: 'es' };
  render();
  await settle();
  tree = render();
  assert.ok(
    !descendants(tree).some((node) => node.type === Form),
    'Learning language cannot be changed through malformed data'
  );
  reset();
  reply = { nativeLanguage: 'es', targetLanguage: 'en' };
  held = true;
  render();
  const pending = requests.at(-1),
    before = stateWrites;
  reset();
  assert.equal(pending.options.signal.aborted, true);
  held();
  held = null;
  await settle();
  assert.equal(stateWrites, before, 'Late results must not update a closed account page');
  console.log(
    'PASS: official Clerk menu/page registration, translated copy, no profile tab, on-demand authenticated loading, retry, fixed English, account isolation and cancellation. No network.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
