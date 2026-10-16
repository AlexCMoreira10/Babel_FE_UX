import { requisitarApiLivros } from './books-api.js';

const parametros = new URLSearchParams(window.location.search);
const caminhoToken = window.location.pathname.match(/\/livros\/rastreio\/([^/]+)\/?$/)?.[1];
const tokenRastreio = caminhoToken ? decodeURIComponent(caminhoToken) : parametros.get('token');
const statusEl = document.getElementById('rastreioStatus');
const livroEl = document.getElementById('rastreioLivro');
const aquisicaoBtn = document.getElementById('adquirirLivroBtn');
const aquisicaoFeedback = document.getElementById('aquisicaoFeedback');
const aquisicaoModal = document.getElementById('aquisicaoModal');
const formAquisicao = document.getElementById('formAquisicao');
const aquisicaoModalFeedback = document.getElementById('aquisicaoModalFeedback');
const tipoNegociacaoSelect = document.getElementById('tipoNegociacao');
const formAvaliacao = document.getElementById('formAvaliacao');
const avaliacaoFeedback = document.getElementById('avaliacaoFeedback');
let rastreio = null;

function escaparHtml(valor) {
  const elemento = document.createElement('span');
  elemento.textContent = String(valor ?? '');
  return elemento.innerHTML;
}

function formatarData(valor) {
  if (!valor) return 'Data não informada';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? String(valor) : data.toLocaleDateString('pt-BR');
}

function listar(dados, container, renderizar) {
  const itens = Array.isArray(dados) ? dados : [];
  container.innerHTML = itens.length
    ? itens.map(renderizar).join('')
    : '<p class="rastreio-vazio">Ainda não há registros.</p>';
}

function carregarLivro(livro) {
  document.getElementById('rastreioTitulo').textContent = livro.titulo || 'Histórico do livro';
  const imagem = Array.isArray(livro.fotos) ? livro.fotos[0] : livro.imagem || livro.foto || '';
  livroEl.innerHTML = `
    ${imagem ? `<img src="${escaparHtml(imagem)}" alt="Capa de ${escaparHtml(livro.titulo)}">` : ''}
    <div>
      <h2>${escaparHtml(livro.titulo || 'Livro sem título')}</h2>
      <p>${escaparHtml(livro.autor || 'Autor desconhecido')}</p>
      <p>${escaparHtml(livro.descricao || '')}</p>
      <p><strong>Condição:</strong> ${escaparHtml(livro.condicao || 'Não informada')}</p>
      <p><strong>Proprietário atual:</strong> ${escaparHtml(livro.proprietarioAtual?.nome || livro.proprietario?.nome || livro.usuario?.nome || 'Informação não disponível')}</p>
    </div>`;
}

function prepararPedidoAquisicao(livro) {
  const tipoNegociacao = ['doacao', 'troca', 'venda'].includes(livro.tipo)
    ? livro.tipo
    : 'troca';
  tipoNegociacaoSelect.value = tipoNegociacao;
  atualizarTituloAquisicao();

  let usuarioId = null;
  try {
    usuarioId = JSON.parse(localStorage.getItem('usuario') || 'null')?.uid || null;
  } catch (erro) {
    console.warn('Não foi possível ler o usuário atual para verificar a propriedade.', erro);
  }

  aquisicaoBtn.classList.remove('hidden');
  if (usuarioId && usuarioId === livro.usuarioId) {
    statusEl.textContent = 'Este livro já pertence à sua conta.';
    aquisicaoBtn.classList.add('hidden');
    return;
  }

  aquisicaoModal.classList.remove('hidden');
}

function atualizarTituloAquisicao() {
  const nomesNegociacao = {
    doacao: 'doação',
    troca: 'troca',
    venda: 'compra'
  };
  const tipo = tipoNegociacaoSelect.value;
  document.getElementById('aquisicaoTitulo').textContent =
    `Deseja solicitar ${nomesNegociacao[tipo] || 'negociação'} deste livro?`;
}

function renderizarHistorico() {
  const posse = rastreio.historicoPosse || [];
  const negociacoes = rastreio.historicoNegociacoes || [];
  const avaliacoes = rastreio.avaliacoes || [];
  listar(posse, document.getElementById('historicoPosse'), item => `
    <article class="rastreio-item">
      <strong>${escaparHtml(item.nome || item.usuario?.nome || 'Leitor')}</strong>
      <span>${escaparHtml(formatarData(item.dataInicio || item.data_inicio || item.data))}</span>
      ${item.dataFim || item.data_fim ? `<span>Até ${escaparHtml(formatarData(item.dataFim || item.data_fim))}</span>` : `<span>${item.atual ? 'Proprietário atual' : 'Posse registrada'}</span>`}
    </article>`);
  listar(negociacoes, document.getElementById('historicoNegociacoes'), item => `
    <article class="rastreio-item">
      <strong>${escaparHtml(item.tipoNegociacao || item.tipo || 'Negociação')}</strong>
      <span>${escaparHtml(formatarData(item.dataConclusao || item.data_conclusao || item.data))}</span>
      ${item.de?.nome || item.para?.nome ? `<span>${escaparHtml(item.de?.nome || '')} → ${escaparHtml(item.para?.nome || '')}</span>` : ''}
    </article>`);
  listar(avaliacoes, document.getElementById('avaliacoes'), item => `
    <article class="rastreio-item">
      <strong>${escaparHtml(item.nome || item.usuario?.nome || 'Leitor')}</strong>
      <span>${escaparHtml(formatarData(item.data || item.criadoEm))}</span>
      <p>${escaparHtml(item.comentario || '')}</p>
    </article>`);

  let usuarioId = null;
  try {
    usuarioId = JSON.parse(localStorage.getItem('usuario') || 'null')?.uid || null;
  } catch (erro) {
    console.warn('Não foi possível ler o usuário atual para validar a avaliação.', erro);
  }

  const idsProprietarios = posse.map(item =>
    String(item.uid || item.usuarioId || item.id_usuario || item.usuario?.uid || item.usuario?._id || '')
  );
  const jaAvaliou = avaliacoes.some(item =>
    String(item.uid || item.usuarioId || item.id_usuario || item.usuario?.uid || '') === usuarioId
  );
  formAvaliacao.classList.toggle('hidden', !usuarioId || !idsProprietarios.includes(String(usuarioId)) || jaAvaliou);
}

async function carregarRastreio() {
  if (!tokenRastreio) {
    statusEl.textContent = 'O QR Code não contém um identificador válido.';
    return;
  }

  try {
    rastreio = await requisitarApiLivros(
      `/livros/rastreio/${encodeURIComponent(tokenRastreio)}`,
      { autenticado: false }
    );
    if (!rastreio?.livro) throw new Error('A resposta não contém os dados do livro.');

    carregarLivro(rastreio.livro);
    renderizarHistorico();
    statusEl.textContent = 'Confirme se deseja solicitar a negociação deste livro.';
    prepararPedidoAquisicao(rastreio.livro);
  } catch (erro) {
    console.error('Erro ao carregar histórico do livro:', erro);
    statusEl.textContent = erro.status === 404 && erro.message.includes('Cannot GET')
      ? 'O serviço de histórico não está disponível na API. O backend precisa publicar a rota de rastreio.'
      : erro.status === 404
        ? 'Não encontramos um livro associado a este QR Code.'
        : 'Não foi possível carregar o histórico. Tente novamente mais tarde.';
  }
}

aquisicaoBtn.addEventListener('click', () => {
  aquisicaoModal.classList.remove('hidden');
});

document.getElementById('cancelarAquisicaoBtn').addEventListener('click', () => {
  aquisicaoModal.classList.add('hidden');
  aquisicaoModalFeedback.textContent = '';
});

tipoNegociacaoSelect.addEventListener('change', atualizarTituloAquisicao);

formAquisicao.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (!localStorage.getItem('token')) {
    const destino = encodeURIComponent(window.location.href);
    window.location.href = `./login.html?returnUrl=${destino}`;
    return;
  }

  const botao = document.getElementById('confirmarAquisicaoBtn');
  botao.disabled = true;
  aquisicaoModalFeedback.textContent = 'Enviando pedido...';

  try {
    await requisitarApiLivros(
      `/livros/rastreio/${encodeURIComponent(tokenRastreio)}/aquisicao`,
      {
        method: 'POST',
        body: { tipoNegociacao: document.getElementById('tipoNegociacao').value }
      }
    );
    aquisicaoModal.classList.add('hidden');
    aquisicaoBtn.classList.add('hidden');
    statusEl.textContent = 'Pedido enviado ao vendedor.';
    aquisicaoFeedback.textContent = 'O vendedor recebeu uma notificação e precisa confirmar a negociação. O livro só será transferido após essa confirmação.';
  } catch (erro) {
    console.error('Erro ao solicitar aquisição:', erro);
    aquisicaoModalFeedback.textContent = erro.status === 401
      ? ''
      : erro.message;
    if (erro.status === 401) {
      const returnUrl = encodeURIComponent(window.location.href);
      aquisicaoModalFeedback.innerHTML = `Sua sessão expirou. <a href="./login.html?returnUrl=${returnUrl}">Entre novamente</a> para solicitar a aquisição.`;
    }
  } finally {
    botao.disabled = false;
  }
});

formAvaliacao.addEventListener('submit', async evento => {
  evento.preventDefault();
  const comentario = document.getElementById('comentarioAvaliacao').value.trim();
  if (!comentario) return;

  const livroId = rastreio?.livro?.id || rastreio?.livro?._id;
  if (!livroId) {
    avaliacaoFeedback.textContent = 'O histórico não retornou o ID necessário para publicar a avaliação.';
    return;
  }

  const botao = formAvaliacao.querySelector('button[type="submit"]');
  botao.disabled = true;
  avaliacaoFeedback.textContent = 'Publicando avaliação...';

  try {
    await requisitarApiLivros(`/livros/${encodeURIComponent(livroId)}/avaliacoes`, {
      method: 'POST',
      body: { comentario }
    });
    document.getElementById('comentarioAvaliacao').value = '';
    avaliacaoFeedback.textContent = 'Avaliação publicada.';
    await carregarRastreio();
  } catch (erro) {
    console.error('Erro ao publicar avaliação:', erro);
    avaliacaoFeedback.textContent = erro.status === 401
      ? ''
      : erro.message;
    if (erro.status === 401) {
      const returnUrl = encodeURIComponent(window.location.href);
      avaliacaoFeedback.innerHTML = `Sua sessão expirou. <a href="./login.html?returnUrl=${returnUrl}">Entre novamente</a> para publicar a avaliação.`;
    }
  } finally {
    botao.disabled = false;
  }
});

carregarRastreio();
