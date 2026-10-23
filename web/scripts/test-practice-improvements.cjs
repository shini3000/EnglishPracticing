const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
function load(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
      Date,
      Intl,
      URL,
      Request,
      Response,
      ...globals,
    }
  );
  return exports;
}
const history = load('lib/correction-history.ts', {});
assert.equal(history.correctionDay('2026-10-24T04:59:59Z'), '2026-10-23');
assert.equal(history.correctionDay('2026-10-24T05:00:00Z'), '2026-10-24');
assert.equal(history.correctionDay('invalid'), '');
const items = [
  { id: 'old', date: '2026-10-23T06:00:00Z' },
  { id: 'new', date: '2026-10-24T04:00:00Z' },
  { id: 'other', date: '2026-10-24T05:00:00Z' },
];
assert.equal(
  history
    .correctionsForDay(items, '2026-10-23')
    .map((item) => item.id)
    .join(','),
  'new,old'
);
const alarm = load('lib/timer-alarm.ts', {}),
  state = { key: '', armed: false, notified: false };
const clock = (remaining, running = true, key = 'block-2', active = true) => ({
  remaining,
  running,
  key,
  active,
});
assert.equal(alarm.timerExpired(state, clock(0)), false);
assert.equal(alarm.timerExpired(state, clock(5)), false);
assert.equal(alarm.timerExpired(state, clock(0, false)), true);
for (let i = 0; i < 10; i++) assert.equal(alarm.timerExpired(state, clock(0, false)), false);
alarm.timerExpired(state, clock(10));
assert.equal(alarm.timerExpired(state, clock(0, false)), true);
assert.equal(alarm.timerExpired(state, clock(0, false, 'next-round')), false);
alarm.timerExpired(state, clock(10, true, 'next-round'));
assert.equal(alarm.timerExpired(state, clock(0, false, 'next-round', false)), false);
const starts = [],
  stops = [],
  peaks = [];
const context = {
  currentTime: 7,
  destination: {},
  state: 'running',
  createOscillator: () => ({
    frequency: { value: 0 },
    connect() {},
    disconnect() {},
    start: (t) => starts.push(t),
    stop: (t) => stops.push(t),
  }),
  createGain: () => ({
    gain: { setValueAtTime() {}, linearRampToValueAtTime: (value) => peaks.push(value) },
    connect() {},
    disconnect() {},
  }),
};
alarm.playTimerAlarm(context);
assert.equal(starts.join(','), '7,7.4');
assert.equal(stops.length, 2);
assert.equal(peaks.filter((value) => value > 0).length, 2);
// Exercise the actual browser hook with a quiet AudioContext double.
const slots = [],
  effects = [],
  listeners = new Map();
let cursor = 0,
  queued = [],
  closed = 0;
const hooks = {
  useRef(value) {
    const i = cursor++;
    return slots[i] ?? (slots[i] = { current: value });
  },
  useState(value) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = value;
    return [
      slots[i],
      (next) => {
        slots[i] = next;
      },
    ];
  },
  useCallback(fn) {
    const i = cursor++;
    return slots[i] ?? (slots[i] = fn);
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
class QuietContext {
  constructor() {
    Object.assign(this, context);
    this.state = 'suspended';
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    closed++;
  }
}
const timerHook = load(
  'hooks/use-timer-alarm.ts',
  { react: hooks, '@/lib/timer-alarm': alarm },
  {
    window: {
      AudioContext: QuietContext,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
    },
    AudioContext: QuietContext,
  }
).useTimerAlarm;
function renderAlarm(value) {
  cursor = 0;
  const result = timerHook(value),
    work = queued;
  queued = [];
  work.forEach((fn) => fn());
  return result;
}
let learner = 'learner-a',
  queries = [],
  fail = false;
const rows = Array.from({ length: 250 }, (_, index) => ({
  entry: { event_id: String(index), date: '2026-10-23' },
}));
const route = load('app/api/practice-journal/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
  '@/lib/session': { currentLearnerId: async () => learner },
  '@/lib/db': {
    getDb:
      () =>
      async (strings, ...values) => {
        if (fail) throw Error('offline');
        const query = strings.join('?');
        queries.push({ query, values });
        assert.equal(values[0], learner, 'Every query must be scoped to the authenticated learner');
        return query.includes('SELECT DISTINCT')
          ? [{ day: '2026-10-23' }, { day: '2026-10-21' }]
          : rows;
      },
  },
});
const request = (day) =>
  new Request(
    'http://localhost/api/practice-journal?day=' + encodeURIComponent(day) + '&learnerId=other-user'
  );
(async () => {
  starts.length = 0;
  let sound = renderAlarm(clock(3));
  assert.equal(sound.ready, false);
  assert.equal(starts.length, 0);
  await sound.enable();
  sound = renderAlarm(clock(3));
  assert.equal(sound.ready, true);
  renderAlarm(clock(0, false));
  renderAlarm(clock(0, false));
  assert.equal(starts.length, 2);
  renderAlarm(clock(0, false, 'other-step'));
  assert.equal(starts.length, 2);
  effects.forEach((effect) => effect?.cleanup?.());
  assert.equal(closed, 1);
  assert.equal(listeners.size, 0);
  learner = null;
  assert.equal((await route.GET(request('2026-10-23'))).status, 401);
  assert.equal(queries.length, 0);
  learner = 'learner-a';
  for (const day of ['2026-02-30', '2026-1-01', 'invalid', '2026-13-01', "2026-10-23' OR true"])
    assert.equal((await route.GET(request(day))).status, 400);
  assert.equal(queries.length, 0);
  let response = await route.GET(request('2026-10-23')),
    data = await response.json();
  assert.equal(data.available, true);
  assert.equal(data.day, '2026-10-23');
  assert.equal(
    data.entries.length,
    250,
    'Daily history must not be cut to the previous 200 global records'
  );
  assert.deepEqual(data.days, ['2026-10-23', '2026-10-21']);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const range = queries.find((item) => item.values.length === 3);
  assert.ok(range.query.includes('created_at >=') && range.query.includes('created_at <'));
  assert.ok(range.query.includes('America/Bogota'));
  assert.equal(range.values.slice(1).join(','), '2026-10-23,2026-10-23');
  learner = 'learner-b';
  await route.GET(request('2026-10-21'));
  fail = true;
  data = await (await route.GET(request('2026-10-23'))).json();
  assert.equal(data.available, false);
  console.log(
    'PASS: day pagination, Colombia midnight, newest-first corrections, complete daily history, account isolation, validated dates and exactly two non-repeating timer tones. No network or audio.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
