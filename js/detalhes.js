const URL_BASE_LOCAL = 'http://localhost:3000/api';
const URL_BASE_REMOTE = 'https://babel-be-lovat.vercel.app/api';

let URL_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? URL_BASE_LOCAL
  : URL_BASE_REMOTE;

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
let galeriaImagens = [];
let galeriaIndex = 0;

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
  return imagem || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80';
}

async function carregarDetalhesLivro() {
  if (!livroId) {
    console.error('ID do livro não encontrado na URL');
    mostrarErro();
    return;
  }

  console.log('Carregando detalhes do livro com ID:', livroId);

  try {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${URL_BASE}/livros/${livroId}`;
    console.log('URL da requisição:', url);
    console.log('Headers:', headers);

    const resposta = await fetchComFallback(url, {
      headers: headers
    });

    console.log('Status da resposta:', resposta.status);
    console.log('Headers da resposta:', resposta.headers);

    if (!resposta.ok) {
      const textoErro = await resposta.text();
      console.error('Erro na resposta:', textoErro);
      throw new Error(`Status ${resposta.status}: ${textoErro}`);
    }

    const livro = await resposta.json();
    console.log('Livro carregado:', livro);

    renderizarDetalhes(livro);
    carregarRecomendacoes(livro.generos?.[0] || livro.genero);
  } catch (erro) {
    console.error('Erro ao carregar detalhes:', erro);
    if (carregarDetalhesBackup()) {
      return;
    }
    mostrarErro();
  }
}

function carregarDetalhesBackup() {
  const saved = sessionStorage.getItem('livroSelecionado');
  if (!saved) {
    return false;
  }

  try {
    const livro = JSON.parse(saved);
    const livroIdSalvo = livro._id || livro.id;
    if (!livroIdSalvo || livroIdSalvo !== livroId) {
      return false;
    }

    console.log('Carregando detalhes do livro a partir do backup de sessão:', livro);
    renderizarDetalhes(livro);
    carregarRecomendacoes(livro.generos?.[0] || livro.genero);
    return true;
  } catch (erro) {
    console.warn('Não foi possível carregar o backup do livro:', erro);
    return false;
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
    const safeUrl = imgUrl.replace(/"/g, '%22');
    imagemDiv.innerHTML = `<img class="imagem-grande-img" src="${safeUrl}" alt="Capa do livro">`;
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
      galeriaImagens = livro.fotos.map(f => extrairUrlImagem(f)).filter(Boolean);
    }
    const imgFromMain = extrairUrlImagem(livro.imagem ?? livro.foto ?? null);
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
  } else {
    document.getElementById('precoInfo').style.display = 'none';
  }

  // Localização
  document.getElementById('localizacao').querySelector('span').textContent = livro.localizacao || 'Não informada';

  // Anunciante
  const nomeAnunciante = document.getElementById('nomeAnunciante');
  const emailAnunciante = document.getElementById('emailAnunciante');
  
  if (livro.usuario) {
    if (typeof livro.usuario === 'object') {
      nomeAnunciante.textContent = livro.usuario.displayName || livro.usuario.nome || 'Anunciante';
      emailAnunciante.textContent = livro.usuario.email || 'email@example.com';
    } else {
      nomeAnunciante.textContent = livro.usuario;
      emailAnunciante.textContent = 'Contatar via plataforma';
    }
  } else {
    nomeAnunciante.textContent = livro.usuarioId || 'Anunciante';
    emailAnunciante.textContent = 'Contatar via plataforma';
  }

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
  if (imgEl) imgEl.src = galeriaImagens[galeriaIndex];
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
        <img src="${url}" alt="Imagem ${index + 1}">
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

async function carregarRecomendacoes(genero) {
  if (!genero) {
    semRecomendacoes.style.display = 'block';
    carregandoRecomendacoes.style.display = 'none';
    return;
  }

  try {
    document.getElementById('generoRecomendado').textContent = `Livros do gênero: ${genero}`;

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const resposta = await fetchComFallback(`${URL_BASE}/livros/busca/genero?genero=${encodeURIComponent(genero)}`, {
      headers: headers
    });

    if (!resposta.ok) {
      throw new Error(`Status ${resposta.status}`);
    }

    const dados = await resposta.json();
    let recomendacoes = [];

    if (Array.isArray(dados)) {
      recomendacoes = dados;
    } else if (Array.isArray(dados.livros)) {
      recomendacoes = dados.livros;
    } else if (Array.isArray(dados.dados)) {
      recomendacoes = dados.dados;
    } else if (Array.isArray(dados.data)) {
      recomendacoes = dados.data;
    }

    // Filtra o livro atual das recomendações
    recomendacoes = recomendacoes.filter(l => (l._id || l.id) !== livroId).slice(0, 6);

    console.log(`Encontradas ${recomendacoes.length} recomendações`);

    if (recomendacoes.length === 0) {
      semRecomendacoes.style.display = 'block';
    } else {
      gridRecomendacoes.innerHTML = recomendacoes.map(criarCardRecomendacao).join('');
      gridRecomendacoes.style.display = 'grid';
    }
  } catch (erro) {
    console.warn('Erro ao carregar recomendações:', erro);
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
      <div class="imagem" style="background-image:url('${imagem}')">
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
window.addEventListener('DOMContentLoaded', () => {
  carregarDetalhesLivro();
});
