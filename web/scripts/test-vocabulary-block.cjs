const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../lib/progress/vocabulary-block.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded._compile(code, filename);
const { vocabularyBlockProgress: calculate } = loaded.exports;
const attempt = (date, result = 'unaided', extra = {}) => ({
  date,
  result,
  practice_block: 'vocabulary',
  observed: true,
  attempt_type: 'review',
  context: 'context',
  ...extra,
});
const two = [attempt('2026-01-01'), attempt('2026-01-02')];
assert.equal(calculate(two, '2026-01-05').streak, 2);
assert.equal(calculate(two, '2026-01-06').streak, 0);
assert.equal(calculate([...two, attempt('2026-01-06')], '2026-01-06').streak, 1);
assert.equal(
  calculate(
    [
      attempt('2026-01-01'),
      attempt('2026-01-01'),
      attempt('2026-01-02', 'failed'),
      attempt('2026-01-02'),
    ],
    '2026-01-02'
  ).streak,
  0
);
const complete = Array.from({ length: 10 }, (_, i) =>
  attempt(`2026-01-${String(i + 1).padStart(2, '0')}`)
);
assert.equal(
  calculate([...complete, attempt('2026-01-15', 'failed')], '2026-01-15').completed,
  true
);
assert.equal(
  calculate([attempt('2026-01-01'), attempt('2026-01-04', 'helped')], '2026-01-06').streak,
  1
);
assert.equal(
  calculate([attempt('2026-01-01', 'unaided', { practice_block: 'other' })], '2026-01-01').streak,
  0
);
console.log('PASS: vocabulary streak uses distinct days, inactivity, failures and completion.');
