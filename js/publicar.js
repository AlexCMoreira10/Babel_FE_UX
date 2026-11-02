import { salvarQrLivro } from './books-api.js';
import { validarListaUrlsImagem } from './image-utils.js';

const form = document.getElementById('formPublicar');
const tipoSelect = document.getElementById('tipo');
const precoGroup = document.getElementById('precoGroup');
const dimensoesEnvioGroup = document.getElementById('dimensoesEnvioGroup');
const tamanhoLivroSelect = document.getElementById('tamanhoLivro');
const alturaPacoteInput = document.getElementById('alturaPacote');
const larguraPacoteInput = document.getElementById('larguraPacote');
const comprimentoPacoteInput = document.getElementById('comprimentoPacote');
const pesoPacoteInput = document.getElementById('pesoPacote');

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

function atualizarVisibilidadePreco() {
  const tipo = tipoSelect.value;
  precoGroup.style.display = tipo === 'venda' ? 'grid' : 'none';
  dimensoesEnvioGroup.style.display = tipo === 'venda' ? 'grid' : 'none';
  [alturaPacoteInput, larguraPacoteInput, comprimentoPacoteInput, pesoPacoteInput]
    .forEach(input => { input.required = tipo === 'venda'; });
}

function aplicarTamanhoLivro() {
  const [largura, comprimento] = tamanhoLivroSelect.value.split('x').map(Number);
  if (!largura || !comprimento) return;
  larguraPacoteInput.value = largura;
  comprimentoPacoteInput.value = comprimento;
}

if (tipoSelect) {
  tipoSelect.addEventListener('change', atualizarVisibilidadePreco);
  atualizarVisibilidadePreco();
}

tamanhoLivroSelect.addEventListener('change', aplicarTamanhoLivro);

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

    const { urls: fotos, invalidas } = validarListaUrlsImagem(form.fotos.value);
    if (invalidas.length) {
      alert(`Confira as URLs das imagens. Use endereços válidos iniciados por http:// ou https://.\n\nInválida(s): ${invalidas.join(', ')}`);
      form.fotos.focus();
      return;
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
      fotos,
      localizacao: form.localizacao.value.trim()
    };

    if (form.tipo.value === 'venda') {
      const medidas = [
        Number(alturaPacoteInput.value),
        Number(larguraPacoteInput.value),
        Number(comprimentoPacoteInput.value),
        Number(pesoPacoteInput.value)
      ];
      if (medidas.some(valor => !Number.isFinite(valor) || valor <= 0)) {
        alert('Informe altura, largura, comprimento e peso maiores que zero.');
        return;
      }

      data.preco = Number(form.preco.value);
      data.dimensoes = {
        altura: medidas[0],
        largura: medidas[1],
        comprimento: medidas[2],
        peso: medidas[3]
      };
    }

    // disable submit
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Publicando...';
    }

    try {
      const resposta = await fetchComFallback(`${URL_BASE}/livros`, {
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

      const livroCriado = body?.livro || body?.data?.livro || body?.data || body;
      const dadosQr = {
        ...livroCriado,
        titulo: livroCriado?.titulo || data.titulo,
        qrCode: livroCriado?.qrCode || livroCriado?.qr?.qrCode || '',
        qrUrl: livroCriado?.qrUrl || livroCriado?.qr?.qrUrl || ''
      };
      let detalheFalhaQr = '';
      if (!dadosQr.qrCode && (dadosQr.id || dadosQr._id)) {
        try {
          const idLivro = encodeURIComponent(dadosQr.id || dadosQr._id);
          const respostaQr = await fetchComFallback(`${URL_BASE}/livros/${idLivro}/qrcode`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const qrGerado = await respostaQr.json().catch(() => null);
          if (!respostaQr.ok) {
            throw new Error(qrGerado?.erro || qrGerado?.message || `HTTP ${respostaQr.status}`);
          }
          dadosQr.qrCode = qrGerado?.qrCode || qrGerado?.qr?.qrCode || '';
          dadosQr.qrUrl = qrGerado?.qrUrl || qrGerado?.qr?.qrUrl || dadosQr.qrUrl;
        } catch (erroQr) {
          detalheFalhaQr = erroQr.message;
          console.error('Livro publicado, mas a API não conseguiu gerar o QR Code:', erroQr);
        }
      }
      sessionStorage.setItem('livroPublicadoQr', JSON.stringify(dadosQr));
      try {
        salvarQrLivro(dadosQr);
      } catch (erroArmazenamento) {
        console.error('Não foi possível salvar o QR Code para as próximas visitas:', erroArmazenamento);
      }
      if (dadosQr.qrCode && dadosQr.qrUrl) {
        alert('Livro publicado com sucesso! O QR Code ficará disponível no seu perfil.');
      } else {
        alert(`Livro publicado com sucesso, mas não foi possível gerar o QR Code.${detalheFalhaQr ? ` API: ${detalheFalhaQr}` : ' A API não retornou os dados do QR.'} O livro já foi salvo; não é necessário publicá-lo novamente.`);
      }
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
