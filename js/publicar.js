const form = document.getElementById('formPublicar');
const tipoSelect = document.getElementById('tipo');
const precoGroup = document.getElementById('precoGroup');

const URL_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'https://babel-backend.onrender.com/api';

function atualizarVisibilidadePreco() {
  const tipo = tipoSelect.value;
  precoGroup.style.display = tipo === 'venda' ? 'grid' : 'none';
}

if (tipoSelect) {
  tipoSelect.addEventListener('change', atualizarVisibilidadePreco);
}

if (form) {
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Você precisa estar logado para publicar um livro.');
      window.location.href = './login.html';
      return;
    }

    // basic client-side validation
    if (form.tipo.value === '') {
      alert('Selecione o tipo de anúncio.');
      return;
    }

    if (form.tipo.value === 'venda' && (!form.preco.value || Number(form.preco.value) <= 0)) {
      alert('Informe um preço válido para anúncios de venda.');
      return;
    }

    // build payload
    const usuarioStr = localStorage.getItem('usuario');
    let usuarioObj = null;
    try {
      usuarioObj = usuarioStr ? JSON.parse(usuarioStr) : null;
    } catch (err) {
      console.warn('usuario no localStorage corrompido', err);
    }

    const data = {
      titulo: form.titulo.value.trim(),
      autor: form.autor.value.trim(),
      descricao: form.descricao.value.trim(),
      editora: form.editora.value.trim(),
      anoPublicacao: Number(form.anoPublicacao.value) || null,
      generos: form.generos.value.split(',').map(item => item.trim()).filter(Boolean),
      idioma: form.idioma.value.trim(),
      condicao: form.condicao.value,
      tipo: form.tipo.value,
      trocas: {
        interesses: form.trocasInteresses.value.split(',').map(item => item.trim()).filter(Boolean),
        aceitaRetirada: form.aceitaRetirada.checked
      },
      fotos: form.fotos.value.split(',').map(url => url.trim()).filter(Boolean),
      localizacao: form.localizacao.value.trim()
    };

    if (form.tipo.value === 'venda') {
      data.preco = Number(form.preco.value);
    }

    // attach usuarioId if available
    if (usuarioObj && usuarioObj.uid) {
      data.usuarioId = usuarioObj.uid;
    }

    // disable submit
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Publicando...';
    }

    try {
      const resposta = await fetch(`${URL_BASE}/livros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const body = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        const msg = body?.message || body?.error || 'Erro ao publicar livro';
        throw new Error(msg);
      }

      alert('Livro publicado com sucesso!');
      // on success, redirect to perfil to show user's books
      window.location.href = './perfil.html';
    } catch (error) {
      console.error('Erro ao publicar:', error);
      alert(`Falha ao publicar: ${error.message || error}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publicar livro';
      }
    }
  });
}
