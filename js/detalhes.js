import { normalizarUrlImagem, resolverUrlImagem } from './image-utils.js';
import {
  buscarLivroNoCatalogo,
  buscarRecomendacoesPorGenero,
  carregarDetalheComFallback
} from './detalhes-catalogo.mjs';

const URL_BASE_LOCAL = 'http://localhost:3000/api';
const URL_BASE_REMOTE = 'https://babel-be-lovat.vercel.app/api';

let URL_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? URL_BASE_LOCAL
  : URL_BASE_REMOTE;

async function fetchComTimeout(urlRequisicao, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(urlRequisicao, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchComFallback(url, options = {}) {
  try {
    return await fetchComTimeout(url, options);
  } catch (erro) {
    if (url.startsWith(URL_BASE_LOCAL)) {
      console.warn(`Falha ao conectar em ${URL_BASE_LOCAL}, tentando ${URL_BASE_REMOTE}...`);
      URL_BASE = URL_BASE_REMOTE;
      return fetchComTimeout(url.replace(URL_BASE_LOCAL, URL_BASE_REMOTE), options);
    }
    throw erro;
  }
}

// Pega o ID do livro da URL
const params = new URLSearchParams(window.location.search);
const livroId = params.get('id');

const token = localStorage.getItem('token');

// Elementos
const carregandoDetalhes = document.getElementById('carregandoDetalhes');
const conteudoDetalhes = document.getElementById('conteudoDetalhes');
const erroDetalhes = document.getElementById('erroDetalhes');
const carregandoRecomendacoes = document.getElementById('carregandoRecomendacoes');
const gridRecomendacoes = document.getElementById('gridRecomendacoes');
const semRecomendacoes = document.getElementById('semRecomendacoes');
const contactButton = document.getElementById('contactButton');
const contactModal = document.getElementById('contactModal');
const contactModalTitle = document.getElementById('contactModalTitle');
const contactTextarea = document.getElementById('contactMessage');
const sendContactBtn = document.getElementById('sendContactBtn');
const cancelContactBtn = document.getElementById('cancelContactBtn');
const contactFeedback = document.getElementById('contactFeedback');
const freteSection = document.getElementById('freteSection');
const freteForm = document.getElementById('freteForm');
const cepDestinoInput = document.getElementById('cepDestino');
const calcularFreteBtn = document.getElementById('calcularFreteBtn');
const freteFeedback = document.getElementById('freteFeedback');
const freteResultados = document.getElementById('freteResultados');
const conectarMelhorEnvio = document.getElementById('conectarMelhorEnvio');
const conectarMelhorEnvioBtn = document.getElementById('conectarMelhorEnvioBtn');
const melhorEnvioStatus = document.getElementById('melhorEnvioStatus');
const melhorEnvioIndisponivel = document.getElementById('melhorEnvioIndisponivel');
let galeriaImagens = [];
let galeriaIndex = 0;
let contatoDestinatarioId = null;
let contatoDestinatarioNome = null;
let contatoLivroId = null;
let solicitacaoFreteEmAndamento = false;

function extrairUrlImagem(valor) {
  if (!valor) return '';
  if (typeof valor === 'string') return valor;
  if (Array.isArray(valor)) return valor.map(extrairUrlImagem).find(Boolean) || '';
  if (typeof valor === 'object') {
    const candidates = [
      valor.url,
      valor.secure_url,
      valor.src,
      valor.path,
      valor.location,
      valor.filename,
      valor.image,
      valor.imagem,
      valor.photo,
      valor.picture
    ];
    for (const candidate of candidates) {
      if (candidate) return candidate;
    }
    for (const key of Object.keys(valor)) {
      const nested = extrairUrlImagem(valor[key]);
      if (nested) return nested;
    }
  }
  return '';
}

function obterImagemLivro(livro) {
  const imagem = extrairUrlImagem(livro.fotos ?? livro.imagem ?? livro.foto ?? null);
  return resolverUrlImagem(imagem);
}

function mostrarCarregando() {
  carregandoDetalhes.style.display = 'block';
  carregandoDetalhes.textContent = 'AGUARDE UM ESTANTE...';
  conteudoDetalhes.style.display = 'none';
  erroDetalhes.style.display = 'none';
}

async function listarPaginaPublica(page, limit) {
  const url = new URL(`${URL_BASE}/livros`);
  url.searchParams.set('page', page);
  url.searchParams.set('limit', limit);
  const resposta = await fetchComFallback(url.toString());
  if (!resposta.ok) {
    const textoErro = await resposta.text();
    throw new Error(`Não foi possível consultar o catálogo público (HTTP ${resposta.status}): ${textoErro}`);
  }
  return resposta.json();
}

async function carregarDetalhesLivro() {
  mostrarCarregando();

  if (!livroId) {
    console.error('ID do livro não encontrado na URL');
    mostrarErro();
    return;
  }

  console.log('Carregando detalhes do livro com ID:', livroId);

  try {
    const livro = await carregarDetalheComFallback({
      token,
      carregarAutenticado: async () => {
        const resposta = await fetchComFallback(`${URL_BASE}/livros/${encodeURIComponent(livroId)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!resposta.ok) {
          const textoErro = await resposta.text();
          throw new Error(`Status ${resposta.status}: ${textoErro}`);
        }
        return resposta.json();
      },
      carregarPublico: () => buscarLivroNoCatalogo(livroId, listarPaginaPublica),
      carregarBackup: carregarDetalhesBackup
    });

    console.log('Livro carregado:', livro);
    renderizarDetalhes(livro);
    carregarRecomendacoes(livro.generos?.[0] || livro.genero);
  } catch (erro) {
    console.error('Erro ao carregar detalhes:', erro);
    mostrarErro();
  }
}

function carregarDetalhesBackup() {
  const saved = sessionStorage.getItem('livroSelecionado');
  if (!saved) return null;

  try {
    const livro = JSON.parse(saved);
    const livroIdSalvo = livro._id || livro.id;
    if (!livroIdSalvo || livroIdSalvo !== livroId) return null;
    console.log('Carregando detalhes do livro a partir do backup de sessão:', livro);
    return livro;
  } catch (erro) {
    console.warn('Não foi possível carregar o backup do livro:', erro);
    return null;
  }
}

function renderizarDetalhes(livro) {
  // Normaliza o ID (pode ser id ou _id)
  const livroId = livro.id || livro._id || params.get('id');
  
  // Imagem (normaliza string ou objeto)
  const imagemDiv = document.getElementById('imagemLivro');
  const imgUrl = obterImagemLivro(livro);
  imagemDiv.innerHTML = '';
  imagemDiv.style.backgroundImage = '';
  imagemDiv.style.display = 'block';

  if (imgUrl) {
    imagemDiv.innerHTML = `<img class="imagem-grande-img" src="${imgUrl}" alt="Capa do livro">`;
  } else {
    imagemDiv.innerHTML = '📚';
    imagemDiv.style.fontSize = '64px';
    imagemDiv.style.display = 'flex';
    imagemDiv.style.alignItems = 'center';
    imagemDiv.style.justifyContent = 'center';
  }

  // Prepara galeria de imagens (se houver)
  try {
    galeriaImagens = [];
    if (Array.isArray(livro.fotos) && livro.fotos.length) {
      galeriaImagens = livro.fotos.map(f => normalizarUrlImagem(extrairUrlImagem(f))).filter(Boolean);
    }
    const imgFromMain = normalizarUrlImagem(extrairUrlImagem(livro.imagem ?? livro.foto ?? null));
    if (imgFromMain && !galeriaImagens.includes(imgFromMain)) galeriaImagens.unshift(imgFromMain);
  } catch (e) {
    galeriaImagens = [imgUrl].filter(Boolean);
  }

  const verBtn = document.getElementById('verMaisImagensBtn');
  renderizarThumbnails(galeriaImagens);
  if (verBtn) {
    if (galeriaImagens.length > 1) {
      verBtn.style.display = 'inline-flex';
      verBtn.onclick = () => openGallery(0);
    } else {
      verBtn.style.display = 'none';
    }
  }

  // Informações básicas
  document.getElementById('titulo').textContent = livro.titulo || 'Sem título';
  document.getElementById('autor').textContent = livro.autor || 'Autor desconhecido';
  document.getElementById('editora').textContent = livro.editora || 'N/A';
  document.getElementById('anoPublicacao').textContent = livro.anoPublicacao || 'N/A';
  document.getElementById('idioma').textContent = livro.idioma || 'Português';
  document.getElementById('condicao').textContent = livro.condicao || 'Bom';
  document.getElementById('descricao').textContent = livro.descricao || 'Sem descrição disponível.';

  // Gêneros
  const generosDiv = document.getElementById('generos');
  if (livro.generos && Array.isArray(livro.generos) && livro.generos.length > 0) {
    generosDiv.innerHTML = livro.generos
      .map(g => `<span class="genero-tag">${g}</span>`)
      .join('');
  } else {
    generosDiv.textContent = 'Não informado';
  }

  // Tipo de anúncio
  const tipoSpan = document.getElementById('tipo');
  const tipoTexto = livro.tipo === 'doacao' ? 'Doação' : livro.tipo === 'venda' ? 'Venda' : 'Troca';
  tipoSpan.textContent = tipoTexto;
  tipoSpan.className = `tipo-badge tipo-${livro.tipo || 'troca'}`;

  // Preço (se for venda)
  if (livro.tipo === 'venda' && livro.preco) {
    document.getElementById('precoInfo').style.display = 'block';
    document.getElementById('preco').textContent = `R$ ${livro.preco.toFixed(2).replace('.', ',')}`;
    if (freteSection) freteSection.hidden = false;
  } else {
    document.getElementById('precoInfo').style.display = 'none';
    if (freteSection) freteSection.hidden = true;
  }

  // Localização
  document.getElementById('localizacao').querySelector('span').textContent = livro.localizacao || 'Não informada';

  // Anunciante
  // Anunciante
  const nomeAnunciante = document.getElementById('nomeAnunciante');
  const emailAnunciante = document.getElementById('emailAnunciante');

  const usuarioObj = livro.usuario && typeof livro.usuario === 'object' ? livro.usuario : null;
  const nomeExibido = livro.usuarioNome
    || livro.seboNome
    || usuarioObj?.displayName
    || usuarioObj?.nome
    || 'Anunciante';

  nomeAnunciante.textContent = nomeExibido;
  emailAnunciante.textContent = usuarioObj?.email
    || (livro.seboId ? 'Sebo parceiro' : 'Contatar via plataforma');
  contatoDestinatarioNome = nomeExibido;
  contatoDestinatarioId = usuarioObj?.uid || usuarioObj?._id || usuarioObj?.id || livro.usuarioId || null;
  contatoLivroId = livro.id || livro._id || params.get('id');

  // Informações de troca
  if (livro.tipo === 'troca' && livro.trocas) {
    const trocasInfo = document.getElementById('trocasInfo');
    trocasInfo.style.display = 'block';

    const aceitaRetirada = document.getElementById('aceitaRetirada');
    aceitaRetirada.textContent = livro.trocas.aceitaRetirada 
      ? '✅ Aceita retirada' 
      : '❌ Não aceita retirada';

    const interessesDiv = document.getElementById('interesses-troca');
    if (livro.trocas.interesses && livro.trocas.interesses.length > 0) {
      interessesDiv.innerHTML = `
        <strong>Interesses para troca:</strong>
        <div>${livro.trocas.interesses.map(i => `<span class="interesse-tag">${i}</span>`).join('')}</div>
      `;
    }
  }

  // Mostrar conteúdo, esconder carregamento
  carregandoDetalhes.style.display = 'none';
  conteudoDetalhes.style.display = 'block';
}

async function atualizarConexaoMelhorEnvio() {
  if (!conectarMelhorEnvio || !conectarMelhorEnvioBtn) return;
  conectarMelhorEnvio.hidden = false;
  conectarMelhorEnvioBtn.disabled = !token;
  if (!token) {
    if (melhorEnvioStatus) {
      melhorEnvioStatus.textContent = 'Entre na sua conta da Estante para conectar o Melhor Envio.';
    }
    return;
  }

  try {
    const resposta = await fetchComFallback(`${URL_BASE}/melhor-envio/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(dados?.erro || `Não foi possível consultar a conexão (HTTP ${resposta.status}).`);
    }
    const conectado = Boolean(dados?.conectado);
    const podeAutorizar = Boolean(dados?.podeAutorizar);
    conectarMelhorEnvio.hidden = conectado && !podeAutorizar;
    conectarMelhorEnvioBtn.disabled = !podeAutorizar;
    conectarMelhorEnvioBtn.textContent = conectado
      ? 'Refazer autorização do Melhor Envio'
      : 'Conectar Melhor Envio';
    if (melhorEnvioStatus) {
      if (!dados?.responsavelConfigurado) {
        melhorEnvioStatus.textContent = 'Configure MELHOR_ENVIO_OWNER_UID no backend para habilitar a conexão.';
      } else if (conectado && podeAutorizar) {
        melhorEnvioStatus.textContent = 'A conta compartilhada está conectada. Você pode refazer a autorização se necessário.';
      } else if (!podeAutorizar) {
        melhorEnvioStatus.textContent = 'Esta conta da Estante não está autorizada a conectar o Melhor Envio.';
      } else {
        melhorEnvioStatus.textContent = 'Conecte a conta de frete da plataforma ao Melhor Envio para habilitar as cotações.';
      }
    }
    if (melhorEnvioIndisponivel) {
      melhorEnvioIndisponivel.hidden = conectado;
    }
  } catch (erro) {
    console.error('Erro ao consultar conexão do Melhor Envio:', erro);
    conectarMelhorEnvio.hidden = false;
    conectarMelhorEnvioBtn.disabled = false;
    if (melhorEnvioStatus) melhorEnvioStatus.textContent = erro.message;
  }
}

if (conectarMelhorEnvioBtn) {
  conectarMelhorEnvioBtn.addEventListener('click', async () => {
    conectarMelhorEnvioBtn.disabled = true;
    conectarMelhorEnvioBtn.textContent = 'Conectando...';
    try {
      const resposta = await fetchComFallback(`${URL_BASE}/melhor-envio/authorize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok || !dados?.url) {
        throw new Error(dados?.erro || `Não foi possível iniciar a autorização (HTTP ${resposta.status}).`);
      }
      window.location.assign(dados.url);
    } catch (erro) {
      console.error('Erro ao iniciar autorização do Melhor Envio:', erro);
      if (freteFeedback) freteFeedback.textContent = erro.message;
      conectarMelhorEnvioBtn.disabled = false;
      conectarMelhorEnvioBtn.textContent = 'Conectar Melhor Envio';
    }
  });
}

if (freteForm) {
  freteForm.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (solicitacaoFreteEmAndamento) return;
    const cepDestino = cepDestinoInput.value.replace(/\D/g, '');
    if (!/^\d{8}$/.test(cepDestino)) {
      freteFeedback.textContent = 'Informe um CEP de entrega válido com 8 números.';
      cepDestinoInput.focus();
      return;
    }

    solicitacaoFreteEmAndamento = true;
    calcularFreteBtn.disabled = true;
    calcularFreteBtn.textContent = 'Consultando...';
    freteFeedback.textContent = 'Consultando opções pelo Melhor Envio...';
    freteResultados.replaceChildren();

    try {
      const resposta = await fetchComFallback(`${URL_BASE}/melhor-envio/cotacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ livroId, cepDestino })
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        throw new Error(dados?.erro || dados?.message || `Não foi possível calcular o frete (HTTP ${resposta.status}).`);
      }

      const cotacoes = Array.isArray(dados?.cotacoes) ? dados.cotacoes : [];
      if (!cotacoes.length) {
        freteFeedback.textContent = 'O Melhor Envio não retornou opções para estes CEPs e dimensões.';
        return;
      }

      freteFeedback.textContent = `Estimativa para entrega no CEP ${cepDestino.slice(0, 5)}-${cepDestino.slice(5)}:`;
      cotacoes.forEach(cotacao => {
        const cartao = document.createElement('article');
        cartao.className = 'frete-opcao';
        const nome = document.createElement('strong');
        nome.textContent = cotacao.nomeServico || `Serviço ${cotacao.codigoServico || ''}`.trim();
        const preco = document.createElement('span');
        preco.textContent = Number.isFinite(Number(cotacao.valor))
          ? Number(cotacao.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : 'Valor indisponível';
        const prazo = document.createElement('span');
        prazo.textContent = Number.isFinite(Number(cotacao.prazoEntrega))
          ? `Prazo estimado: ${cotacao.prazoEntrega} dia(s) útil(eis)`
          : 'Prazo não informado';
        cartao.append(nome, preco, prazo);
        freteResultados.append(cartao);
      });
    } catch (erro) {
      console.error('Erro ao calcular frete:', erro);
      freteFeedback.textContent = erro.message;
    } finally {
      solicitacaoFreteEmAndamento = false;
      calcularFreteBtn.disabled = false;
      calcularFreteBtn.textContent = 'Consultar frete';
    }
  });
}

function openGallery(startIndex = 0) {
  galeriaIndex = startIndex || 0;
  const modal = document.getElementById('galleryModal');
  const imgEl = document.getElementById('galleryImage');
  if (!modal || !imgEl) return;
  showGalleryImage(galeriaIndex);
  modal.style.display = 'flex';
  document.getElementById('galleryClose').onclick = closeGallery;
  document.getElementById('galleryPrev').onclick = () => showGalleryImage(galeriaIndex - 1);
  document.getElementById('galleryNext').onclick = () => showGalleryImage(galeriaIndex + 1);
}

function closeGallery() {
  const modal = document.getElementById('galleryModal');
  if (modal) modal.style.display = 'none';
}

function showGalleryImage(idx) {
  if (!galeriaImagens || galeriaImagens.length === 0) return;
  if (idx < 0) idx = galeriaImagens.length - 1;
  if (idx >= galeriaImagens.length) idx = 0;
  galeriaIndex = idx;
  const imgEl = document.getElementById('galleryImage');
  if (imgEl) imgEl.src = resolverUrlImagem(galeriaImagens[galeriaIndex]);
  updateThumbnailSelection();
}

function renderizarThumbnails(imagens) {
  const container = document.getElementById('thumbnailsContainer');
  if (!container) return;
  if (!imagens || imagens.length <= 1) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = imagens
    .map((url, index) => `
      <button type="button" class="thumbnail-item${index === 0 ? ' active' : ''}" data-index="${index}">
        <img src="${resolverUrlImagem(url)}" alt="Imagem ${index + 1}">
      </button>
    `)
    .join('');

  container.querySelectorAll('.thumbnail-item').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      showGalleryImage(index);
      openGallery(index);
    });
  });
}

function updateThumbnailSelection() {
  const thumbnails = document.querySelectorAll('.thumbnail-item');
  thumbnails.forEach(button => {
    button.classList.toggle('active', Number(button.dataset.index) === galeriaIndex);
  });
}

function abrirModalContato() {
  if (contactModalTitle) {
    contactModalTitle.textContent = `Enviar mensagem para ${contatoDestinatarioNome || 'anunciante'}`;
  }

  if (contactTextarea) {
    contactTextarea.value = '';
    contactTextarea.focus();
  }

  if (contactModal) {
    contactModal.classList.remove('hidden');
    contactModal.style.display = 'flex';
  }

  if (!contatoDestinatarioId && contactFeedback) {
    contactFeedback.textContent = 'Destinatário não encontrado. A mensagem não poderá ser enviada.';
  } else if (contactFeedback) {
    contactFeedback.textContent = '';
  }
}

function fecharModalContato() {
  if (contactModal) {
    contactModal.classList.add('hidden');
    contactModal.style.display = 'none';
  }
}

async function enviarMensagemContato() {
  if (!contactTextarea) return;

  const mensagem = contactTextarea.value.trim();
  if (!mensagem) {
    if (contactFeedback) {
      contactFeedback.textContent = 'Por favor, escreva uma mensagem antes de enviar.';
    }
    return;
  }

  if (!contatoDestinatarioId) {
    if (contactFeedback) {
      contactFeedback.textContent = 'Não foi possível identificar o destinatário.';
    }
    return;
  }

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    if (contactFeedback) {
      contactFeedback.textContent = 'Enviando mensagem...';
    }

    const response = await fetchComFallback(`${URL_BASE}/mensagens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id_destinatario: contatoDestinatarioId,
        conteudo: mensagem
      })
    });

    if (!response.ok) {
      const texto = await response.text();
      throw new Error(`Status ${response.status}: ${texto}`);
    }

    if (contactFeedback) {
      contactFeedback.textContent = 'Mensagem enviada com sucesso!';
    }

    setTimeout(() => {
      fecharModalContato();
    }, 800);
  } catch (erro) {
    console.error('Erro ao enviar mensagem de contato:', erro);
    if (contactFeedback) {
      contactFeedback.textContent = 'Não foi possível enviar a mensagem. Tente novamente mais tarde.';
    }
  }
}

async function carregarRecomendacoes(genero) {
  if (!genero) {
    semRecomendacoes.style.display = 'block';
    carregandoRecomendacoes.style.display = 'none';
    return;
  }

  try {
    document.getElementById('generoRecomendado').textContent = `Livros do gênero: ${genero}`;
    const recomendacoes = await buscarRecomendacoesPorGenero(
      genero,
      livroId,
      listarPaginaPublica
    );

    console.log(`Encontradas ${recomendacoes.length} recomendações`);
    if (recomendacoes.length === 0) {
      semRecomendacoes.style.display = 'block';
    } else {
      gridRecomendacoes.innerHTML = recomendacoes.map(criarCardRecomendacao).join('');
      gridRecomendacoes.style.display = 'grid';
    }
  } catch (erro) {
    console.warn('Erro ao carregar recomendações:', erro);
    semRecomendacoes.querySelector('p').textContent =
      'Não foi possível carregar as recomendações. Tente novamente mais tarde.';
    semRecomendacoes.style.display = 'block';
  } finally {
    carregandoRecomendacoes.style.display = 'none';
  }
}

function criarCardRecomendacao(livro) {
  const tipo = livro.tipo || 'troca';
  const imagem = obterImagemLivro(livro);
  const preco = livro.preco ? `R$ ${livro.preco.toFixed(2).replace('.', ',')}` : '';
  const livroIdRecomendacao = livro.id || livro._id;

  return `
    <article class="book-card" data-tipo="${tipo}">
      <div class="imagem">
        <img src="${imagem}" alt="Capa de ${livro.titulo || 'livro'}">
        <span class="tag ${tipo}">${tipo === 'doacao' ? 'Doação' : tipo === 'venda' ? 'Venda' : 'Troca'}</span>
      </div>
      <div class="book-info">
        <h3>${livro.titulo}</h3>
        <p class="autor">${livro.autor}</p>
        <p class="condicao">Estado: ${livro.condicao || 'Bom'}${preco ? ` • ${preco}` : ''}</p>
        <p class="localizacao">📍 ${livro.localizacao || 'Local não informado'}</p>
        <a href="./detalhes.html?id=${livroIdRecomendacao}" class="btn-detalhes">Detalhes</a>
      </div>
    </article>
  `;
}

function mostrarErro() {
  carregandoDetalhes.style.display = 'none';
  conteudoDetalhes.style.display = 'none';
  erroDetalhes.style.display = 'block';
}

// Carrega ao abrir a página
function bindContactEvents() {
  if (contactButton) {
    contactButton.addEventListener('click', abrirModalContato);
  }

  document.body.addEventListener('click', event => {
    const button = event.target.closest('#contactButton');
    if (button) {
      abrirModalContato();
    }
  });

  if (sendContactBtn) {
    sendContactBtn.addEventListener('click', enviarMensagemContato);
  }

  if (cancelContactBtn) {
    cancelContactBtn.addEventListener('click', fecharModalContato);
  }

  if (contactModal) {
    contactModal.addEventListener('click', event => {
      if (event.target === contactModal) {
        fecharModalContato();
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  carregarDetalhesLivro();
  bindContactEvents();
  atualizarConexaoMelhorEnvio();
});
