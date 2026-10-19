const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => imports[name], Intl, Date, Map, Set });
  return exports;
}
const dates = load('lib/progress/dates.ts');
assert.equal(dates.practiceDay('2026-10-20T00:15:00Z'), '2026-10-19');
assert.equal(dates.practiceDay('2026-10-20T04:59:59Z'), '2026-10-19');
assert.equal(dates.practiceDay('2026-10-20T05:00:00Z'), '2026-10-20');
const activity = load('lib/progress/activity.ts', { './dates': dates });
const grouped = activity.groupActivity([
  { id:'one', at:'2026-10-19T15:00:00Z', type:'call', label:'A' },
  { id:'two', at:'2026-10-20T01:00:00Z', type:'drill', label:'B' },
  { id:'three', at:'2026-10-20T05:00:00Z', type:'drill', label:'C' },
]);
assert.equal(grouped.length, 2);
assert.equal(grouped[1].activities.length, 2);
const analysis = load('lib/progress/analysis.ts', {
  './dates': dates, './cefr': {}, './parameters': { PARAMETERS: [] }, './taxonomy.json': { default: { categories: [] } },
});
assert.equal(analysis.currentStreakDays([
  { started_at:'2026-10-19T15:00:00Z' }, { started_at:'2026-10-20T01:00:00Z' },
]), 1);
assert.equal(analysis.currentStreakDays([
  { started_at:'2026-10-19T15:00:00Z' }, { started_at:'2026-10-20T05:01:00Z' },
]), 2);
console.log('PASS: Colombia midnight boundaries, same-day grouping and distinct-day streak. No database writes.');
