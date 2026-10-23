const { dependency: i18nDependency } = require('./i18n-test-helpers.cjs');
// Exercise the hook with SDK/React doubles: no microphone, network or paid API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const slots = [],
  effects = [],
  timers = new Set();
let cursor = 0,
  queued = [];
const react = {
  useRef(initial) {
    const i = cursor++;
    return (slots[i] ??= { current: initial });
  },
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [
      slots[i],
      (v) => {
        slots[i] = typeof v === 'function' ? v(slots[i]) : v;
      },
    ];
  },
  useEffect(fn, deps) {
    const i = cursor++,
      old = effects[i];
    if (!old || deps.some((d, n) => d !== old.deps[n]))
      queued.push(() => {
        old?.cleanup?.();
        effects[i] = { deps, cleanup: fn() };
      });
  },
};
let instance,
  tokens = 0,
  tokenBody,
  sequence = [],
  snapshot;
let agentReady = true,
  denyMicrophone = false,
  holdToken = false;
const timeouts = new Map();
class Room {
  constructor() {
    instance = this;
    this.handlers = {};
    this.remoteParticipants = new Map([
      [
        'agent',
        { identity: 'agent', isAgent: true, attributes: { drill_ready: String(agentReady) } },
      ],
    ]);
    this.localParticipant = {
      setMicrophoneEnabled: async (enabled) => {
        sequence.push(`mic:${enabled}`);
        if (enabled && denyMicrophone) throw new Error('Permiso de micrófono denegado');
      },
      performRpc: async (request) => {
        const body = JSON.parse(request.payload);
        sequence.push(body.action);
        if (body.action === 'start')
          snapshot = {
            captureId: body.captureId,
            text: '',
            finished: false,
            overflow: false,
            error: false,
          };
        if (body.action === 'finish')
          snapshot = { ...snapshot, text: 'I work. I study.', finished: true };
        assert.equal(request.destinationIdentity, 'agent');
        return JSON.stringify(snapshot);
      },
    };
  }
  on(event, fn) {
    (this.handlers[event] ??= new Set()).add(fn);
  }
  off(event, fn) {
    this.handlers[event]?.delete(fn);
  }
  emit(event) {
    for (const fn of [...(this.handlers[event] ?? [])]) fn();
  }
  async connect() {
    sequence.push('connect');
  }
  async disconnect() {
    sequence.push('disconnect');
    this.emit('disconnected');
  }
}
const output = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('hooks/use-drill-call.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: output,
    require: (name) =>
      i18nDependency(name) ??
      (name === 'react'
        ? react
        : {
            Room,
            RoomEvent: {
              Disconnected: 'disconnected',
              ParticipantConnected: 'participant',
              ParticipantAttributesChanged: 'attributes',
            },
          }),
    crypto: require('node:crypto').webcrypto,
    Date,
    JSON,
    Error,
    AbortController,
    setInterval(fn) {
      timers.add(fn);
      return fn;
    },
    clearInterval(fn) {
      timers.delete(fn);
    },
    setTimeout(fn, ms) {
      timeouts.set(fn, ms);
      return fn;
    },
    clearTimeout(fn) {
      timeouts.delete(fn);
    },
    fetch: async (url, options) => {
      assert.equal(url, '/api/token');
      tokens++;
      tokenBody = JSON.parse(options.body);
      if (holdToken)
        await new Promise((_, reject) =>
          options.signal.addEventListener('abort', () => reject(new Error('cancelled')), {
            once: true,
          })
        );
      return { ok: true, json: async () => ({ serverUrl: 'test', participantToken: 'test' }) };
    },
  }
);
let hook;
function render() {
  cursor = 0;
  hook = output.useDrillCall();
  const tasks = queued;
  queued = [];
  tasks.forEach((fn) => fn());
}
async function tick() {
  await Promise.all([...timers].map((fn) => fn()));
  await new Promise((resolve) => setImmediate(resolve));
  render();
}
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  render();
  render();
}
function reset() {
  effects.forEach((effect) => effect?.cleanup?.());
  slots.length = 0;
  effects.length = 0;
  queued = [];
  timers.clear();
  timeouts.clear();
  sequence = [];
  tokens = 0;
  agentReady = true;
  denyMicrophone = false;
  holdToken = false;
  render();
}
(async () => {
  render();
  await hook.connect('es', 'tutor');
  render();
  render();
  assert.equal(hook.connected, true);
  assert.equal(hook.ready, true);
  assert.equal(tokenBody.capture, 'time-shifting');
  assert.equal(tokenBody.room_config.agents[0].agent_name, 'tutor');
  assert.equal(sequence.includes('mic:true'), false, 'connecting must not open the microphone');
  await hook.begin();
  render();
  assert.equal(hook.capturing, true);
  snapshot.text = 'I work.';
  await tick();
  await tick();
  assert.equal(hook.text, 'I work.', 'polling snapshots must not append duplicates');
  const final = await hook.finish();
  render();
  assert.equal(final, 'I work. I study.');
  assert.equal(hook.text, final);
  assert.equal(hook.capturing, false);
  assert.ok(sequence.lastIndexOf('mic:false') < sequence.lastIndexOf('finish'));
  await hook.begin();
  render();
  assert.equal(hook.text, '', 'the next step must not inherit previous speech');
  snapshot.error = true;
  await assert.rejects(hook.finish(), /incompleta/);
  render();
  assert.equal(hook.capturing, false);
  const preserved = hook.text;
  await hook.disconnect();
  render();
  assert.equal(hook.connected, false);
  assert.equal(hook.text, preserved);
  assert.equal(tokens, 1, 'no second token or correction call during pauses');
  reset();
  agentReady = false;
  const starting = hook.start('es', 'tutor');
  await settle();
  assert.equal(hook.pending, true);
  assert.equal(hook.capturing, false);
  assert.equal(sequence.includes('mic:true'), false, 'never capture before the agent is ready');
  assert.equal(await hook.start('es'), false, 'double click cannot duplicate a connection');
  instance.remoteParticipants.get('agent').attributes.drill_ready = 'true';
  instance.emit('attributes');
  assert.equal(await starting, true);
  await settle();
  assert.equal(hook.capturing, true);
  assert.equal(timeouts.size, 0);
  assert.equal(tokens, 1);
  assert.equal(sequence.filter((item) => item === 'start').length, 1);
  await hook.finish();
  await settle();
  await hook.start('es');
  await settle();
  assert.equal(tokens, 1, 'later steps reuse the connected room');

  reset();
  agentReady = false;
  const cancelled = assert.rejects(hook.start('es'), /cancelado/);
  await settle();
  const abandoned = instance;
  await hook.disconnect();
  await cancelled;
  await settle();
  abandoned.remoteParticipants.get('agent').attributes.drill_ready = 'true';
  abandoned.emit('attributes');
  await settle();
  assert.equal(hook.capturing, false);
  assert.equal(
    sequence.includes('mic:true'),
    false,
    'late readiness cannot open a cancelled microphone'
  );
  assert.equal(timeouts.size, 0);
  agentReady = true;
  assert.equal(await hook.start('es'), true, 'cancelled start can be retried');

  reset();
  agentReady = false;
  const timedOut = assert.rejects(hook.start('es'), /agente de transcripción/);
  await settle();
  assert.equal([...timeouts.values()][0], 30000);
  [...timeouts.keys()][0]();
  await timedOut;
  await settle();
  assert.equal(hook.pending, false);
  assert.equal(hook.capturing, false);
  assert.equal(timeouts.size, 0);

  reset();
  denyMicrophone = true;
  await assert.rejects(hook.start('es'), /denegado/);
  await settle();
  assert.equal(hook.capturing, false);
  assert.ok(
    sequence.indexOf('mic:false') < sequence.indexOf('finish'),
    'denied microphone closes the server capture'
  );

  reset();
  holdToken = true;
  const aborted = assert.rejects(hook.start('es'), /preparar/);
  await settle();
  await hook.disconnect();
  await aborted;
  await settle();
  assert.equal(hook.pending, false);
  assert.equal(hook.capturing, false);
  assert.equal(sequence.includes('mic:true'), false);
  holdToken = false;
  assert.equal(await hook.start('es'), true);
  effects.forEach((effect) => effect?.cleanup?.());
  assert.equal(timers.size, 0);
  assert.equal(timeouts.size, 0);
  console.log(
    'PASS: one-click start, delayed readiness, timeout, cancellation, denied microphone, capture isolation and final flush. No real API calls.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
