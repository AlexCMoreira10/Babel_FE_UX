const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storage = fs.readFileSync(path.join(root, 'js/firebase-storage.js'), 'utf8');
const limites = storage.slice(storage.indexOf('const LIMITE_IMAGEM_BYTES'), storage.indexOf('\nfunction extrairPathStorage'));
const inicio = storage.indexOf('export function validarArquivosImagem');
const fim = storage.indexOf('\nexport async function enviarImagensLivro', inicio);
const validarArquivos = vm.runInNewContext(
  `${limites}\n${storage.slice(inicio, fim).replace('export ', '')}\nvalidarArquivosImagem`
);

function elemento() {
  const listeners = {};
  return {
    children: [], files: [], value: '', textContent: '', disabled: false,
    addEventListener(tipo, fn) { listeners[tipo] = fn; },
    dispatch(tipo) { listeners[tipo]?.({}); },
    click() { this.clicked = true; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {}
  };
}

test('gallery and camera selections share preview, validation and upload files', async t => {
  const { configurarSelecaoImagens } = await import('../js/selecao-imagens.mjs');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  t.after(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });
  global.document = { createElement: elemento };
  global.window = { addEventListener() {} };
  let created = 0;
  let revoked = 0;
  URL.createObjectURL = () => `blob:test-${++created}`;
  URL.revokeObjectURL = () => { revoked++; };
  const inputGaleria = elemento();
  const inputCamera = elemento();
  const botaoCamera = elemento();
  const feedback = elemento();
  const preview = elemento();
  let existentes = 0;
  const selecao = configurarSelecaoImagens({
    inputGaleria, inputCamera, botaoCamera, feedback, preview,
    obterTotalExistente: () => existentes,
    textoContador: total => `${total} de 5`,
    validarArquivos
  });
  const galeria = { name: 'galeria.jpg', type: 'image/jpeg', size: 100 };
  const foto = { name: 'camera.jpg', type: 'image/jpeg', size: 200 };
  inputGaleria.files = [galeria];
  inputGaleria.dispatch('change');
  assert.equal(preview.children[0].textContent, '1 de 5');
  assert.match(preview.children[1].children[0].src, /^blob:/);
  botaoCamera.dispatch('click');
  assert.equal(inputCamera.clicked, true);
  inputCamera.dispatch('cancel');
  assert.match(feedback.textContent, /Nenhuma foto/);
  assert.deepEqual(selecao.arquivosSelecionados(), [galeria]);
  inputCamera.files = [foto];
  inputCamera.dispatch('change');
  assert.deepEqual(selecao.arquivosSelecionados(), [galeria, foto]);
  assert.equal(preview.children[0].textContent, '2 de 5');
  assert.match(preview.children[2].children[0].src, /^blob:/);

  existentes = 3;
  inputCamera.files = [{ name: 'extra.jpg', type: 'image/jpeg', size: 20 }];
  inputCamera.dispatch('change');
  assert.match(feedback.textContent, /máximo 5/);
  existentes = 0;
  inputCamera.files = [{ name: 'grande.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }];
  inputCamera.dispatch('change');
  assert.match(feedback.textContent, /até 5 MB/);
  inputCamera.files = [{ name: 'foto.heic', type: 'image/heic', size: 20 }];
  inputCamera.dispatch('change');
  assert.match(feedback.textContent, /Formato não permitido/);
  assert.deepEqual(selecao.arquivosSelecionados(), [galeria, foto]);
  preview.children[2].children[2].dispatch('click');
  assert.deepEqual(selecao.arquivosSelecionados(), [galeria]);
  assert.ok(revoked > 0);
});

test('both forms keep the same validated upload flow and use native capture input', () => {
  for (const [htmlName, jsName] of [['publicar.html', 'publicar.js'], ['atualizarAnuncio.html', 'atualizarAnuncio.js']]) {
    const html = fs.readFileSync(path.join(root, 'html', htmlName), 'utf8');
    const script = fs.readFileSync(path.join(root, 'js', jsName), 'utf8');
    assert.match(html, /id="fotosArquivos"[^>]*multiple/);
    assert.match(html, /id="fotoCamera"[^>]*accept="image\/\*"[^>]*capture="environment"/);
    assert.match(script, /validarArquivosImagem\(\s*selecaoImagens\.arquivosSelecionados\(\)/);
    assert.match(script, /enviarImagensLivro\(arquivosImagem/);
  }
});
