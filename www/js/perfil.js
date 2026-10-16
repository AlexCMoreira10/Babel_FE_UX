import {
  obterQrLivro,
  obterQrLivroPublicadoRecentemente,
  requisitarApiLivros
} from './books-api.js';

const perfilNome = document.getElementById('perfilNome');
const perfilEmail = document.getElementById('perfilEmail');
const perfilUid = document.getElementById('perfilUid');
const logoutBtn = document.getElementById('logoutBtn');
const refreshAdsBtn = document.getElementById('refreshAdsBtn');
const profileAdsGrid = document.getElementById('profileAdsGrid');
const profileSectionMessage = document.getElementById('profileSectionMessage');
const ownedBooksGrid = document.getElementById('ownedBooksGrid');
const shelfMessage = document.getElementById('shelfMessage');
const scanQrBtn = document.getElementById('scanQrBtn');
const scanFeedback = document.getElementById('scanFeedback');
const notificationsList = document.getElementById('notificationsList');
const notificationsMessage = document.getElementById('notificationsMessage');
const paginaPerfil = document.body.dataset.profilePage || 'perfil';

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

function carregarPerfil() {
  const usuarioStr = localStorage.getItem('usuario');

  if (!usuarioStr || !localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const usuario = JSON.parse(usuarioStr);
    if (perfilNome) perfilNome.textContent = usuario.displayName || 'Usuário';
    if (perfilEmail) perfilEmail.textContent = usuario.email || 'Não informado';
    if (perfilUid) perfilUid.textContent = usuario.uid || 'Não disponível';

    document.querySelectorAll('[data-profile-link]').forEach(link => {
      if (link.dataset.profileLink === paginaPerfil) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    if (paginaPerfil === 'anuncios') carregarMeusAnuncios();
    if (paginaPerfil === 'estante') carregarEstante();
    if (paginaPerfil === 'notificacoes') carregarNotificacoes();
    if (paginaPerfil === 'qrcode') mostrarQrPublicadoRecentemente();
  } catch (erro) {
    console.error('Erro ao carregar perfil:', erro);
    window.location.href = './login.html';
  }
}

async function carregarAnuncios(usuario) {
  if (!usuario || !usuario.uid) {
    profileSectionMessage.textContent = 'Usuário não identificado para carregar anúncios.';
    return;
  }

  profileSectionMessage.textContent = 'Carregando seus anúncios...';
  profileAdsGrid.innerHTML = '';

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const resposta = await fetchComFallback(`${URL_BASE}/livros?usuarioId=${encodeURIComponent(usuario.uid)}`, { headers });
    let dados;
    if (!resposta.ok) {
      console.warn('Filtro por usuarioId falhou, tentando buscar todos os anúncios:', resposta.status);
      const fallbackResposta = await fetchComFallback(`${URL_BASE}/livros`, { headers });
      if (!fallbackResposta.ok) {
        throw new Error(`Falha na busca fallback: ${fallbackResposta.status}`);
      }
      dados = await fallbackResposta.json();
    } else {
      dados = await resposta.json();
    }

    let anuncios = [];
    if (Array.isArray(dados)) anuncios = dados;
    else if (Array.isArray(dados.livros)) anuncios = dados.livros;
    else if (Array.isArray(dados.data)) anuncios = dados.data;
    else if (Array.isArray(dados.dados)) anuncios = dados.dados;

    anuncios = anuncios.filter(livro => livro.usuarioId === usuario.uid || livro.usuario === usuario.uid || (livro.usuario && livro.usuario.uid === usuario.uid));

    if (anuncios.length === 0) {
      profileSectionMessage.textContent = 'Nenhum anúncio encontrado. Publique seu primeiro livro!';
      return;
    }

    profileSectionMessage.textContent = `Você tem ${anuncios.length} anúncio${anuncios.length === 1 ? '' : 's'} publicado${anuncios.length === 1 ? '' : 's'}.`;
    profileAdsGrid.innerHTML = anuncios.map(criarCardAnuncio).join('');
  } catch (erro) {
    console.error('Erro ao carregar anúncios:', erro);
    profileSectionMessage.textContent = 'Erro ao buscar anúncios. Tente novamente.';
  }
}

async function carregarNotificacoes() {
  if (!notificationsList || !notificationsMessage) return;

  notificationsMessage.textContent = 'Carregando notificações...';
  notificationsList.innerHTML = '';

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const resposta = await fetchComFallback(`${URL_BASE}/notificacoes`, {
      headers
    });

    if (!resposta.ok) {
      if (resposta.status === 401) {
        notificationsMessage.textContent = 'Não autorizado. Faça login novamente.';
        return;
      }
      throw new Error(`Status ${resposta.status}`);
    }

    const dados = await resposta.json();
    const notificacoes = Array.isArray(dados) ? dados : Array.isArray(dados.notificacoes) ? dados.notificacoes : [];

    if (notificacoes.length === 0) {
      notificationsMessage.textContent = 'Nenhuma notificação no momento.';
      return;
    }

    notificationsMessage.textContent = `Você tem ${notificacoes.length} notificações.`;
    notificationsList.innerHTML = notificacoes.map(criarCardNotificacao).join('');
  } catch (erro) {
    console.error('Erro ao carregar notificações:', erro);
    notificationsMessage.textContent = 'Não foi possível carregar notificações. Tente novamente.';
  }
}

function criarCardNotificacao(notificacao) {
  const id = notificacao._id || notificacao.id || '';
  const titulo = notificacao.titulo || notificacao.assunto || 'Notificação';
  const texto = notificacao.texto || notificacao.mensagem || notificacao.descricao || 'Sem descrição disponível.';
  const data = notificacao.criadoEm || notificacao.createdAt || notificacao.data || null;
  const lida = notificacao.lida || notificacao.status === 'lida';
  const displayDate = data ? new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

  return `
    <div class="notification-card ${lida ? 'notification-read' : 'notification-unread'}" data-id="${escaparHtml(id)}">
      <div class="notification-title">${escaparHtml(titulo)}</div>
      <div class="notification-body">${escaparHtml(texto)}</div>
      <div class="notification-meta">
        <span>${escaparHtml(displayDate)}</span>
        <span>${lida ? 'Lida' : 'Não lida'}</span>
      </div>
      <div class="notification-actions">
        ${notificacao.acao === 'revisar-aquisicao' && notificacao.livroId
          ? `<button type="button" class="btn-add" data-action="review-transfer" data-id="${escaparHtml(notificacao.livroId)}">Revisar pedido</button>`
          : ''}
        <button type="button" class="btn-secondary" data-action="mark-read" data-id="${escaparHtml(id)}" ${lida ? 'disabled' : ''}>Marcar como lida</button>
      </div>
    </div>
  `;
}

async function marcarNotificacaoLida(notificacaoId) {
  if (!notificacaoId) return;

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    notificationsMessage.textContent = 'Marcando notificação como lida...';
    const resposta = await fetchComFallback(`${URL_BASE}/notificacoes/${notificacaoId}/lida`, {
      method: 'PUT',
      headers
    });

    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(`Falha ao marcar notificação: ${resposta.status} ${texto}`);
    }

    notificationsMessage.textContent = 'Notificação marcada como lida.';
    carregarNotificacoes();
  } catch (erro) {
    console.error('Erro ao marcar notificação como lida:', erro);
    notificationsMessage.textContent = 'Não foi possível marcar a notificação como lida. Tente novamente.';
  }
}

if (notificationsList) {
  notificationsList.addEventListener('click', event => {
    const botaoRevisar = event.target.closest('[data-action="review-transfer"]');
    if (botaoRevisar) {
      window.location.href = `./anuncios.html?livroId=${encodeURIComponent(botaoRevisar.dataset.id)}`;
      return;
    }

    const botaoLida = event.target.closest('[data-action="mark-read"]');
    if (botaoLida) marcarNotificacaoLida(botaoLida.dataset.id);
  });
}

if (notificationsList && notificationsMessage) {
  window.setInterval(() => {
    if (document.visibilityState === 'visible') carregarNotificacoes();
  }, 30000);
}

function criarCardAnuncio(livro) {
  const imagem = livro.imagem || (Array.isArray(livro.fotos) && livro.fotos.length ? livro.fotos[0] : 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80');
  const tipo = livro.tipo || 'troca';
  const preco = livro.preco ? ` • R$ ${livro.preco.toFixed(2).replace('.', ',')}` : '';
  const livroId = livro._id || livro.id || '';

  return `
    <article class="book-card" data-tipo="${tipo}">
      <div class="imagem" style="background-image:url('${imagem}')">
        <span class="tag ${tipo}">${tipo === 'doacao' ? 'Doação' : tipo === 'venda' ? 'Venda' : 'Troca'}</span>
      </div>
      <div class="book-info">
        <h3>${livro.titulo || 'Sem título'}</h3>
        <p class="autor">${livro.autor || 'Autor desconhecido'}</p>
        <p class="condicao">Estado: ${livro.condicao || 'Bom'}${preco}</p>
        <p class="localizacao">📍 ${livro.localizacao || 'Local não informado'}</p>
        <a href="./detalhes.html?id=${livroId}" class="btn-detalhes">Ver anúncio</a>
        <a href="./atualizarAnuncio.html?id=${livroId}" class="btn-add">Atualizar anúncio</a>
        <button type="button" class="btn-danger" data-action="delete-ad" data-id="${livroId}">Remover anúncio</button>
      </div>
    </article>
  `;
}

let pendingDeleteId = null;
const deleteModal = document.getElementById('deleteModal');
const deleteModalText = document.getElementById('deleteModalText');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const cancelDeleteBtnFooter = document.getElementById('cancelDeleteBtnFooter');

function abrirModalRemocao(livroId) {
  pendingDeleteId = livroId;
  if (deleteModalText) {
    deleteModalText.textContent = 'Deseja retirar este anúncio do catálogo? O livro continuará na sua estante.';
  }
  if (deleteModal) deleteModal.classList.remove('hidden');
}

function fecharModalRemocao() {
  pendingDeleteId = null;
  if (deleteModal) deleteModal.classList.add('hidden');
}

async function confirmarRemocao() {
  if (!pendingDeleteId) return;
  finalizarRemocao(pendingDeleteId);
}

async function finalizarRemocao(livroId) {
  fecharModalRemocao();

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    profileSectionMessage.textContent = 'Removendo anúncio...';
    const resposta = await fetchComFallback(`${URL_BASE}/livros/${livroId}`, {
      method: 'DELETE',
      headers
    });

    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(`Falha ao remover anúncio: ${resposta.status} ${texto}`);
    }

    await Promise.all([carregarMeusAnuncios(), carregarEstante()]);
    profileSectionMessage.textContent = 'Anúncio removido do catálogo; o livro continua na sua estante.';
  } catch (erro) {
    console.error(erro);
    profileSectionMessage.textContent = `Não foi possível remover o anúncio: ${erro.message}`;
  }
}

if (profileAdsGrid) {
  profileAdsGrid.addEventListener('click', event => {
    const deleteButton = event.target.closest('[data-action="delete-ad"]');
    if (!deleteButton) return;
    const livroId = deleteButton.dataset.id;
    abrirModalRemocao(livroId);
  });
}

if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', confirmarRemocao);
}

if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener('click', fecharModalRemocao);
}

if (cancelDeleteBtnFooter) {
  cancelDeleteBtnFooter.addEventListener('click', fecharModalRemocao);
}

if (refreshAdsBtn) {
  refreshAdsBtn.addEventListener('click', () => {
    const usuarioStr = localStorage.getItem('usuario');
    if (!usuarioStr) return;
    try {
      const usuario = JSON.parse(usuarioStr);
      carregarAnuncios(usuario);
    } catch (err) {
      console.error(err);
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '../index.html';
  });
}

/* ========== MODAL DE PESQUISA DE SATISFAÇÃO ========== */

/**
 * Sistema de Modal de Pesquisa de Satisfação
 * 
 * Este módulo gerencia um modal que:
 * - Exibe automaticamente na página de perfil
 * - Aparece apenas uma vez por sessão
 * - Permite redirecionar para um formulário Google Forms
 * - Pode ser fechado pelo usuário
 */

// URL do formulário Google Forms
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScUF8LR5nHp3Qe4LqKhOcd8cpDpmMwAjUfk0YoXYuq4sX0ftw/viewform?usp=publish-editor';

// Chave para controlar a exibição do modal na sessão
const MODAL_SESSION_KEY = 'satisfacao_modal_shown';

// Referências aos elementos do DOM
const satisfacaoModal = document.getElementById('satisfacaoModal');
const closeModalSatisfacaoBtn = document.getElementById('closeModalSatisfacao');
const respondPesquisaBtn = document.getElementById('respondPesquisaBtn');
const agoraNaoBtn = document.getElementById('agoraNaoBtn');

/**
 * Verifica se o modal já foi exibido nesta sessão
 * @returns {boolean} true se já foi exibido, false caso contrário
 */
function jaMostrouModalNaSessao() {
  return sessionStorage.getItem(MODAL_SESSION_KEY) === 'true';
}

/**
 * Marca o modal como exibido na sessão
 * Impede que ele apareça novamente durante a mesma sessão
 */
function marcarModalComoExibido() {
  sessionStorage.setItem(MODAL_SESSION_KEY, 'true');
}

/**
 * Abre/Exibe o modal de satisfação
 * Remove a classe 'hidden' para torná-lo visível
 */
function abrirModalSatisfacao() {
  if (satisfacaoModal) {
    satisfacaoModal.classList.remove('hidden');
    marcarModalComoExibido();
  }
}

/**
 * Fecha/Oculta o modal de satisfação
 * Adiciona a classe 'hidden' para torná-lo invisível
 */
function fecharModalSatisfacao() {
  if (satisfacaoModal) {
    satisfacaoModal.classList.add('hidden');
    marcarModalComoExibido();
  }
}

/**
 * Redireciona o usuário para o formulário Google Forms
 * Abre em uma nova aba para não perder a navegação
 */
function abrirFormulario() {
  marcarModalComoExibido();
  // Abre o formulário em uma nova aba/janela
  window.open(GOOGLE_FORM_URL, '_blank');
  // Fecha o modal após um pequeno delay
  setTimeout(() => {
    fecharModalSatisfacao();
  }, 300);
}

function escaparHtml(valor) {
  const elemento = document.createElement('span');
  elemento.textContent = String(valor ?? '');
  return elemento.innerHTML;
}

function mostrarQrPublicadoRecentemente() {
  const secao = document.getElementById('recentBookQr');
  const conteudo = document.getElementById('recentBookQrContent');
  if (!secao || !conteudo) return;
  const mensagem = document.getElementById('recentBookQrMessage');

  try {
    const livro = obterQrLivroPublicadoRecentemente();
    if (!livro) {
      if (mensagem) mensagem.textContent = 'Nenhum QR Code recente foi encontrado. Publique um livro para gerar o primeiro código.';
      return;
    }
    if (livro.qrCode) {
      const token = livro.qrUrl ? extrairTokenRastreio(livro.qrUrl) : '';
      conteudo.innerHTML = `<p>${escaparHtml(livro.titulo || 'Livro publicado')}</p><img src="${escaparHtml(livro.qrCode)}" alt="QR Code para rastrear o livro">${token ? `<a href="./rastreio.html?token=${encodeURIComponent(token)}">Abrir histórico no app</a>` : ''}`;
      secao.classList.remove('hidden');
      if (mensagem) mensagem.textContent = '';
    } else if (mensagem) {
      mensagem.textContent = 'O QR Code deste livro não está salvo neste dispositivo. Acesse Meus anúncios para gerar o código novamente.';
    }
  } catch (erro) {
    console.error('Não foi possível exibir o QR Code retornado pela publicação:', erro);
    if (mensagem) mensagem.textContent = 'Não foi possível carregar o QR Code do livro.';
  }
}

function obterListaApi(dados) {
  if (Array.isArray(dados)) return dados;
  for (const chave of ['livros', 'dados', 'data', 'estante']) {
    if (Array.isArray(dados?.[chave])) return dados[chave];
  }
  return [];
}

async function carregarMeusAnuncios() {
  if (!profileSectionMessage || !profileAdsGrid) return;
  profileSectionMessage.textContent = 'Carregando seus anúncios...';
  profileAdsGrid.innerHTML = '';
  try {
    const resposta = await requisitarApiLivros('/me/livros?page=1&limit=100');
    const anuncios = obterListaApi(resposta);
    profileSectionMessage.textContent = anuncios.length
      ? `Você tem ${anuncios.length} anúncio${anuncios.length === 1 ? '' : 's'} publicado${anuncios.length === 1 ? '' : 's'}.`
      : 'Nenhum anúncio encontrado. Publique seu primeiro livro!';
    profileAdsGrid.innerHTML = anuncios.map(criarNovoCardAnuncio).join('');
    const livroIdAlvo = new URLSearchParams(window.location.search).get('livroId');
    if (livroIdAlvo) {
      profileAdsGrid.querySelector(`[data-livro-id="${CSS.escape(livroIdAlvo)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (erro) {
    console.error('Erro ao carregar anúncios do usuário:', erro);
    profileSectionMessage.textContent = `Não foi possível carregar seus anúncios: ${erro.message}`;
  }
}

function criarNovoCardAnuncio(livro) {
  const id = String(livro.id || livro._id || '');
  const tipo = livro.tipo || 'troca';
  const qrSalvo = obterQrLivro(id);
  const qrCode = livro.qrCode || livro.qr?.qrCode || livro.data?.qrCode || qrSalvo?.qrCode || '';
  const qrUrl = livro.qrUrl || livro.qr?.qrUrl || livro.data?.qrUrl || qrSalvo?.qrUrl || '';
  const nomePedido = livro.transferenciaPendente?.solicitante?.nome
    || livro.transferenciaPendente?.usuario?.nome
    || livro.transferenciaPendente?.nome
    || 'Pessoa interessada';
  const pedido = livro.transferenciaPendente
    ? `<div class="transferencia-pendente">
        <strong>Pedido de aquisição pendente</strong>
        <p>${escaparHtml(nomePedido)}${livro.transferenciaPendente.tipoNegociacao ? ` · ${escaparHtml(livro.transferenciaPendente.tipoNegociacao)}` : ''}</p>
        <div class="acervo-actions">
          <button type="button" class="btn-add" data-action="transfer" data-choice="confirmar" data-id="${escaparHtml(id)}">Confirmar transferência</button>
          <button type="button" class="btn-secondary" data-action="transfer" data-choice="recusar" data-id="${escaparHtml(id)}">Recusar pedido</button>
        </div>
      </div>`
    : '';

  return `
    <article class="book-card" data-tipo="${escaparHtml(tipo)}" data-livro-id="${escaparHtml(id)}">
      <div class="imagem" style="background-image:url('${escaparHtml(livro.imagem || livro.fotos?.[0] || '')}')">
        <span class="tag ${escaparHtml(tipo)}">${tipo === 'doacao' ? 'Doação' : tipo === 'venda' ? 'Venda' : 'Troca'}</span>
      </div>
      <div class="book-info">
        <h3>${escaparHtml(livro.titulo || 'Sem título')}</h3>
        <p class="autor">${escaparHtml(livro.autor || 'Autor desconhecido')}</p>
        <p class="condicao">Estado: ${escaparHtml(livro.condicao || 'Bom')}</p>
        <a href="./detalhes.html?id=${encodeURIComponent(id)}" class="btn-detalhes">Ver anúncio</a>
        <a href="./atualizarAnuncio.html?id=${encodeURIComponent(id)}" class="btn-add">Atualizar anúncio</a>
        <button type="button" class="btn-secondary" data-action="show-qr" data-id="${escaparHtml(id)}" data-qr-code="${encodeURIComponent(qrCode)}" data-qr-url="${encodeURIComponent(qrUrl)}">Mostrar QR Code</button>
        <button type="button" class="btn-danger" data-action="delete-ad" data-id="${escaparHtml(id)}">Remover anúncio</button>
        <div class="book-qr hidden" data-qr-result="${escaparHtml(id)}"></div>
        ${pedido}
      </div>
    </article>`;
}

async function carregarEstante() {
  if (!shelfMessage || !ownedBooksGrid) return;
  shelfMessage.textContent = 'Carregando os livros que você possui...';
  ownedBooksGrid.innerHTML = '';
  try {
    const resposta = await requisitarApiLivros('/me/estante?page=1&limit=100');
    const livros = obterListaApi(resposta);
    shelfMessage.textContent = livros.length
      ? `Você possui ${livros.length} livro${livros.length === 1 ? '' : 's'}.`
      : 'Sua estante ainda está vazia. Livros anunciados ou adquiridos aparecem aqui.';
    ownedBooksGrid.innerHTML = livros.map(criarCardLivroAcervo).join('');
  } catch (erro) {
    console.error('Erro ao carregar a estante:', erro);
    shelfMessage.textContent = `Não foi possível carregar sua estante: ${erro.message}`;
  }
}

function criarCardLivroAcervo(livro) {
  const id = String(livro.id || livro._id || '');
  const titulo = escaparHtml(livro.titulo || 'Livro sem título');
  const estado = livro.estadoAcervo || 'normal';
  const estadoBloqueado = ['roubado', 'danificado'].includes(estado);
  const tokenRastreio = livro.tokenRastreio || livro.token || '';
  const qrSalvo = obterQrLivro(id);
  const qrCode = livro.qrCode || livro.qr?.qrCode || livro.data?.qrCode || qrSalvo?.qrCode || '';
  const qrUrl = livro.qrUrl || livro.qr?.qrUrl || livro.data?.qrUrl || qrSalvo?.qrUrl || '';
  const imagem = Array.isArray(livro.fotos) ? livro.fotos[0] : livro.imagem || livro.foto;

  return `
    <article class="book-card owned-book-card">
      ${imagem ? `<img class="owned-book-cover" src="${escaparHtml(imagem)}" alt="Capa de ${titulo}">` : ''}
      <div class="book-info">
        <h3>${titulo}</h3>
        <p class="autor">${escaparHtml(livro.autor || 'Autor desconhecido')}</p>
        <p class="acervo-status">Estado do exemplar: ${escaparHtml(estado)}</p>
        ${tokenRastreio ? `<a class="btn-detalhes" href="./rastreio.html?token=${encodeURIComponent(tokenRastreio)}">Ver histórico</a>` : ''}
        <button type="button" class="btn-secondary" data-action="show-qr" data-id="${escaparHtml(id)}" data-qr-code="${encodeURIComponent(qrCode)}" data-qr-url="${encodeURIComponent(qrUrl)}">Mostrar QR Code</button>
        <div class="book-qr hidden" data-qr-result="${escaparHtml(id)}"></div>
        <div class="acervo-actions">
          <button type="button" class="btn-secondary" data-action="mark-state" data-id="${escaparHtml(id)}" data-state="danificado" ${estadoBloqueado ? 'disabled' : ''}>Marcar danificado</button>
          <button type="button" class="btn-danger" data-action="mark-state" data-id="${escaparHtml(id)}" data-state="roubado" ${estadoBloqueado ? 'disabled' : ''}>Marcar roubado</button>
        </div>
      </div>
    </article>`;
}

async function mostrarQrDoAnuncio(livroId, qrCodeCodificado, qrUrlCodificada, container) {
  container.classList.remove('hidden');
  let qrCode = decodeURIComponent(qrCodeCodificado || '');
  let qrUrl = decodeURIComponent(qrUrlCodificada || '');
  if (!qrCode) {
    container.textContent = 'Gerando QR Code...';
    try {
      const dados = await requisitarApiLivros(`/livros/${encodeURIComponent(livroId)}/qrcode`);
      qrCode = dados?.qrCode || dados?.qr?.qrCode || dados?.data?.qrCode || '';
      qrUrl = dados?.qrUrl || dados?.qr?.qrUrl || dados?.data?.qrUrl || qrUrl;
    } catch (erro) {
      console.error('Erro ao gerar QR Code do livro:', erro);
      container.textContent = `Não foi possível gerar o QR Code: ${erro.message}`;
      return;
    }
  }
  const token = qrUrl ? extrairTokenRastreio(qrUrl) : '';
  container.innerHTML = qrCode
    ? `<img src="${escaparHtml(qrCode)}" alt="QR Code para negociar o livro">${token ? `<a href="./rastreio.html?token=${encodeURIComponent(token)}">Abrir negociação no app</a>` : ''}`
    : `A API não retornou uma imagem de QR Code para este livro.${token ? ` <a href="./rastreio.html?token=${encodeURIComponent(token)}">Abrir negociação no app</a>` : ''}`;
}

if (profileAdsGrid) {
  profileAdsGrid.addEventListener('click', async evento => {
    const botao = evento.target.closest('[data-action]');
    if (!botao) return;

    const livroId = botao.dataset.id;
    if (botao.dataset.action === 'show-qr') {
      const output = profileAdsGrid.querySelector(`[data-qr-result="${CSS.escape(livroId)}"]`);
      if (output) await mostrarQrDoAnuncio(livroId, botao.dataset.qrCode, botao.dataset.qrUrl, output);
      return;
    }

    if (botao.dataset.action !== 'transfer') return;
    const escolha = botao.dataset.choice;
    botao.disabled = true;
    const textoOriginal = botao.textContent;
    botao.textContent = 'Processando...';
    try {
      await requisitarApiLivros(`/livros/${encodeURIComponent(livroId)}/aquisicoes/${escolha}`, {
        method: 'POST'
      });
      profileSectionMessage.textContent = escolha === 'confirmar'
        ? 'Aquisição confirmada. A estante do novo proprietário será atualizada.'
        : 'Pedido de aquisição recusado.';
      await Promise.all([carregarMeusAnuncios(), carregarEstante()]);
    } catch (erro) {
      console.error(`Erro ao ${escolha} aquisição:`, erro);
      profileSectionMessage.textContent = `Não foi possível processar o pedido: ${erro.message}`;
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  });
}

if (ownedBooksGrid) {
  ownedBooksGrid.addEventListener('click', async evento => {
    const qrButton = evento.target.closest('[data-action="show-qr"]');
    if (qrButton) {
      const output = ownedBooksGrid.querySelector(`[data-qr-result="${CSS.escape(qrButton.dataset.id)}"]`);
      if (output) await mostrarQrDoAnuncio(qrButton.dataset.id, qrButton.dataset.qrCode, qrButton.dataset.qrUrl, output);
      return;
    }

    const botao = evento.target.closest('[data-action="mark-state"]');
    if (!botao) return;
    botao.disabled = true;
    shelfMessage.textContent = 'Atualizando o estado do exemplar...';
    try {
      await requisitarApiLivros(`/me/estante/${encodeURIComponent(botao.dataset.id)}/estado`, {
        method: 'PUT',
        body: { estadoAcervo: botao.dataset.state }
      });
      await carregarEstante();
    } catch (erro) {
      console.error('Erro ao atualizar o estado do livro:', erro);
      shelfMessage.textContent = `Não foi possível atualizar o exemplar: ${erro.message}`;
      botao.disabled = false;
    }
  });
}

function extrairTokenRastreio(valor) {
  try {
    const url = new URL(valor);
    const correspondencia = url.pathname.match(/\/livros\/rastreio\/([^/]+)\/?$/);
    return correspondencia ? decodeURIComponent(correspondencia[1]) : url.searchParams.get('token');
  } catch {
    return valor.trim();
  }
}

if (scanQrBtn) {
  scanQrBtn.addEventListener('click', async () => {
    scanQrBtn.disabled = true;
    scanFeedback.textContent = 'Preparando o leitor de QR Code...';
    try {
      const [{ BarcodeScanner, BarcodeFormat }, { Capacitor }] = await Promise.all([
        import('@capacitor-mlkit/barcode-scanning'),
        import('@capacitor/core')
      ]);
      if (Capacitor.getPlatform() !== 'android') {
        throw new Error('A leitura pela câmera está disponível no aplicativo Android.');
      }

      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) throw new Error('Este aparelho não possui uma câmera compatível.');
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        scanFeedback.textContent = 'Instalando o leitor de QR Code do Google...';
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        const resultadoInstalacao = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!resultadoInstalacao.available) {
          scanFeedback.textContent = 'A instalação foi iniciada. Aguarde alguns segundos e toque novamente para ler o QR Code.';
          return;
        }
      }

      scanFeedback.textContent = 'Aponte a câmera para o QR Code do livro.';
      const resultado = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
        autoZoom: true
      });
      const valor = resultado.barcodes?.[0]?.rawValue;
      if (!valor) {
        scanFeedback.textContent = 'Nenhum QR Code foi lido.';
        return;
      }
      const token = extrairTokenRastreio(valor);
      if (!token) throw new Error('O QR Code não contém um link ou token válido.');
      window.location.href = `./rastreio.html?token=${encodeURIComponent(token)}`;
    } catch (erro) {
      console.error('Erro ao ler QR Code:', erro);
      scanFeedback.textContent = erro.message || 'Não foi possível abrir o leitor de QR Code.';
    } finally {
      scanQrBtn.disabled = false;
    }
  });
}

/**
 * Event Listener: Clicar no overlay (fundo escurecido)
 * Se clicar exatamente no overlay, fecha o modal
 */
if (satisfacaoModal && paginaPerfil === 'perfil') {
  satisfacaoModal.addEventListener('click', (event) => {
    // Se o clique for no overlay e não no conteúdo do modal
    if (event.target === satisfacaoModal) {
      fecharModalSatisfacao();
    }
  });
}

/**
 * Event Listener: Botão de fechar (X)
 * Localizado no canto superior direito do modal
 */
if (closeModalSatisfacaoBtn) {
  closeModalSatisfacaoBtn.addEventListener('click', (event) => {
    event.preventDefault();
    fecharModalSatisfacao();
  });
}

/**
 * Event Listener: Botão "Responder Pesquisa"
 * Redireciona para o formulário Google Forms em uma nova aba
 */
if (respondPesquisaBtn) {
  respondPesquisaBtn.addEventListener('click', (event) => {
    event.preventDefault();
    abrirFormulario();
  });
}

/**
 * Event Listener: Botão "Agora Não"
 * Fecha o modal sem redirecionar
 * O modal não reaparece durante a mesma sessão
 */
if (agoraNaoBtn) {
  agoraNaoBtn.addEventListener('click', (event) => {
    event.preventDefault();
    fecharModalSatisfacao();
  });
}

/**
 * Exibe o modal automaticamente na primeira vez
 * Executado ao carregar a página de perfil
 * 
 * Lógica:
 * 1. Aguarda o carregamento do perfil
 * 2. Verifica se o modal já foi exibido nesta sessão
 * 3. Se não, exibe o modal automaticamente
 * 4. Marca como exibido para não aparecer novamente
 */
window.addEventListener('DOMContentLoaded', () => {
  carregarPerfil();
  if (paginaPerfil === 'perfil') {
    setTimeout(() => {
      if (!jaMostrouModalNaSessao()) abrirModalSatisfacao();
    }, 800);
  }
});