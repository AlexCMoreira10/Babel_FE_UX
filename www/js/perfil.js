import {
  obterQrLivro,
  obterQrLivroPublicadoRecentemente,
  requisitarApiLivros
} from './books-api.js';
import { resolverUrlImagem } from './image-utils.js';

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
const profileForm = document.getElementById('profileForm');
const profilePhoneList = document.getElementById('profilePhoneList');
const profileEditBtn = document.getElementById('profileEditBtn');
const profileSaveBtn = document.getElementById('profileSaveBtn');
const profileCancelBtn = document.getElementById('profileCancelBtn');
const profileEditFeedback = document.getElementById('profileEditFeedback');
const addProfilePhoneBtn = document.getElementById('addProfilePhoneBtn');
const retryLocationSyncBtn = document.getElementById('retryLocationSyncBtn');

const URL_BASE_LOCAL = 'http://localhost:3000/api';
const URL_BASE_REMOTE = 'https://babel-be-lovat.vercel.app/api';

let URL_BASE = URL_BASE_LOCAL;
let perfilAtual = null;
let modoEdicaoPerfil = false;
let sincronizacaoLocalizacaoEmAndamento = false;
let coordenadasLimpezaPorEndereco = false;

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

function formatarDataNascimento(valor) {
  if (!valor) return '';

  const segundos = typeof valor === 'object' ? valor._seconds ?? valor.seconds : null;
  const data = valor instanceof Date
    ? valor
    : Number.isFinite(segundos)
      ? new Date(segundos * 1000)
      : new Date(valor);

  return Number.isNaN(data.getTime()) ? '' : data.toISOString().slice(0, 10);
}

function definirModoEdicaoPerfil(editar) {
  modoEdicaoPerfil = editar;
  profileForm.querySelectorAll('input').forEach(input => {
    input.disabled = !editar;
  });
  profilePhoneList.querySelectorAll('.profile-phone-remove').forEach(button => {
    button.disabled = !editar;
  });
  addProfilePhoneBtn.disabled = !editar;
  profileEditBtn.classList.toggle('hidden', editar);
  profileSaveBtn.classList.toggle('hidden', !editar);
  profileCancelBtn.classList.toggle('hidden', !editar);
}

function adicionarCampoTelefone(telefone = '') {
  const linha = document.createElement('div');
  linha.className = 'profile-phone-row';

  const input = document.createElement('input');
  input.name = 'profilePhone';
  input.type = 'tel';
  input.autocomplete = 'tel';
  input.placeholder = '(11) 99999-9999';
  input.setAttribute('aria-label', 'Telefone para contato');
  input.required = true;
  input.value = telefone;
  input.disabled = !modoEdicaoPerfil;

  const remover = document.createElement('button');
  remover.className = 'profile-phone-remove';
  remover.type = 'button';
  remover.textContent = 'Remover';
  remover.setAttribute('aria-label', 'Remover telefone');
  remover.disabled = !modoEdicaoPerfil;
  remover.addEventListener('click', () => linha.remove());

  linha.append(input, remover);
  profilePhoneList.append(linha);
}

function preencherFormularioPerfil(perfil) {
  coordenadasLimpezaPorEndereco = false;
  const definirValor = (seletor, valor) => {
    const campo = profileForm.querySelector(seletor);
    if (campo) campo.value = valor ?? '';
  };
  const endereco = perfil.endereco || {};
  const coordenadas = perfil.geocode?.coordinates || [];

  document.getElementById('perfilEmail').textContent = perfil.email || 'Não informado';
  document.getElementById('perfilUid').textContent = perfil.uid || perfil.id || 'Não disponível';
  definirValor('#profileName', perfil.nome || perfil.displayName || '');
  definirValor('#profileBirthDate', formatarDataNascimento(perfil.data_nascimento));

  profilePhoneList.replaceChildren();
  const telefones = Array.isArray(perfil.telefone) ? perfil.telefone : [];
  (telefones.length ? telefones : ['']).forEach(adicionarCampoTelefone);

  definirValor('#profileCep', endereco.cep);
  definirValor('#profileStreet', endereco.rua);
  definirValor('#profileNumber', endereco.numero);
  definirValor('#profileComplement', endereco.complemento);
  definirValor('#profileNeighborhood', endereco.bairro);
  definirValor('#profileCity', endereco.cidade);
  definirValor('#profileState', endereco.estado);
  definirValor('#profileLongitude', coordenadas[0]);
  definirValor('#profileLatitude', coordenadas[1]);
  retryLocationSyncBtn?.classList.toggle(
    'hidden',
    perfil.localizacaoSyncStatus !== 'pendente'
  );
}

async function carregarDadosPerfil() {
  profileEditFeedback.textContent = 'Carregando seus dados pessoais...';
  try {
    perfilAtual = await requisitarApiLivros('/me');
    preencherFormularioPerfil(perfilAtual);
    profileEditFeedback.textContent = '';
  } catch (erro) {
    console.error('Erro ao carregar dados pessoais:', erro);
    profileEditFeedback.textContent = 'Não foi possível carregar seus dados pessoais. Tente novamente.';
    profileEditFeedback.classList.add('erro');
  }
}

function obterEnderecoFormularioPerfil() {
  return Object.fromEntries(
    ['rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep']
      .map(campo => [campo, profileForm.elements.namedItem(campo).value.trim()])
  );
}

function enderecoLocalizacaoMudou(endereco) {
  const anterior = perfilAtual?.endereco || {};
  return ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'].some(campo =>
    String(anterior[campo] ?? '').trim().toLocaleLowerCase('pt-BR') !==
    String(endereco[campo] ?? '').trim().toLocaleLowerCase('pt-BR')
  );
}

function obterDadosFormularioPerfil() {
  const telefone = [...profilePhoneList.querySelectorAll('input[name="profilePhone"]')]
    .map(input => input.value.trim())
    .filter(Boolean);
  const longitude = document.getElementById('profileLongitude').value;
  const latitude = document.getElementById('profileLatitude').value;
  const endereco = obterEnderecoFormularioPerfil();
  const geocode = enderecoLocalizacaoMudou(endereco) || (longitude === '' && latitude === '')
    ? null
    : {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)]
      };

  return {
    nome: document.getElementById('profileName').value.trim(),
    telefone,
    data_nascimento: document.getElementById('profileBirthDate').value,
    endereco,
    geocode
  };
}

async function salvarPerfil(evento) {
  evento.preventDefault();
  if (!profileForm.reportValidity()) return;

  const dados = obterDadosFormularioPerfil();
  if (!dados.telefone.length) {
    profileEditFeedback.textContent = 'Informe ao menos um telefone para contato.';
    profileEditFeedback.classList.add('erro');
    return;
  }
  const longitudePreenchida = document.getElementById('profileLongitude').value !== '';
  const latitudePreenchida = document.getElementById('profileLatitude').value !== '';
  if (longitudePreenchida !== latitudePreenchida) {
    profileEditFeedback.textContent = 'Preencha longitude e latitude ou deixe os dois campos vazios.';
    profileEditFeedback.classList.add('erro');
    return;
  }
  if (dados.geocode && dados.geocode.coordinates.some(coordenada => !Number.isFinite(coordenada))) {
    profileEditFeedback.textContent = 'Preencha longitude e latitude ou deixe os dois campos vazios.';
    profileEditFeedback.classList.add('erro');
    return;
  }

  profileSaveBtn.disabled = true;
  profileEditFeedback.classList.remove('erro', 'sucesso');
  profileEditFeedback.textContent = 'Salvando alterações...';
  try {
    perfilAtual = await requisitarApiLivros('/me', { method: 'PUT', body: dados });
    preencherFormularioPerfil(perfilAtual);

    const usuarioSessao = JSON.parse(localStorage.getItem('usuario') || '{}');
    localStorage.setItem('usuario', JSON.stringify({
      ...usuarioSessao,
      displayName: perfilAtual.nome
    }));

    definirModoEdicaoPerfil(false);
    profileEditFeedback.textContent = perfilAtual.avisoLocalizacao
      || (perfilAtual.localizacaoSyncStatus === 'pendente'
        ? 'O perfil foi salvo; a localização dos anúncios está pendente. Tente sincronizar novamente.'
        : 'Seus dados foram atualizados com sucesso.');
    profileEditFeedback.classList.add(
      perfilAtual.avisoLocalizacao || perfilAtual.localizacaoSyncStatus === 'pendente'
        ? 'erro'
        : 'sucesso'
    );
  } catch (erro) {
    console.error('Erro ao salvar dados pessoais:', erro);
    profileEditFeedback.textContent = erro.status === 400
      ? erro.message
      : 'Não foi possível salvar seus dados. Tente novamente.';
    profileEditFeedback.classList.add('erro');
  } finally {
    profileSaveBtn.disabled = false;
  }
}

async function repetirSincronizacaoLocalizacao() {
  if (sincronizacaoLocalizacaoEmAndamento) return;
  sincronizacaoLocalizacaoEmAndamento = true;
  retryLocationSyncBtn.disabled = true;
  profileEditFeedback.classList.remove('erro', 'sucesso');
  profileEditFeedback.textContent = 'Sincronizando a localização dos seus anúncios...';

  try {
    const resultado = await requisitarApiLivros('/me/localizacao/sincronizar', {
      method: 'POST',
      body: {}
    });
    perfilAtual.localizacaoSyncStatus = resultado.status;
    preencherFormularioPerfil(perfilAtual);
    profileEditFeedback.textContent = resultado.status === 'sincronizado'
      ? `${resultado.anunciosAtualizados} anúncio(s) sincronizado(s).`
      : 'A sincronização ainda está pendente. Tente novamente.';
    profileEditFeedback.classList.add(resultado.status === 'sincronizado' ? 'sucesso' : 'erro');
  } catch (erro) {
    console.error('Erro ao repetir sincronização da localização:', erro);
    profileEditFeedback.textContent = erro.message || 'Não foi possível sincronizar os anúncios.';
    profileEditFeedback.classList.add('erro');
  } finally {
    sincronizacaoLocalizacaoEmAndamento = false;
    retryLocationSyncBtn.disabled = false;
  }
}

function inicializarEdicaoPerfil() {
  if (!profileForm) return;

  profileEditBtn.addEventListener('click', () => {
    definirModoEdicaoPerfil(true);
    profileEditFeedback.classList.remove('erro', 'sucesso');
    profileEditFeedback.textContent = '';
  });
  profileCancelBtn.addEventListener('click', () => {
    if (perfilAtual) preencherFormularioPerfil(perfilAtual);
    definirModoEdicaoPerfil(false);
    profileEditFeedback.classList.remove('erro', 'sucesso');
    profileEditFeedback.textContent = '';
  });
  addProfilePhoneBtn.addEventListener('click', () => adicionarCampoTelefone());
  profileForm.addEventListener('submit', salvarPerfil);
  retryLocationSyncBtn?.addEventListener('click', repetirSincronizacaoLocalizacao);
  ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'].forEach(campo => {
    profileForm.elements.namedItem(campo).addEventListener('input', () => {
      if (!perfilAtual) return;
      if (enderecoLocalizacaoMudou(obterEnderecoFormularioPerfil())) {
        if (!coordenadasLimpezaPorEndereco) {
          document.getElementById('profileLongitude').value = '';
          document.getElementById('profileLatitude').value = '';
          coordenadasLimpezaPorEndereco = true;
        }
        profileEditFeedback.classList.remove('sucesso', 'erro');
        profileEditFeedback.textContent =
          'O endereço mudou. Ao salvar, tentaremos obter coordenadas aproximadas pelo endereço/CEP; não usaremos o GPS atual.';
        return;
      }

      if (coordenadasLimpezaPorEndereco) {
        const coordenadas = perfilAtual.geocode?.coordinates || [];
        document.getElementById('profileLongitude').value = coordenadas[0] ?? '';
        document.getElementById('profileLatitude').value = coordenadas[1] ?? '';
        coordenadasLimpezaPorEndereco = false;
      }
    });
  });
}

function carregarPerfil() {
  const usuarioStr = localStorage.getItem('usuario');

  if (!usuarioStr || !localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const usuario = JSON.parse(usuarioStr);
    const nomePerfil = document.getElementById('profileName');
    if (nomePerfil) nomePerfil.value = usuario.displayName || 'Usuário';
    if (perfilEmail) perfilEmail.textContent = usuario.email || 'Não informado';
    if (perfilUid) perfilUid.textContent = usuario.uid || 'Não disponível';
    if (paginaPerfil === 'perfil' && profileForm) carregarDadosPerfil();

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
  const imagem = resolverUrlImagem(livro.imagem || (Array.isArray(livro.fotos) && livro.fotos.length ? livro.fotos[0] : ''));
  const tipo = livro.tipo || 'troca';
  const preco = livro.preco ? ` • R$ ${livro.preco.toFixed(2).replace('.', ',')}` : '';
  const livroId = livro._id || livro.id || '';

  return `
    <article class="book-card" data-tipo="${tipo}">
      <div class="imagem">
        <img src="${escaparHtml(imagem)}" alt="Capa de ${escaparHtml(livro.titulo || 'livro')}">
        <span class="tag ${tipo}">${tipo === 'doacao' ? 'Doação' : tipo === 'venda' ? 'Venda' : 'Troca'}</span>
      </div>
      <div class="book-info">
        <h3>${livro.titulo || 'Sem título'}</h3>
        <p class="autor">${livro.autor || 'Autor desconhecido'}</p>
        <p class="condicao">Estado: ${livro.condicao || 'Bom'}${preco}</p>
        <p class="localizacao">📍 ${livro.localizacao || 'Local não informado'}</p>
        <a href="./detalhes.html?id=${livroId}" class="btn-detalhes">Ver anúncio</a>
        <a href="./atualizarAnuncio.html?id=${livroId}" class="btn-add">Atualizar anúncio</a>
        <button type="button" class="btn-danger" data-action="delete-ad" data-id="${livroId}">Excluir anúncio</button>
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
  await finalizarRemocao(pendingDeleteId);
}

async function finalizarRemocao(livroId) {
  if (confirmDeleteBtn) {
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Excluindo...';
  }
  try {
    profileSectionMessage.textContent = 'Removendo anúncio...';
    await requisitarApiLivros(`/livros/${encodeURIComponent(livroId)}`, {
      method: 'DELETE',
    });
    fecharModalRemocao();
    await Promise.all([carregarMeusAnuncios(), carregarEstante()]);
    profileSectionMessage.textContent = 'Anúncio removido do catálogo; o livro continua na sua estante.';
  } catch (erro) {
    console.error(erro);
    profileSectionMessage.textContent = `Não foi possível remover o anúncio: ${erro.message}`;
  } finally {
    if (confirmDeleteBtn) {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Excluir anúncio';
    }
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
  const imagem = resolverUrlImagem(livro.imagem || livro.fotos?.[0] || livro.foto || '');
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
      <div class="imagem">
        <img src="${escaparHtml(imagem)}" alt="Capa de ${escaparHtml(livro.titulo || 'livro')}">
        <span class="tag ${escaparHtml(tipo)}">${tipo === 'doacao' ? 'Doação' : tipo === 'venda' ? 'Venda' : 'Troca'}</span>
      </div>
      <div class="book-info">
        <h3>${escaparHtml(livro.titulo || 'Sem título')}</h3>
        <p class="autor">${escaparHtml(livro.autor || 'Autor desconhecido')}</p>
        <p class="condicao">Estado: ${escaparHtml(livro.condicao || 'Bom')}</p>
        <a href="./detalhes.html?id=${encodeURIComponent(id)}" class="btn-detalhes">Ver anúncio</a>
        <a href="./atualizarAnuncio.html?id=${encodeURIComponent(id)}" class="btn-add">Atualizar anúncio</a>
        <button type="button" class="btn-secondary" data-action="show-qr" data-id="${escaparHtml(id)}" data-qr-code="${encodeURIComponent(qrCode)}" data-qr-url="${encodeURIComponent(qrUrl)}">Mostrar QR Code</button>
        <button type="button" class="btn-danger" data-action="delete-ad" data-id="${escaparHtml(id)}">Excluir anúncio</button>
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
  const marcadoRoubadoPerdido = ['roubado', 'perdido'].includes(estado);
  const estadoBloqueado = estado !== 'normal';
  const tokenRastreio = livro.tokenRastreio || livro.token || '';
  const qrSalvo = obterQrLivro(id);
  const qrCode = livro.qrCode || livro.qr?.qrCode || livro.data?.qrCode || qrSalvo?.qrCode || '';
  const qrUrl = livro.qrUrl || livro.qr?.qrUrl || livro.data?.qrUrl || qrSalvo?.qrUrl || '';
  const tokenNegociacao = tokenRastreio || (qrUrl ? extrairTokenRastreio(qrUrl) : '');
  const imagem = resolverUrlImagem(Array.isArray(livro.fotos) ? livro.fotos[0] : livro.imagem || livro.foto || '');

  return `
    <article class="book-card owned-book-card">
      <img class="owned-book-cover" src="${escaparHtml(imagem)}" alt="Capa de ${titulo}">
      <div class="book-info">
        <h3>${titulo}</h3>
        <p class="autor">${escaparHtml(livro.autor || 'Autor desconhecido')}</p>
        <p class="acervo-status">Estado do exemplar: ${marcadoRoubadoPerdido ? 'Roubado ou perdido' : escaparHtml(estado)}</p>
        <button type="button" class="btn-add" data-action="open-history" data-id="${escaparHtml(id)}" data-token="${escaparHtml(tokenNegociacao)}">Abrir negociações</button>
        <button type="button" class="btn-secondary" data-action="show-qr" data-id="${escaparHtml(id)}" data-qr-code="${encodeURIComponent(qrCode)}" data-qr-url="${encodeURIComponent(qrUrl)}">Mostrar QR Code</button>
        <div class="book-qr hidden" data-qr-result="${escaparHtml(id)}"></div>
        <div class="acervo-actions">
          <button type="button" class="btn-secondary" data-action="mark-state" data-id="${escaparHtml(id)}" data-state="danificado" ${estadoBloqueado ? 'disabled' : ''}>Marcar danificado</button>
          <button type="button" class="${marcadoRoubadoPerdido ? 'btn-secondary' : 'btn-danger'}" data-action="mark-state" data-id="${escaparHtml(id)}" data-state="${marcadoRoubadoPerdido ? 'normal' : 'roubado'}" ${estadoBloqueado && !marcadoRoubadoPerdido ? 'disabled' : ''}>${marcadoRoubadoPerdido ? 'Desativar marcação' : 'Marcar roubado ou perdido'}</button>
        </div>
      </div>
    </article>`;
}

async function abrirNegociacoes(livroId, tokenConhecido) {
  let token = tokenConhecido;
  if (!token) {
    const dados = await requisitarApiLivros(`/livros/${encodeURIComponent(livroId)}/qrcode`);
    const qrUrl = dados?.qrUrl || dados?.qr?.qrUrl || dados?.data?.qrUrl || '';
    token = dados?.tokenRastreio || dados?.token || dados?.qr?.tokenRastreio
      || dados?.data?.tokenRastreio || (qrUrl ? extrairTokenRastreio(qrUrl) : '');
  }
  if (!token) throw new Error('A API não retornou um identificador para abrir as negociações.');
  window.location.href = `./rastreio.html?token=${encodeURIComponent(token)}&origem=estante`;
}

async function mostrarQrDoAnuncio(livroId, qrCodeCodificado, qrUrlCodificada, container, origem) {
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
  const parametroOrigem = origem ? `&origem=${encodeURIComponent(origem)}` : '';
  container.innerHTML = qrCode
    ? `<img src="${escaparHtml(qrCode)}" alt="QR Code para negociar o livro">${token ? `<a href="./rastreio.html?token=${encodeURIComponent(token)}${parametroOrigem}">Abrir negociação no app</a>` : ''}`
    : `A API não retornou uma imagem de QR Code para este livro.${token ? ` <a href="./rastreio.html?token=${encodeURIComponent(token)}${parametroOrigem}">Abrir negociação no app</a>` : ''}`;
}

if (profileAdsGrid) {
  profileAdsGrid.addEventListener('click', async evento => {
    const botao = evento.target.closest('[data-action]');
    if (!botao) return;

    const livroId = botao.dataset.id;
    if (botao.dataset.action === 'show-qr') {
      const output = profileAdsGrid.querySelector(`[data-qr-result="${CSS.escape(livroId)}"]`);
      if (output) await mostrarQrDoAnuncio(livroId, botao.dataset.qrCode, botao.dataset.qrUrl, output, 'anuncios');
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
    const botao = evento.target.closest('[data-action="open-history"]');
    if (!botao) return;

    botao.disabled = true;
    const textoOriginal = botao.textContent;
    botao.textContent = 'Abrindo...';
    try {
      await abrirNegociacoes(botao.dataset.id, botao.dataset.token);
    } catch (erro) {
      console.error('Erro ao abrir as negociações do livro:', erro);
      shelfMessage.textContent = `Não foi possível abrir as negociações: ${erro.message}`;
    } finally {
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
      if (output) await mostrarQrDoAnuncio(qrButton.dataset.id, qrButton.dataset.qrCode, qrButton.dataset.qrUrl, output, 'estante');
      return;
    }

    const botao = evento.target.closest('[data-action="mark-state"]');
    if (!botao) return;
    const ativando = botao.dataset.state !== 'normal';
    const confirmacao = ativando
      ? 'Confirma marcar este livro como roubado ou perdido? Ele deixará de aparecer no catálogo e não poderá ser negociado.'
      : 'Confirma desativar a marcação de roubado ou perdido? O livro poderá voltar a aparecer no catálogo, conforme o status do anúncio.';
    if (!window.confirm(confirmacao)) return;

    botao.disabled = true;
    shelfMessage.textContent = ativando
      ? 'Marcando o livro como roubado ou perdido...'
      : 'Desativando a marcação do livro...';
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
    const url = new URL(valor, window.location.href);
    const correspondencia = url.pathname.match(/\/livros\/rastreio\/([^/]+)\/?$/);
    return correspondencia
      ? decodeURIComponent(correspondencia[1])
      : url.searchParams.get('token') || valor.trim();
  } catch {
    return typeof valor === 'string' ? valor.trim() : '';
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
  inicializarEdicaoPerfil();
  carregarPerfil();
  if (paginaPerfil === 'perfil') {
    setTimeout(() => {
      if (!jaMostrouModalNaSessao()) abrirModalSatisfacao();
    }, 800);
  }
});