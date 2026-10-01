const perfilNome = document.getElementById('perfilNome');
const perfilEmail = document.getElementById('perfilEmail');
const perfilUid = document.getElementById('perfilUid');
const logoutBtn = document.getElementById('logoutBtn');
const refreshAdsBtn = document.getElementById('refreshAdsBtn');
const profileAdsGrid = document.getElementById('profileAdsGrid');
const profileSectionMessage = document.getElementById('profileSectionMessage');
const notificationsList = document.getElementById('notificationsList');
const notificationsMessage = document.getElementById('notificationsMessage');

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

  if (!usuarioStr) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const usuario = JSON.parse(usuarioStr);
    perfilNome.textContent = usuario.displayName || 'Usuário';
    perfilEmail.textContent = usuario.email || 'Não informado';
    perfilUid.textContent = usuario.uid || 'Não disponível';
    carregarAnuncios(usuario);
    carregarNotificacoes();
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
    <div class="notification-card ${lida ? 'notification-read' : 'notification-unread'}" data-id="${id}">
      <div class="notification-title">${titulo}</div>
      <div class="notification-body">${texto}</div>
      <div class="notification-meta">
        <span>${displayDate}</span>
        <span>${lida ? 'Lida' : 'Não lida'}</span>
      </div>
      <div class="notification-actions">
        <button type="button" class="btn-secondary" data-action="mark-read" data-id="${id}" ${lida ? 'disabled' : ''}>Marcar como lida</button>
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
    const button = event.target.closest('[data-action="mark-read"]');
    if (!button) return;
    const notificacaoId = button.dataset.id;
    marcarNotificacaoLida(notificacaoId);
  });
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

function abrirModalRemocao(livroId) {
  pendingDeleteId = livroId;
  if (deleteModalText) {
    deleteModalText.textContent = 'Deseja realmente remover este anúncio? Esta ação não pode ser desfeita.';
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

    profileSectionMessage.textContent = 'Anúncio removido com sucesso.';
    const usuarioStr = localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        const usuario = JSON.parse(usuarioStr);
        carregarAnuncios(usuario);
      } catch (erro) {
        console.error('Erro ao recarregar anúncios após remover:', erro);
      }
    }
  } catch (erro) {
    console.error(erro);
    profileSectionMessage.textContent = 'Não foi possível remover o anúncio. Tente novamente.';
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

/**
 * Event Listener: Clicar no overlay (fundo escurecido)
 * Se clicar exatamente no overlay, fecha o modal
 */
if (satisfacaoModal) {
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
  // Carrega o perfil do usuário (função original)
  carregarPerfil();
  
  // Aguarda um pequeno tempo para garantir que o DOM está pronto
  setTimeout(() => {
    // Verifica se ainda não foi exibido nesta sessão
    if (!jaMostrouModalNaSessao()) {
      abrirModalSatisfacao();
    }
  }, 800);
});