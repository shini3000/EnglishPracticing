const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let authenticated = true, options;
class Token {
  constructor(key, secret, value) { options = value; }
  addGrant() {}
  async toJwt() { return 'test-token'; }
}
class NextResponse extends Response {
  static json(body, options) { return Response.json(body, options); }
}
const exportsObject = {};
const imports = {
  'next/server': {NextResponse}, 'livekit-server-sdk': {AccessToken:Token},
  '@livekit/protocol': {RoomConfiguration:class {}}, '@/lib/avatars': {}, '@/lib/db': {},
  '@/lib/practice-options': {NATIVE_LANGUAGES:{es:'Español'}},
  '@/lib/session': {currentLearnerId:async () => authenticated ? 'test-learner' : null},
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/token/route.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022},
}).outputText, {exports:exportsObject, require:name=>imports[name],
  process:{env:{LIVEKIT_URL:'wss://test.invalid',LIVEKIT_API_KEY:'test',LIVEKIT_API_SECRET:'test'}},
  crypto:require('node:crypto').webcrypto, Response, Headers, console});
function request(mode) { return new Request('http://localhost/api/token', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body:JSON.stringify({capture:'time-shifting',practiceMode:mode,nativeLanguage:'es'}),
}); }
(async () => {
  authenticated = false;
  assert.equal((await exportsObject.POST(request('fluency'))).status,401);
  authenticated = true;
  assert.equal((await exportsObject.POST(request('fluency'))).status,200);
  assert.equal(options.attributes.practice_capture,'time-shifting');
  assert.equal(options.identity,'learner_test-learner');
  await exportsObject.POST(request('daily'));
  assert.equal(options.attributes.practice_capture,'');
  await exportsObject.POST(request('diagnostic'));
  assert.equal(options.attributes.practice_capture,'');
  console.log('PASS: authentication and signed capture attribute restricted to practice B. No real tokens or network.');
})().catch(error=>{console.error(error);process.exitCode=1;});
