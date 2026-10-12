/**
 * Sistema de mensagens da plataforma.
 * Gerencia conversas, histórico paginado, leitura e envio de mensagens.
 */

const URL_BASE_LOCAL = 'http://localhost:3000/api';
const URL_BASE_REMOTE = 'https://babel-be-lovat.vercel.app/api';

let URL_BASE = URL_BASE_LOCAL;

async function fetchComFallback(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (erro) {
    if (URL_BASE === URL_BASE_LOCAL && url.includes(URL_BASE_LOCAL)) {
      console.warn(`Falha ao conectar em ${URL_BASE_LOCAL}, tentando ${URL_BASE_REMOTE}...`);
      URL_BASE = URL_BASE_REMOTE;
      return fetch(url.replace(URL_BASE_LOCAL, URL_BASE_REMOTE), options);
    }
    throw erro;
  }
}

const conversasList = document.getElementById('conversasList');
const chatVazio = document.getElementById('chatVazio');
const chatAtivo = document.getElementById('chatAtivo');
const mensagensArea = document.getElementById('mensagensArea');
const chatNome = document.getElementById('chatNome');
const chatStatus = document.getElementById('chatStatus');
const formEnviarMensagem = document.getElementById('formEnviarMensagem');
const inputMensagem = document.getElementById('inputMensagem');
const filtroConversa = document.getElementById('filtroConversa');
const btnFecharChat = document.getElementById('btnFecharChat');

let usuarioLogado = null;
let conversaSelecionada = null;
let conversas = [];
let atualizacaoEmAndamento = false;
const mensagensLidas = new Set();

function verificarLogin() {
  const usuarioStr = localStorage.getItem('usuario');
  const token = localStorage.getItem('token');

  if (!usuarioStr || !token) {
    window.location.href = './login.html';
    return false;
  }

  try {
    usuarioLogado = JSON.parse(usuarioStr);
    if (!usuarioLogado?.uid) {
      throw new Error('O usuário autenticado não possui UID.');
    }
    return true;
  } catch (erro) {
    console.error('Erro ao carregar usuário:', erro);
    window.location.href = './login.html';
    return false;
  }
}

function obterHeaders(json = false) {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Sua sessão expirou. Entre novamente para acessar as mensagens.');
  }

  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`
  };
}

async function requisitarJson(url, options = {}) {
  const resposta = await fetchComFallback(url, {
    ...options,
    headers: { ...obterHeaders(Boolean(options.body)), ...options.headers }
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Erro ${resposta.status} ao acessar mensagens${detalhe ? `: ${detalhe}` : '.'}`);
  }

  if (resposta.status === 204) return null;
  return resposta.json();
}

function obterMensagensDaResposta(dados) {
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.mensagens)) return dados.mensagens;
  throw new Error('A resposta da API não contém uma lista de mensagens válida.');
}

function obterIdMensagem(mensagem) {
  return String(mensagem?.id ?? mensagem?._id ?? '');
}

function obterDataMensagem(mensagem) {
  const data = new Date(mensagem?.data_envio);
  return Number.isNaN(data.getTime()) ? null : data;
}

function obterNomeParticipante(conversa) {
  const nome = conversa.participante?.nome;
  return typeof nome === 'string' && nome.trim()
    ? nome.trim()
    : conversa.participante?.id || conversa.id_usuario || 'Usuário';
}

function obterFotoValida(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const foto = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(foto.protocol) ? foto.href : '';
  } catch {
    return '';
  }
}

function obterAvatarHtml(nome, foto) {
  const iniciais = escaparHTML(nome.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?');
  const fotoValida = obterFotoValida(foto);
  return fotoValida
    ? `<img class="conversa-avatar-imagem" src="${escaparHTML(fotoValida)}" alt="">`
    : `<span class="conversa-avatar-inicial">${iniciais}</span>`;
}

function formatarHora(data) {
  if (!data) return '';
  const agora = new Date();
  const mesmoDia = data.toDateString() === agora.toDateString();
  if (mesmoDia) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto ?? '');
  return div.innerHTML;
}

async function carregarConversas({ silencioso = false } = {}) {
  if (!usuarioLogado || atualizacaoEmAndamento) return;
  atualizacaoEmAndamento = true;

  try {
    const dados = await requisitarJson(`${URL_BASE}/mensagens/conversas`);
    if (!Array.isArray(dados)) {
      throw new Error('A resposta da API não contém uma lista de conversas válida.');
    }

    const conversasAnteriores = new Map(conversas.map(conversa => [conversa.id_usuario, conversa]));
    conversas = dados.map(dadosConversa => {
      const participante = dadosConversa.outro_participante || {};
      const idUsuario = String(participante.id ?? dadosConversa.id_usuario ?? '');
      if (!idUsuario) {
        console.warn('Conversa ignorada porque não possui o ID do outro participante.', dadosConversa);
        return null;
      }

      const anterior = conversasAnteriores.get(idUsuario);
      return {
        id_usuario: idUsuario,
        participante,
        ultima_mensagem: dadosConversa.ultima_mensagem || null,
        mensagens_nao_lidas: Number(dadosConversa.mensagens_nao_lidas) || 0,
        mensagens: anterior?.mensagens || [],
        paginaAtual: anterior?.paginaAtual || 0,
        totalPaginas: anterior?.totalPaginas || 0
      };
    }).filter(Boolean);

    if (conversaSelecionada) {
      conversaSelecionada = conversas.find(
        conversa => conversa.id_usuario === conversaSelecionada.id_usuario
      ) || null;
    }

    exibirConversas();

    if (conversaSelecionada) {
      await carregarPaginaRecente(conversaSelecionada, silencioso);
    } else if (!silencioso) {
      mostrarChatVazio();
    }
  } catch (erro) {
    console.error('Erro ao carregar conversas:', erro);
    if (!silencioso) {
      conversasList.innerHTML = '<div class="conversa-item-carregando"><p>Não foi possível carregar as conversas.</p></div>';
      chatStatus.textContent = 'Erro ao carregar conversas. Tente novamente.';
    }
  } finally {
    atualizacaoEmAndamento = false;
  }
}

function exibirConversas() {
  const busca = filtroConversa.value.trim().toLocaleLowerCase('pt-BR');
  const conversasFiltradas = conversas.filter(conversa => {
    const nome = obterNomeParticipante(conversa).toLocaleLowerCase('pt-BR');
    const preview = conversa.ultima_mensagem?.conteudo || '';
    return nome.includes(busca) || preview.toLocaleLowerCase('pt-BR').includes(busca);
  });

  if (!conversasFiltradas.length) {
    conversasList.innerHTML = `<div class="conversa-item-carregando"><p>${conversas.length ? 'Nenhuma conversa encontrada.' : 'Nenhuma mensagem ainda.'}</p></div>`;
    return;
  }

  conversasList.innerHTML = conversasFiltradas.map(conversa => {
    const nome = obterNomeParticipante(conversa);
    const ultimaMensagem = conversa.ultima_mensagem || {};
    const enviada = ultimaMensagem.id_remetente === usuarioLogado.uid;
    const preview = `${enviada ? 'Você: ' : ''}${ultimaMensagem.conteudo || ''}`;
    const data = obterDataMensagem(ultimaMensagem);
    const naoLidas = conversa.mensagens_nao_lidas;

    return `
      <button type="button" class="conversa-item ${conversa.id_usuario === conversaSelecionada?.id_usuario ? 'ativa' : ''}"
        data-usuario-id="${escaparHTML(conversa.id_usuario)}">
        <span class="conversa-avatar">${obterAvatarHtml(nome, conversa.participante.foto)}</span>
        <span class="conversa-info">
          <span class="conversa-nome">${escaparHTML(nome)}</span>
          <span class="conversa-preview ${naoLidas ? 'nao-lida' : ''}">${escaparHTML(preview)}</span>
        </span>
        <span class="conversa-meta">
          <span class="conversa-hora">${escaparHTML(formatarHora(data))}</span>
          ${naoLidas ? `<span class="conversa-nao-lidas">${naoLidas}</span>` : ''}
        </span>
      </button>`;
  }).join('');

  conversasList.querySelectorAll('.conversa-item').forEach(item => {
    item.addEventListener('click', () => selecionarConversa(item.dataset.usuarioId));
  });
}

async function selecionarConversa(idUsuario) {
  conversaSelecionada = conversas.find(conversa => conversa.id_usuario === idUsuario) || null;
  if (!conversaSelecionada) return;

  chatVazio.classList.add('hidden');
  chatAtivo.classList.remove('hidden');
  chatNome.textContent = obterNomeParticipante(conversaSelecionada);
  chatStatus.textContent = 'Carregando mensagens...';
  exibirConversas();
  mensagensArea.innerHTML = '<div class="mensagem-carregando"><p>Carregando mensagens...</p></div>';

  await carregarPaginaRecente(conversaSelecionada);
}

async function carregarPagina(conversa, pagina, { anexar = false, silencioso = false } = {}) {
  const params = new URLSearchParams({ page: String(pagina), limit: '20' });
  const url = `${URL_BASE}/mensagens/${encodeURIComponent(conversa.id_usuario)}?${params}`;
  const dados = await requisitarJson(url);
  const novasMensagens = obterMensagensDaResposta(dados);
  const paginacao = dados.paginacao || {};

  if (anexar) {
    const idsExistentes = new Set(conversa.mensagens.map(obterIdMensagem));
    conversa.mensagens = [
      ...novasMensagens.filter(mensagem => !idsExistentes.has(obterIdMensagem(mensagem))),
      ...conversa.mensagens
    ];
  } else if (silencioso) {
    const idsExistentes = new Set(conversa.mensagens.map(obterIdMensagem));
    conversa.mensagens = [
      ...conversa.mensagens,
      ...novasMensagens.filter(mensagem => !idsExistentes.has(obterIdMensagem(mensagem)))
    ];
    conversa.mensagens.sort((a, b) => (obterDataMensagem(a)?.getTime() || 0) - (obterDataMensagem(b)?.getTime() || 0));
  } else {
    conversa.mensagens = novasMensagens;
  }

  conversa.paginaAtual = Number(paginacao.pagina) || pagina;
  conversa.totalPaginas = Number(paginacao.total_paginas) || 1;

  if (conversa === conversaSelecionada) {
    renderizarMensagens({ manterPosicao: anexar });
    await marcarMensagensComoLidas(conversa);
  }
}

async function carregarPaginaRecente(conversa, silencioso = false) {
  try {
    const params = new URLSearchParams({ page: '1', limit: '20' });
    const url = `${URL_BASE}/mensagens/${encodeURIComponent(conversa.id_usuario)}?${params}`;
    const primeiraPagina = await requisitarJson(url);
    const totalPaginas = Number(primeiraPagina.paginacao?.total_paginas) || 1;
    const ultimaPagina = totalPaginas > 1
      ? await requisitarJson(`${URL_BASE}/mensagens/${encodeURIComponent(conversa.id_usuario)}?${new URLSearchParams({ page: String(totalPaginas), limit: '20' })}`)
      : primeiraPagina;

    const mensagensRecentes = obterMensagensDaResposta(ultimaPagina);
    const mensagensExistentes = silencioso ? conversa.mensagens : [];
    const idsExistentes = new Set(mensagensExistentes.map(obterIdMensagem));
    conversa.mensagens = [
      ...mensagensExistentes,
      ...mensagensRecentes.filter(mensagem => !idsExistentes.has(obterIdMensagem(mensagem)))
    ].sort((a, b) => (obterDataMensagem(a)?.getTime() || 0) - (obterDataMensagem(b)?.getTime() || 0));
    conversa.paginaAtual = Number(ultimaPagina.paginacao?.pagina) || totalPaginas;
    conversa.totalPaginas = Number(ultimaPagina.paginacao?.total_paginas) || totalPaginas;

    if (conversa === conversaSelecionada) {
      chatStatus.textContent = '';
      renderizarMensagens();
      await marcarMensagensComoLidas(conversa);
    }
  } catch (erro) {
    console.error('Erro ao carregar histórico da conversa:', erro);
    if (!silencioso && conversa === conversaSelecionada) {
      mensagensArea.innerHTML = '<div class="mensagem-carregando"><p>Não foi possível carregar as mensagens. Tente selecionar a conversa novamente.</p></div>';
      chatStatus.textContent = 'Erro ao carregar o histórico.';
    }
  }
}

function renderizarMensagens({ manterPosicao = false } = {}) {
  if (!conversaSelecionada) return;

  const alturaAnterior = mensagensArea.scrollHeight;
  const posicaoAnterior = mensagensArea.scrollTop;
  const botaoAnteriores = conversaSelecionada.paginaAtual > 1
    ? '<button type="button" class="btn-mensagens-anteriores" id="btnMensagensAnteriores">Carregar mensagens anteriores</button>'
    : '';

  const mensagensHtml = conversaSelecionada.mensagens.map(mensagem => {
    const enviada = mensagem.id_remetente === usuarioLogado.uid;
    const hora = formatarHora(obterDataMensagem(mensagem));
    return `
      <div class="mensagem ${enviada ? 'enviada' : 'recebida'}">
        <div class="mensagem-conteudo">${escaparHTML(mensagem.conteudo)}</div>
        <div class="mensagem-hora">${escaparHTML(hora)}</div>
      </div>`;
  }).join('');

  mensagensArea.innerHTML = `${botaoAnteriores}${mensagensHtml || '<div class="mensagem-carregando"><p>Nenhuma mensagem nesta conversa.</p></div>'}`;

  const botao = document.getElementById('btnMensagensAnteriores');
  if (botao) {
    botao.addEventListener('click', carregarMensagensAnteriores);
  }

  if (manterPosicao) {
    mensagensArea.scrollTop = posicaoAnterior + mensagensArea.scrollHeight - alturaAnterior;
  } else {
    mensagensArea.scrollTop = mensagensArea.scrollHeight;
  }
}

async function carregarMensagensAnteriores() {
  if (!conversaSelecionada || conversaSelecionada.paginaAtual <= 1) return;

  const conversa = conversaSelecionada;
  const paginaAnterior = conversa.paginaAtual - 1;
  const botao = document.getElementById('btnMensagensAnteriores');
  if (botao) {
    botao.disabled = true;
    botao.textContent = 'Carregando...';
  }

  try {
    await carregarPagina(conversa, paginaAnterior, { anexar: true });
  } catch (erro) {
    console.error('Erro ao carregar mensagens anteriores:', erro);
    chatStatus.textContent = 'Não foi possível carregar mensagens anteriores.';
    renderizarMensagens({ manterPosicao: true });
  }
}

async function marcarMensagensComoLidas(conversa) {
  const naoLidas = conversa.mensagens.filter(mensagem =>
    mensagem.id_destinatario === usuarioLogado.uid &&
    mensagem.lida !== true &&
    !mensagensLidas.has(obterIdMensagem(mensagem)) &&
    obterIdMensagem(mensagem)
  );
  if (!naoLidas.length) return;

  const resultados = await Promise.allSettled(naoLidas.map(mensagem =>
    requisitarJson(`${URL_BASE}/mensagens/${encodeURIComponent(obterIdMensagem(mensagem))}/lida`, {
      method: 'PUT'
    })
  ));
  const falhas = resultados.filter(resultado => resultado.status === 'rejected');

  if (falhas.length) {
    falhas.forEach(resultado => console.error('Erro ao marcar mensagem como lida:', resultado.reason));
    chatStatus.textContent = 'Algumas mensagens não puderam ser marcadas como lidas.';
  } else {
    naoLidas.forEach(mensagem => {
      mensagem.lida = true;
      mensagensLidas.add(obterIdMensagem(mensagem));
    });
    conversa.mensagens_nao_lidas = Math.max(0, conversa.mensagens_nao_lidas - naoLidas.length);
    exibirConversas();
    chatStatus.textContent = '';
  }
}

async function enviarMensagem(evento) {
  evento.preventDefault();
  const conversa = conversaSelecionada;
  const conteudo = inputMensagem.value.trim();
  if (!conversa || !conteudo) return;

  const botaoEnviar = formEnviarMensagem.querySelector('[type="submit"]');
  botaoEnviar.disabled = true;

  try {
    const enviada = await requisitarJson(`${URL_BASE}/mensagens`, {
      method: 'POST',
      body: JSON.stringify({
        id_destinatario: conversa.id_usuario,
        conteudo
      })
    });
    inputMensagem.value = '';

    if (enviada && typeof enviada === 'object') {
      const mensagem = enviada.mensagem || enviada;
      if (mensagem.conteudo && !conversa.mensagens.some(item =>
        obterIdMensagem(item) && obterIdMensagem(item) === obterIdMensagem(mensagem)
      )) {
        conversa.mensagens.push(mensagem);
      }
    }

    await carregarConversas({ silencioso: true });
  } catch (erro) {
    console.error('Erro ao enviar mensagem:', erro);
    chatStatus.textContent = erro.message || 'Não foi possível enviar a mensagem.';
  } finally {
    botaoEnviar.disabled = false;
    inputMensagem.focus();
  }
}

function mostrarChatVazio() {
  conversaSelecionada = null;
  chatVazio.classList.remove('hidden');
  chatAtivo.classList.add('hidden');
}

function fecharChat() {
  mostrarChatVazio();
  exibirConversas();
}

formEnviarMensagem.addEventListener('submit', enviarMensagem);
filtroConversa.addEventListener('input', exibirConversas);
btnFecharChat.addEventListener('click', fecharChat);

window.addEventListener('DOMContentLoaded', () => {
  if (verificarLogin()) {
    carregarConversas();
    window.setInterval(() => carregarConversas({ silencioso: true }), 5000);
  }
});
