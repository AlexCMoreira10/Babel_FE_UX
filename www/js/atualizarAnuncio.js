import { resolverUrlImagem } from './image-utils.js';
import { configurarSelecaoImagens } from './selecao-imagens.mjs';
import {
  aguardarUsuarioFirebase,
  enviarImagensLivro,
  removerImagensStorageProprias,
  validarArquivosImagem
} from './firebase-storage.js';

const URL_BASE_LOCAL = 'http://localhost:3000/api';
const URL_BASE_REMOTE = 'https://babel-be-lovat.vercel.app/api';

let URL_BASE = URL_BASE_LOCAL;

async function fetchComFallback(url, options = {}) {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (erro) {
    if (URL_BASE === URL_BASE_LOCAL && url.includes(URL_BASE_LOCAL)) {
      console.warn(`Falha ao conectar em ${URL_BASE_LOCAL}, tentando ${URL_BASE_REMOTE}...`);
      URL_BASE = URL_BASE_REMOTE;
      const urlRemota = url.replace(URL_BASE_LOCAL, URL_BASE_REMOTE);
      return fetch(urlRemota, options);
    }
    throw erro;
  }
}

const formAtualizar = document.getElementById('formAtualizar');
const updateMessage = document.getElementById('updateMessage');
const tituloInput = document.getElementById('titulo');
const autorInput = document.getElementById('autor');
const editoraInput = document.getElementById('editora');
const anoInput = document.getElementById('anoPublicacao');
const idiomaInput = document.getElementById('idioma');
const condicaoSelect = document.getElementById('condicao');
const tipoSelect = document.getElementById('tipo');
const precoGroup = document.getElementById('precoGroup');
const precoInput = document.getElementById('preco');
const generosInput = document.getElementById('generos');
const localizacaoInput = document.getElementById('localizacao');
const descricaoInput = document.getElementById('descricao');
const fotosAtuaisContainer = document.getElementById('fotosAtuais');
const fotosArquivosInput = document.getElementById('fotosArquivos');
const fotosExternasInput = document.getElementById('fotosExternas');
const fotosNovasPreview = document.getElementById('fotosNovasPreview');
const trocasInput = document.getElementById('trocasInteresses');
const aceitaRetiradaInput = document.getElementById('aceitaRetirada');
let fotosExistentes = [];

function normalizeLivroData(data) {
  if (!data) return {};
  if (data.livro) return data.livro;
  if (data.data?.livro) return data.data.livro;
  if (data.data) return data.data;
  return data;
}

function toStringArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(toStringArray).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'object') return Object.values(value).flatMap(toStringArray).filter(Boolean);
  return [String(value)];
}

function obterUrlsExternas() {
  return fotosExternasInput.value
    .split(/[,\n]/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function validarUrlsExternas(urls) {
  return urls.filter((valor) => {
    try {
      const url = new URL(valor);
      return url.protocol !== 'https:' ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.hostname === 'firebasestorage.googleapis.com' ||
        url.hostname === 'storage.googleapis.com' ||
        url.hostname.endsWith('.firebasestorage.app');
    } catch {
      return true;
    }
  });
}

function renderizarFotosExistentes() {
  fotosAtuaisContainer.replaceChildren();
  fotosExistentes.forEach((url, index) => {
    const item = document.createElement('label');
    item.className = 'form-group';

    const imagem = document.createElement('img');
    imagem.src = resolverUrlImagem(url);
    imagem.alt = `Imagem atual ${index + 1}`;
    imagem.style.width = '120px';
    imagem.style.height = '120px';
    imagem.style.objectFit = 'cover';
    imagem.style.borderRadius = '8px';

    const manter = document.createElement('input');
    manter.type = 'checkbox';
    manter.checked = true;
    manter.dataset.photoIndex = String(index);

    const texto = document.createElement('span');
    texto.textContent = `Manter imagem ${index + 1}`;
    item.append(imagem, manter, texto);
    fotosAtuaisContainer.append(item);
  });
}

function obterFotosMantidas() {
  const indicesRemovidos = new Set(
    Array.from(fotosAtuaisContainer.querySelectorAll('input[type="checkbox"]:not(:checked)'))
      .map((input) => Number(input.dataset.photoIndex))
  );
  return fotosExistentes.filter((_, index) => !indicesRemovidos.has(index));
}

const selecaoImagens = configurarSelecaoImagens({
  inputGaleria: fotosArquivosInput,
  inputCamera: document.getElementById('fotoCamera'),
  botaoCamera: document.getElementById('tirarFotoBtn'),
  feedback: document.getElementById('fotoCameraFeedback'),
  preview: fotosNovasPreview,
  obterTotalExistente: () => obterFotosMantidas().length + obterUrlsExternas().length,
  textoContador: total => `${total} de 5 imagens após salvar`,
  validarArquivos: validarArquivosImagem
});

const params = new URLSearchParams(window.location.search);
const livroId = params.get('id');

if (!livroId) {
  updateMessage.textContent = 'ID do anúncio não encontrado na URL.';
} else {
  carregarLivro();
}

tipoSelect.addEventListener('change', () => {
  precoGroup.style.display = tipoSelect.value === 'venda' ? 'block' : 'none';
  precoInput.required = tipoSelect.value === 'venda';
});
fotosAtuaisContainer.addEventListener('change', selecaoImagens.atualizarPreview);
fotosExternasInput.addEventListener('input', selecaoImagens.atualizarPreview);

formAtualizar.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = localStorage.getItem('token');
  let usuarioLocal = null;
  try {
    usuarioLocal = JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    usuarioLocal = null;
  }

  if (!token || !usuarioLocal) {
    alert('Você precisa estar logado para atualizar o anúncio.');
    window.location.href = './login.html';
    return;
  }

  const fotosMantidas = obterFotosMantidas();
  const fotosExternasNovas = obterUrlsExternas();
  const invalidas = validarUrlsExternas(fotosExternasNovas);
  if (invalidas.length) {
    alert(
      'Confira as URLs externas. Use endereços HTTPS válidos que não sejam links do Firebase Storage.\n\n' +
      invalidas.join(', ')
    );
    fotosExternasInput.focus();
    return;
  }

  let arquivosImagem;
  try {
    arquivosImagem = validarArquivosImagem(
      selecaoImagens.arquivosSelecionados(),
      fotosMantidas.length + fotosExternasNovas.length
    );
  } catch (erro) {
    alert(erro.message);
    fotosArquivosInput.focus();
    return;
  }

  let usuarioFirebase;
  try {
    usuarioFirebase = await aguardarUsuarioFirebase();
  } catch (erro) {
    alert(erro.message);
    return;
  }
  if (usuarioFirebase.uid !== usuarioLocal.uid) {
    alert('A sessão Firebase não corresponde à conta atual. Entre novamente.');
    return;
  }

  const payload = {
    titulo: tituloInput.value.trim(),
    autor: autorInput.value.trim(),
    editora: editoraInput.value.trim(),
    anoPublicacao: Number(anoInput.value) || null,
    idioma: idiomaInput.value.trim(),
    condicao: condicaoSelect.value,
    tipo: tipoSelect.value,
    localizacao: localizacaoInput.value.trim(),
    descricao: descricaoInput.value.trim(),
    generos: generosInput.value.split(',').map((item) => item.trim()).filter(Boolean),
    fotos: fotosMantidas.concat(fotosExternasNovas),
    trocas: {
      interesses: trocasInput.value.split(',').map((item) => item.trim()).filter(Boolean),
      aceitaRetirada: aceitaRetiradaInput.checked
    }
  };

  if (tipoSelect.value === 'venda') {
    const preco = Number(precoInput.value);
    if (!Number.isFinite(preco) || preco <= 0) {
      alert('Informe um preço maior que zero para anúncios de venda.');
      precoInput.focus();
      return;
    }
    payload.preco = preco;
  } else {
    delete payload.preco;
  }

  const submitBtn = formAtualizar.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Salvando alterações...';
  }

  let draftId = '';
  let uploadedFiles = [];
  let atualizacaoConfirmada = false;
  try {
    if (arquivosImagem.length) {
      const respostaRascunho = await fetchComFallback(
        URL_BASE + '/livros/' + encodeURIComponent(livroId) + '/rascunhos-imagens',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token }
        }
      );
      const dadosRascunho = await respostaRascunho.json().catch(() => null);
      if (!respostaRascunho.ok) {
        throw new Error(dadosRascunho?.erro || 'Não foi possível iniciar o envio das imagens.');
      }
      draftId = dadosRascunho?.id || '';
      if (!draftId) throw new Error('A API não retornou o identificador do envio.');

      if (submitBtn) submitBtn.textContent = 'Enviando imagens...';
      try {
        uploadedFiles = await enviarImagensLivro(arquivosImagem, {
          usuario: usuarioFirebase,
          livroId,
          uploadId: draftId
        });
      } catch (erro) {
        uploadedFiles = erro.uploadedFiles || [];
        throw erro;
      }
      payload.fotos.push(...uploadedFiles.map((imagem) => imagem.url));
      payload.imageDraftId = draftId;
    }

    if (payload.fotos.length > 5) {
      throw new Error('O anúncio pode ter no máximo 5 imagens.');
    }
    if (submitBtn) submitBtn.textContent = 'Confirmando alterações...';
    const response = await fetchComFallback(
      URL_BASE + '/livros/' + encodeURIComponent(livroId),
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.erro || errorData.message || errorData.error || errorText;
      } catch {
        // A resposta pode conter texto simples em vez de JSON.
      }

      const verifyResponse = await fetchComFallback(
        URL_BASE + '/livros/' + encodeURIComponent(livroId),
        { headers: { Authorization: 'Bearer ' + token } }
      );
      const livroAtualizado = verifyResponse.ok
        ? normalizeLivroData(await verifyResponse.json())
        : null;
      if (livroAtualizado?.usuarioId === usuarioFirebase.uid &&
          JSON.stringify(livroAtualizado.fotos || []) === JSON.stringify(payload.fotos)) {
        atualizacaoConfirmada = true;
      } else {
        throw new Error(errorMessage || 'Não foi possível atualizar o anúncio.');
      }
    } else {
      atualizacaoConfirmada = true;
    }

    if (atualizacaoConfirmada) {
      const removidas = fotosExistentes.filter((foto) => !fotosMantidas.includes(foto));
      let avisoLimpeza = '';
      try {
        await removerImagensStorageProprias(removidas, usuarioFirebase.uid);
      } catch (erro) {
        console.error('A atualização foi salva, mas algumas imagens antigas não foram removidas:', erro);
        avisoLimpeza = ' A atualização foi salva, mas não foi possível limpar todos os arquivos removidos do Storage.';
      }
      alert('Anúncio atualizado com sucesso.' + avisoLimpeza);
      window.location.href = './perfil.html';
      return;
    }
  } catch (error) {
    console.error('Erro na atualização:', error);
    let avisoLimpeza = '';
    if (draftId && !atualizacaoConfirmada) {
      try {
        const respostaLimpeza = await fetchComFallback(
          URL_BASE + '/livros/' + encodeURIComponent(livroId) +
            '/rascunhos-imagens/' + encodeURIComponent(draftId),
          {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
          }
        );
        if (!respostaLimpeza.ok && respostaLimpeza.status !== 404) {
          const resultadoLimpeza = await respostaLimpeza.json().catch(() => null);
          throw new Error(resultadoLimpeza?.erro || 'HTTP ' + respostaLimpeza.status);
        }
      } catch (erroLimpeza) {
        console.error('Não foi possível cancelar a operação temporária de imagens:', erroLimpeza);
        avisoLimpeza = ' Os uploads não associados serão removidos pela tarefa automática.';
      }
    }
    alert('Não foi possível atualizar o anúncio: ' + error.message + avisoLimpeza);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Salvar alterações';
    }
  }
});

async function carregarLivro() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      updateMessage.textContent = 'Você precisa estar logado para editar o anúncio.';
      return;
    }

    const response = await fetchComFallback(`${URL_BASE}/livros/${livroId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Não foi possível carregar os dados do anúncio.');
    }

    const data = await response.json();
    const livro = normalizeLivroData(data);

    tituloInput.value = livro.titulo || '';
    autorInput.value = livro.autor || '';
    editoraInput.value = livro.editora || '';
    anoInput.value = livro.anoPublicacao || '';
    idiomaInput.value = livro.idioma || '';
    condicaoSelect.value = livro.condicao || '';
    tipoSelect.value = livro.tipo || '';
    localizacaoInput.value = livro.localizacao || '';
    descricaoInput.value = livro.descricao || '';
    fotosExistentes = toStringArray(livro.fotos);
    renderizarFotosExistentes();
    selecaoImagens.atualizarPreview();
    generosInput.value = Array.isArray(livro.generos) ? livro.generos.join(', ') : livro.generos || '';
    trocasInput.value = Array.isArray(livro.trocas?.interesses) ? livro.trocas.interesses.join(', ') : livro.trocas?.interesses || '';
    aceitaRetiradaInput.checked = livro.trocas?.aceitaRetirada ?? false;
    precoInput.value = livro.preco ?? '';

    precoGroup.style.display = tipoSelect.value === 'venda' ? 'block' : 'none';
    precoInput.required = tipoSelect.value === 'venda';
    formAtualizar.style.display = 'grid';
    updateMessage.style.display = 'none';
  } catch (error) {
    console.error('Erro ao carregar anúncio:', error);
    updateMessage.textContent = 'Falha ao carregar o anúncio. Por favor, tente novamente.';
  }
}
