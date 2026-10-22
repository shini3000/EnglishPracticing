const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');

let connected = false;
let lazyRenders = 0;
let disconnects = 0;
let loadingOptions;
const imports = {
  'react/jsx-runtime': jsx,
  'next-themes': { useTheme: () => ({ resolvedTheme: 'light' }) },
  'motion/react': {
    motion: { create: (component) => component },
    AnimatePresence: ({ children }) => children,
  },
  '@livekit/components-react': {
    useSessionContext: () => ({
      isConnected: connected,
      start() {},
      end() {
        disconnects++;
      },
    }),
  },
  '@/components/app/welcome-view': { WelcomeView: () => jsx.jsx('p', { children: 'Preparación' }) },
  '@/components/ui/skeleton': { Skeleton: () => jsx.jsx('div', {}) },
  'next/dynamic': {
    __esModule: true,
    default: (_loader, options) => {
      loadingOptions = options;
      return () => {
        lazyRenders++;
        return jsx.jsx('p', { children: 'Interfaz de llamada' });
      };
    },
  },
};
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('components/app/view-controller.tsx', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText,
  {
    exports: exportsObject,
    require(name) {
      assert.ok(name in imports, `Unexpected eager import: ${name}`);
      return imports[name];
    },
  }
);

const props = { appConfig: {}, avatarChoice: 'boy', practiceMode: 'fluency', startStep: 4 };
assert.match(
  renderToStaticMarkup(React.createElement(exportsObject.ViewController, props)),
  /Preparación/
);
assert.equal(lazyRenders, 0, 'Call interface must not render during preparation');
connected = true;
assert.match(
  renderToStaticMarkup(React.createElement(exportsObject.ViewController, props)),
  /Interfaz de llamada/
);
assert.equal(lazyRenders, 1);
const loading = loadingOptions.loading();
assert.match(renderToStaticMarkup(loading), /Cargando la interfaz/);
loading.props.children.find((child) => child?.type === 'button').props.onClick();
assert.equal(disconnects, 1, 'Disconnect remains usable while the session chunk loads');

// Guard the conditional mount and import boundary, not a claimed bundle-size reduction.
const app = fs.readFileSync('components/app/app.tsx', 'utf8');
assert.match(app, /photoDialogOpen &&/);
assert.match(app, /import\('@\/components\/avatar\/personal-avatar-dialog'\)/);
assert.doesNotMatch(app, /import \{ PersonalAvatarDialog \} from/);
const visualizer = fs.readFileSync(
  'components/agents-ui/blocks/agent-session-view-01/components/audio-visualizer.tsx',
  'utf8'
);
for (const kind of ['aura', 'grid', 'radial', 'wave']) {
  assert.ok(visualizer.includes(`import('@/components/agents-ui/agent-audio-visualizer-${kind}')`));
}
console.log(
  'PASS: conditional lazy call/photo boundaries, selected visualizer chunks and disconnect fallback. No calls, tokens or network.'
);
