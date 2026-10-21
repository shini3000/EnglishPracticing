// Exercise the hook with SDK/React doubles: no microphone, network or paid API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const slots = [], effects = [], timers = new Set();
let cursor = 0, queued = [];
const react = {
  useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
  useEffect(fn, deps) {
    const i = cursor++, old = effects[i];
    if (!old || deps.some((d, n) => d !== old.deps[n])) queued.push(() => {
      old?.cleanup?.(); effects[i] = { deps, cleanup: fn() };
    });
  },
};
let instance, tokens = 0, tokenBody, sequence = [], snapshot;
class Room {
  constructor() {
    instance = this; this.handlers = {};
    this.remoteParticipants = new Map([['agent', {identity: 'agent', isAgent: true, attributes: {drill_ready:'true'}}]]);
    this.localParticipant = {
      setMicrophoneEnabled: async (enabled) => sequence.push(`mic:${enabled}`),
      performRpc: async (request) => {
        const body = JSON.parse(request.payload); sequence.push(body.action);
        if (body.action === 'start') snapshot = { captureId: body.captureId, text: '', finished:false, overflow:false, error:false };
        if (body.action === 'finish') snapshot = {...snapshot, text: 'I work. I study.', finished:true};
        assert.equal(request.destinationIdentity, 'agent');
        return JSON.stringify(snapshot);
      },
    };
  }
  on(event, fn) { this.handlers[event] = fn; }
  async connect() { sequence.push('connect'); }
  async disconnect() { sequence.push('disconnect'); this.handlers.disconnected?.(); }
}
const output = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('hooks/use-drill-call.ts', 'utf8'), {
  compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 },
}).outputText, {
  exports:output, require: (name) => name === 'react' ? react : {Room, RoomEvent:{Disconnected:'disconnected'}},
  crypto:require('node:crypto').webcrypto, Date, JSON, Error,
  setInterval(fn) { timers.add(fn); return fn; }, clearInterval(fn) { timers.delete(fn); },
  fetch:async (url, options) => { assert.equal(url, '/api/token'); tokens++; tokenBody = JSON.parse(options.body); return { ok:true, json:async () => ({serverUrl:'test', participantToken:'test'}) }; },
});
let hook;
function render() { cursor = 0; hook = output.useDrillCall(); const tasks = queued; queued = []; tasks.forEach(fn => fn()); }
async function tick() { await Promise.all([...timers].map(fn => fn())); await new Promise(resolve => setImmediate(resolve)); render(); }
(async () => {
  render(); await hook.connect('es', 'tutor'); render(); render();
  assert.equal(hook.connected, true); assert.equal(hook.ready, true);
  assert.equal(tokenBody.capture, 'time-shifting');
  assert.equal(tokenBody.room_config.agents[0].agent_name, 'tutor');
  assert.equal(sequence.includes('mic:true'), false, 'connecting must not open the microphone');
  await hook.begin(); render();
  assert.equal(hook.capturing, true);
  snapshot.text = 'I work.'; await tick(); await tick();
  assert.equal(hook.text, 'I work.', 'polling snapshots must not append duplicates');
  const final = await hook.finish(); render();
  assert.equal(final, 'I work. I study.'); assert.equal(hook.text, final);
  assert.equal(hook.capturing, false);
  assert.ok(sequence.lastIndexOf('mic:false') < sequence.lastIndexOf('finish'));
  await hook.begin(); render();
  assert.equal(hook.text, '', 'the next step must not inherit previous speech');
  snapshot.error = true;
  await assert.rejects(hook.finish(), /incompleta/); render();
  assert.equal(hook.capturing, false);
  const preserved = hook.text; await hook.disconnect(); render();
  assert.equal(hook.connected, false); assert.equal(hook.text, preserved);
  assert.equal(tokens, 1, 'no second token or correction call during pauses');
  effects.forEach(effect => effect?.cleanup?.());
  assert.equal(timers.size, 0);
  console.log('PASS: explicit microphone, automatic text, no duplicate fragments, final flush, isolated steps, STT failure and disconnect. No real API calls.');
})().catch(error => { console.error(error); process.exitCode = 1; });
