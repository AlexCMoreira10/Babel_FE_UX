const URL_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'https://babel-backend.onrender.com/api';
const formAtualizar = document.getElementById('formAtualizar');
const updateMessage = document.getElementById('updateMessage');
const tituloInput = document.getElementById('titulo');
const autorInput = document.getElementById('autor');
const editoraInput = document.getElementById('editora');
const anoInput = document.getElementById('anoPublicacao');
const idiomaInput = document.getElementById('idioma');
const condicaoSelect = document.getElementById('condicao');
const tipoSelect = document.getElementById('tipo');
const precoGroup = document.getElementById('precoGroup');
const precoInput = document.getElementById('preco');
const generosInput = document.getElementById('generos');
const localizacaoInput = document.getElementById('localizacao');
const descricaoInput = document.getElementById('descricao');
const fotosInput = document.getElementById('fotos');
const trocasInput = document.getElementById('trocasInteresses');
const aceitaRetiradaInput = document.getElementById('aceitaRetirada');

function normalizeLivroData(data) {
  if (!data) return {};

  if (Array.isArray(data)) {
    return pickLivroFromArray(data);
  }

  if (data.livros) {
    return normalizeLivroData(data.livros);
  }

  if (data.livro) {
    return normalizeLivroData(data.livro);
  }

  if (data.data) {
    return normalizeLivroData(data.data);
  }

  return data;
}

function pickLivroFromArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return {};
  const match = arr.find((item) => {
    const itemId = item._id || item.id || item.usuarioId || item.uid;
    return String(itemId) === String(livroId);
  });
  return match || arr[0] || {};
}

function toStringArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(toStringArray).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'object') return Object.values(value).flatMap(toStringArray).filter(Boolean);
  return [String(value)];
}

const params = new URLSearchParams(window.location.search);
const livroId = params.get('id');

if (!livroId) {
  updateMessage.textContent = 'ID do anúncio não encontrado na URL.';
} else {
  carregarLivro();
}

tipoSelect.addEventListener('change', () => {
  precoGroup.style.display = tipoSelect.value === 'venda' ? 'block' : 'none';
});

formAtualizar.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

  if (!token || !usuario) {
    alert('Você precisa estar logado para atualizar o anúncio.');
    window.location.href = './login.html';
    return;
  }

  const payload = {
    usuarioId: usuario.uid || usuario.id || null,
    titulo: tituloInput.value.trim(),
    autor: autorInput.value.trim(),
    editora: editoraInput.value.trim(),
    anoPublicacao: anoInput.value ? Number(anoInput.value) : undefined,
    idioma: idiomaInput.value.trim(),
    condicao: condicaoSelect.value,
    tipo: tipoSelect.value,
    localizacao: localizacaoInput.value.trim(),
    descricao: descricaoInput.value.trim(),
    generos: generosInput.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    fotos: fotosInput.value
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
    trocas: {
      interesses: trocasInput.value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      aceitaRetirada: aceitaRetiradaInput.checked,
    },
  };

  if (tipoSelect.value === 'venda') {
    payload.preco = precoInput.value ? Number(precoInput.value) : 0;
  } else {
    delete payload.preco;
  }

  try {
    const response = await fetch(`${URL_BASE}/livros/${livroId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Falha ao atualizar o anúncio.');
    }

    alert('Anúncio atualizado com sucesso.');
    window.location.href = './perfil.html';
  } catch (error) {
    console.error('Erro na atualização:', error);
    alert('Não foi possível atualizar o anúncio. Tente novamente.');
  }
});

async function carregarLivro() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      updateMessage.textContent = 'Você precisa estar logado para editar o anúncio.';
      return;
    }

    const response = await fetch(`${URL_BASE}/livros/${livroId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Não foi possível carregar os dados do anúncio.');
    }

    const data = await response.json();
    const livro = normalizeLivroData(data);
    console.log('Dados do livro para edição:', livro);

    tituloInput.value = livro.titulo || livro.title || '';
    autorInput.value = livro.autor || livro.author || '';
    editoraInput.value = livro.editora || livro.publisher || livro.editora || '';
    anoInput.value = livro.anoPublicacao ?? livro.ano ?? livro.year ?? '';
    idiomaInput.value = livro.idioma || livro.language || '';
    condicaoSelect.value = livro.condicao || '';
    tipoSelect.value = livro.tipo || '';
    localizacaoInput.value = livro.localizacao || livro.location || '';
    descricaoInput.value = livro.descricao || livro.description || '';
    fotosInput.value = toStringArray(livro.fotos || livro.imagem || livro.foto).join(', ');
    generosInput.value = toStringArray(livro.generos || livro.genero).join(', ');
    const trocasInteresses = toStringArray(livro.trocas?.interesses || livro.trocas);
    trocasInput.value = trocasInteresses.join(', ');
    aceitaRetiradaInput.checked = livro.trocas?.aceitaRetirada ?? false;
    precoInput.value = livro.preco ?? '';

    precoGroup.style.display = tipoSelect.value === 'venda' ? 'block' : 'none';
    formAtualizar.style.display = 'grid';
    updateMessage.style.display = 'none';
  } catch (error) {
    console.error('Erro ao carregar anúncio:', error);
    updateMessage.textContent = 'Falha ao carregar o anúncio. Por favor, tente novamente.';
  }
}
