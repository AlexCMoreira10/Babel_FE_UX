const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/test-mode.js'), 'utf8');

function runMode({ hostname, search = '', sessionFlag = null, cookie = '' }) {
  const sessionValues = new Map(sessionFlag ? [['babelTestMode', sessionFlag]] : []);
  const listeners = {};
  const document = {
    cookie,
    createElement: () => ({ setAttribute() {}, style: {}, textContent: '' }),
    addEventListener: (type, handler) => { listeners[type] = handler; }
  };
  const calls = [];
  const navigator = {};
  const window = {
    navigator,
    location: {
      hostname,
      search,
      origin: `http://${hostname}:3000`,
      href: `http://${hostname}:3000/?${search}`
    },
    fetch(input) {
      calls.push(input);
      return Promise.resolve(input);
    }
  };
  const context = {
    window,
    document,
    navigator,
    URL,
    URLSearchParams,
    Date,
    console: { warn() {} },
    sessionStorage: {
      getItem: key => sessionValues.get(key) || null,
      setItem: (key, value) => sessionValues.set(key, value)
    }
  };
  vm.runInNewContext(source, context);
  return { window, document, listeners, calls, sessionValues };
}

test('test mode is disabled by default and outside localhost', () => {
  const production = runMode({ hostname: 'babel.example' });
  assert.equal(production.window.BABEL_TEST_MODE, false);
  assert.equal(typeof production.window.BABEL_TEST_AUTH, 'undefined');

  const remoteOptIn = runMode({ hostname: 'babel.example', search: '?babelTestMode=1' });
  assert.equal(remoteOptIn.window.BABEL_TEST_MODE, false);
  assert.equal(remoteOptIn.sessionValues.size, 0);

  const loopbackOptIn = runMode({ hostname: '127.0.0.1', search: '?babelTestMode=1' });
  assert.equal(loopbackOptIn.window.BABEL_TEST_MODE, true);
});

test('enabled test mode allows same-origin requests only and mocks geolocation', async () => {
  const mode = runMode({ hostname: 'localhost', search: '?babelTestMode=1' });
  await mode.window.fetch('/api/livros');
  await assert.rejects(mode.window.fetch('https://babel-be-lovat.vercel.app/api/livros'), /Bloqueado pelo modo de testes/);
  await assert.rejects(mode.window.fetch('http://127.0.0.1:3001/api/livros'), /Bloqueado pelo modo de testes/);
  assert.equal(mode.window.BABEL_TEST_BLOCKED_REQUESTS.length, 2);
  assert.equal(mode.calls.length, 1);

  let position;
  mode.window.navigator.geolocation.getCurrentPosition(value => { position = value; });
  assert.equal(position.coords.latitude, -23.5505);
  assert.equal(position.coords.longitude, -46.6333);
});
