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

window.addEventListener('DOMContentLoaded', carregarPerfil);