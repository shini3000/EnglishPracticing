const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let calls = [],
  answer,
  status = 200;
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('lib/correction-provider.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: exportsObject,
    process: { env: {} },
    AbortSignal,
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: JSON.parse(options.body) });
      return Response.json(answer, { status });
    },
  }
);
const { correctionConfig, requestCorrection } = exportsObject;
const payload = { corrections: [], feedback: 'Keep practicing.' };
(async () => {
  assert.throws(
    () => correctionConfig({ CORRECTION_PROVIDER: 'other' }),
    /invalid_correction_provider/
  );
  assert.throws(
    () => correctionConfig({ CORRECTION_PROVIDER: 'groq', DEEPSEEK_API_KEY: 'not-groq' }),
    /missing_correction_key/
  );
  assert.throws(
    () => correctionConfig({ DEEPSEEK_API_KEY: 'key', CORRECTION_MAX_REQUEST_TOKENS: '-1' }),
    /invalid_correction_config/
  );
  assert.equal(
    correctionConfig({ DEEPSEEK_API_KEY: 'key' }).provider,
    'deepseek',
    'backward compatible default'
  );
  for (const provider of ['groq', 'google', 'deepseek']) {
    const env = {
      CORRECTION_PROVIDER: provider,
      CORRECTION_MODEL: 'chosen-model',
      [`${provider.toUpperCase()}_API_KEY`]: 'private-key',
    };
    const config = correctionConfig(env);
    answer =
      provider === 'google'
        ? {
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [{ thought: true, text: 'not JSON' }, { text: JSON.stringify(payload) }],
                },
              },
            ],
          }
        : { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] };
    assert.equal(
      JSON.stringify(await requestCorrection(config, 'Return JSON.', 'Learner evidence')),
      JSON.stringify(payload)
    );
    const sent = calls.at(-1);
    assert(!sent.url.includes('private-key'));
    assert.equal(sent.signal.aborted, false);
    if (provider === 'google') {
      assert.match(sent.url, /generativelanguage.googleapis.com/);
      assert.equal(sent.headers['x-goog-api-key'], 'private-key');
      assert.equal(sent.body.generationConfig.responseMimeType, 'application/json');
      assert.equal(sent.body.contents[0].parts[0].text, 'Learner evidence');
      assert(!sent.body.thinking && !sent.body.response_format);
    } else {
      assert.match(sent.url, provider === 'groq' ? /api.groq.com/ : /api.deepseek.com/);
      assert.equal(sent.body.model, 'chosen-model');
      assert.equal(sent.body.messages[1].content, 'Learner evidence');
      assert.equal(Boolean(sent.body.thinking), provider === 'deepseek');
    }
    const before = calls.length;
    await assert.rejects(
      requestCorrection({ ...config, maxRequestTokens: 1 }, 'system', 'user'),
      /correction_request_too_large/
    );
    assert.equal(calls.length, before, 'oversize evidence must not be sent or truncated');
    status = 429;
    await assert.rejects(
      requestCorrection(config, 'system', 'user'),
      new RegExp(`${provider} HTTP 429`)
    );
    assert.equal(calls.length, before + 1, 'no retry or provider fallback');
    status = 200;
    answer =
      provider === 'google'
        ? { candidates: [{ finishReason: 'MAX_TOKENS' }] }
        : { choices: [{ finish_reason: 'length' }] };
    await assert.rejects(
      requestCorrection(config, 'system', 'user'),
      /incomplete_correction_response/
    );
    answer = {};
    await assert.rejects(
      requestCorrection(config, 'system', 'user'),
      /invalid_correction_response/
    );
  }
  const groq = correctionConfig({ CORRECTION_PROVIDER: 'groq', GROQ_API_KEY: 'key' });
  answer = { choices: [{ finish_reason: 'stop', message: { content: '{}' } }] };
  await requestCorrection(groq, 'system', 'user');
  assert.equal(calls.at(-1).body.reasoning_effort, 'low');
  assert.equal(
    correctionConfig({
      CORRECTION_PROVIDER: 'google',
      GOOGLE_API_KEY: 'key',
      GOOGLE_LLM_MODEL: 'custom-google',
    }).model,
    'custom-google'
  );
  console.log(
    'PASS: independent correction providers, native JSON transports, private keys, limits, incomplete responses and no fallback. No network.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
