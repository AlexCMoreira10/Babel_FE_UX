const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createPage() {
  const nodes = new Map();
  const requests = [];
  let locationCalls = 0;
  const authorOption = { disabled: false };

  function element(id) {
    if (!nodes.has(id)) {
      const listeners = {};
      nodes.set(id, {
        value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {},
        classList: { add() {}, remove() {} },
        addEventListener(type, handler) { listeners[type] = handler; },
        dispatch(type, event = {}) { return listeners[type]?.(event); },
        querySelector() { return authorOption; }
      });
    }
    return nodes.get(id);
  }

  const buttons = ['todos', 'troca', 'venda', 'doacao'].map(type => {
    const button = element(`type-${type}`);
    button.dataset.tipo = type;
    return button;
  });
  element('campoPesquisa').value = 'titulo';
  element('raioProximidade').value = '5';
  const window = {
    isSecureContext: true,
    location: { hostname: 'localhost', search: '', href: 'http://localhost/' },
    addEventListener() {}
  };
  const context = {
    window,
    document: {
      getElementById: element,
      querySelectorAll: () => buttons,
      querySelector: () => null
    },
    navigator: {
      geolocation: {
        getCurrentPosition(success) {
          locationCalls++;
          success({ coords: { latitude: -23.5, longitude: -46.6 } });
        }
      }
    },
    fetch(url, options = {}) {
      return new Promise(resolve => requests.push({ url, options, resolve }));
    },
    localStorage: { getItem: () => null },
    sessionStorage: { setItem() {} },
    resolverUrlImagem: value => value,
    URLSearchParams, URL, AbortController, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} }
  };
  const html = fs.readFileSync(path.join(__dirname, '../www/index.html'), 'utf8');
  const module = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*;\s*/m, '');
  vm.runInNewContext(module, context);

  return { element, requests, buttons, authorOption, locationCalls: () => locationCalls };
}

async function respond(request, dados = []) {
  request.resolve({ status: 200, ok: true, json: async () => ({ dados }) });
  await new Promise(resolve => setImmediate(resolve));
}

test('author search uses the exact supported normal filter and is unavailable for proximity', async () => {
  const page = createPage();
  page.element('pesquisa').value = 'Machado de Assis';
  page.element('campoPesquisa').value = 'autor';
  page.element('campoPesquisa').dispatch('change');
  const query = new URL(page.requests[0].url).searchParams;
  assert.equal(query.get('autor'), 'Machado de Assis');
  assert.equal(query.has('titulo'), false);
  await respond(page.requests[0]);
  await page.element('buscarProximosBtn').dispatch('click');
  assert.equal(page.locationCalls(), 0);
  assert.match(page.element('proximidadeFeedback').textContent, /selecione a busca por título/);
});

test('proximity reuses location, applies filters, ignores stale replies and returns to normal', async () => {
  const page = createPage();
  await page.element('buscarProximosBtn').dispatch('click');
  assert.equal(page.locationCalls(), 1);
  assert.equal(page.authorOption.disabled, true);
  assert.deepEqual(JSON.parse(page.requests[0].options.body), {
    latitude: -23.5, longitude: -46.6, raioKm: 5, page: 1, limit: 16
  });
  page.element('raioProximidade').value = '3';
  page.element('raioProximidade').dispatch('change');
  await respond(page.requests[1], [{ id: 'new', titulo: 'Novo', autor: 'Autor', distanciaKm: 1 }]);
  await respond(page.requests[0], [{ id: 'old', titulo: 'Antigo', autor: 'Autor' }]);
  assert.match(page.element('gridLivros').innerHTML, /Novo/);
  assert.doesNotMatch(page.element('gridLivros').innerHTML, /Antigo/);

  page.buttons[1].dispatch('click');
  page.element('pesquisa').value = 'Romance';
  page.element('pesquisa').dispatch('input');
  await respond(page.requests[2], [{ id: 'stale', titulo: 'Filtro antigo', autor: 'Autor' }]);
  assert.doesNotMatch(page.element('gridLivros').innerHTML, /Filtro antigo/);
  await new Promise(resolve => setTimeout(resolve, 550));
  const filtered = JSON.parse(page.requests[3].options.body);
  assert.equal(filtered.tipo, 'troca');
  assert.equal(filtered.titulo, 'Romance');
  assert.equal(filtered.raioKm, 3);
  await respond(page.requests[3]);
  assert.equal(page.locationCalls(), 1);

  page.element('raioProximidade').value = '10';
  page.element('raioProximidade').dispatch('change');
  assert.equal(JSON.parse(page.requests[4].options.body).raioKm, 10);
  page.buttons[2].dispatch('click');
  page.buttons[3].dispatch('click');
  assert.equal(JSON.parse(page.requests[5].options.body).tipo, 'venda');
  assert.equal(JSON.parse(page.requests[6].options.body).tipo, 'doacao');
  await respond(page.requests[6], [{ id: 'latest', titulo: 'Doação', autor: 'Autor' }]);
  await respond(page.requests[5], [{ id: 'late', titulo: 'Venda antiga', autor: 'Autor' }]);
  assert.match(page.element('gridLivros').innerHTML, /Doação/);
  assert.doesNotMatch(page.element('gridLivros').innerHTML, /Venda antiga/);

  await page.element('buscarProximosBtn').dispatch('click');
  assert.equal(page.authorOption.disabled, false);
  assert.equal(page.requests[7].options.method, undefined);
  assert.equal(new URL(page.requests[7].url).searchParams.get('titulo'), 'Romance');
  await respond(page.requests[7], [{ id: 'normal', titulo: 'Busca normal', autor: 'Autor' }]);
  await respond(page.requests[4], [{ id: 'old-radius', titulo: 'Raio antigo', autor: 'Autor' }]);
  assert.match(page.element('gridLivros').innerHTML, /Busca normal/);
  assert.doesNotMatch(page.element('gridLivros').innerHTML, /Raio antigo/);
  await page.element('buscarProximosBtn').dispatch('click');
  assert.equal(page.locationCalls(), 2);
  await respond(page.requests[8]);
});
