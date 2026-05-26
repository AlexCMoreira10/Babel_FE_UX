const perfilNome = document.getElementById('perfilNome');
const perfilEmail = document.getElementById('perfilEmail');
const perfilUid = document.getElementById('perfilUid');
const logoutBtn = document.getElementById('logoutBtn');
const refreshAdsBtn = document.getElementById('refreshAdsBtn');
const profileAdsGrid = document.getElementById('profileAdsGrid');
const profileSectionMessage = document.getElementById('profileSectionMessage');

const URL_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'https://babel-backend.onrender.com/api';

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
    const resposta = await fetch(`${URL_BASE}/livros?usuarioId=${encodeURIComponent(usuario.uid)}`, { headers });
    let dados;
    if (!resposta.ok) {
      console.warn('Filtro por usuarioId falhou, tentando buscar todos os anúncios:', resposta.status);
      const fallbackResposta = await fetch(`${URL_BASE}/livros`, { headers });
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
      </div>
    </article>
  `;
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