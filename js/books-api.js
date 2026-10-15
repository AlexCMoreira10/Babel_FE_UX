const URL_BASE_LOCAL = 'http://localhost:3000/api';
const URL_BASE_REMOTE = 'https://babel-be-lovat.vercel.app/api';

const URL_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? URL_BASE_LOCAL
  : URL_BASE_REMOTE;

const QR_CODE_STORAGE_PREFIX = 'livroQrCode:';
const QR_CODE_RECENT_STORAGE_KEY = 'livroPublicadoQr';

function normalizarDadosQrLivro(livro) {
  const dados = livro?.livro || livro?.data?.livro || livro?.data || livro || {};
  return {
    id: String(dados.id || dados._id || ''),
    titulo: dados.titulo || 'Livro publicado',
    qrCode: dados.qrCode || dados.qr?.qrCode || '',
    qrUrl: dados.qrUrl || dados.qr?.qrUrl || ''
  };
}

export function salvarQrLivro(livro) {
  const dados = normalizarDadosQrLivro(livro);
  if (dados.id && dados.qrCode) {
    localStorage.setItem(`${QR_CODE_STORAGE_PREFIX}${dados.id}`, JSON.stringify(dados));
  }
  localStorage.setItem(QR_CODE_RECENT_STORAGE_KEY, JSON.stringify(dados));
  return dados;
}

export function obterQrLivro(livroId) {
  const dados = localStorage.getItem(`${QR_CODE_STORAGE_PREFIX}${livroId}`);
  return dados ? JSON.parse(dados) : null;
}

export function obterQrLivroPublicadoRecentemente() {
  const dados = sessionStorage.getItem(QR_CODE_RECENT_STORAGE_KEY)
    || localStorage.getItem(QR_CODE_RECENT_STORAGE_KEY);
  return dados ? JSON.parse(dados) : null;
}

export async function requisitarApiLivros(path, { method = 'GET', body, autenticado = true } = {}) {
  const token = localStorage.getItem('token');
  if (autenticado && !token) {
    const erro = new Error('Entre na sua conta para continuar.');
    erro.status = 401;
    throw erro;
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (autenticado) headers.Authorization = `Bearer ${token}`;

  const options = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  };
  const url = `${URL_BASE}${path}`;
  let resposta;

  try {
    resposta = await fetch(url, options);
  } catch (erro) {
    if (URL_BASE !== URL_BASE_LOCAL) throw erro;
    console.warn(`Falha ao conectar em ${URL_BASE_LOCAL}, tentando ${URL_BASE_REMOTE}...`);
    resposta = await fetch(`${URL_BASE_REMOTE}${path}`, options);
  }

  const texto = resposta.status === 204 ? '' : await resposta.text();
  let dados = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = { mensagem: texto };
    }
  }

  if (!resposta.ok) {
    const erro = new Error(
      dados?.erro || dados?.message || dados?.mensagem || `Erro HTTP ${resposta.status}`
    );
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}
