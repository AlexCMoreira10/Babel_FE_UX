import { salvarQrLivro } from './books-api.js';
import { validarListaUrlsImagem } from './image-utils.js';

const form = document.getElementById('formPublicar');
const tipoSelect = document.getElementById('tipo');
const idiomaSelect = document.getElementById('idioma');
const idiomaOutroInput = document.getElementById('idiomaOutro');
const generoOutroInput = document.getElementById('generoOutro');
const interesseOutroInput = document.getElementById('interesseOutro');
const cepPublicacaoInput = document.getElementById('localizacao');
const cepPublicacaoFeedback = document.getElementById('cepPublicacaoFeedback');
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

function formatarCep(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.length !== 8) return '';
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

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

async function preencherCepDoCadastro() {
  const token = localStorage.getItem('token');
  if (!token) {
    cepPublicacaoFeedback.textContent = 'Entre na sua conta para preencher o CEP cadastrado.';
    return;
  }

  try {
    const resposta = await fetchComFallback(`${URL_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resposta.ok) {
      throw new Error(`Não foi possível consultar o cadastro (HTTP ${resposta.status}).`);
    }

    const perfil = await resposta.json();
    const cep = formatarCep(perfil.endereco?.cep);
    if (cep) {
      cepPublicacaoInput.value = cep;
      cepPublicacaoFeedback.textContent = 'CEP carregado do seu cadastro. Somente o CEP será usado como localização do anúncio.';
    } else {
      cepPublicacaoFeedback.textContent = 'Não há um CEP válido no seu cadastro. Informe o CEP de origem do livro.';
    }
  } catch (erro) {
    console.error('Não foi possível carregar o CEP do cadastro:', erro);
    cepPublicacaoFeedback.textContent = `${erro.message} Informe o CEP de origem manualmente.`;
  }
}

if (cepPublicacaoInput && cepPublicacaoFeedback) {
  preencherCepDoCadastro();
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

function configurarCampoOutro(nomeGrupo, campoOutro) {
  const checkboxOutro = form.querySelector(`input[name="${nomeGrupo}"][value="Outro"]`);
  const atualizarCampo = () => {
    campoOutro.hidden = !checkboxOutro.checked;
    campoOutro.required = checkboxOutro.checked;
    if (!checkboxOutro.checked) campoOutro.value = '';
  };
  checkboxOutro.addEventListener('change', atualizarCampo);
  atualizarCampo();
}

function obterSelecoesComOutro(nomeGrupo, campoOutro) {
  const selecoes = Array.from(form.querySelectorAll(`input[name="${nomeGrupo}"]:checked`))
    .map(checkbox => checkbox.value)
    .filter(valor => valor !== 'Outro');
  const outroSelecionado = form.querySelector(`input[name="${nomeGrupo}"][value="Outro"]`).checked;
  const valorOutro = campoOutro.value.trim();

  if (outroSelecionado && !valorOutro) {
    campoOutro.focus();
    throw new Error('Preencha o campo “Outro” ou desmarque essa opção.');
  }
  if (valorOutro) selecoes.push(valorOutro);
  return selecoes;
}

if (tipoSelect) {
  tipoSelect.addEventListener('change', atualizarVisibilidadePreco);
  atualizarVisibilidadePreco();
}

tamanhoLivroSelect.addEventListener('change', aplicarTamanhoLivro);
idiomaSelect.addEventListener('change', () => {
  idiomaOutroInput.hidden = idiomaSelect.value !== 'outro';
  idiomaOutroInput.required = idiomaSelect.value === 'outro';
  if (idiomaSelect.value !== 'outro') idiomaOutroInput.value = '';
});
configurarCampoOutro('generos', generoOutroInput);
configurarCampoOutro('trocasInteresses', interesseOutroInput);

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

    let generos;
    let interessesTroca;
    try {
      if (idiomaSelect.value === 'outro' && !idiomaOutroInput.value.trim()) {
        idiomaOutroInput.focus();
        throw new Error('Informe o idioma do livro.');
      }
      generos = obterSelecoesComOutro('generos', generoOutroInput);
      interessesTroca = obterSelecoesComOutro('trocasInteresses', interesseOutroInput);
    } catch (erro) {
      alert(erro.message);
      return;
    }

    const data = {
      titulo: form.titulo.value.trim(),
      autor: form.autor.value.trim(),
      descricao: form.descricao.value.trim(),
      editora: form.editora.value.trim(),
      anoPublicacao: Number(form.anoPublicacao.value) || null,
      generos,
      idioma: idiomaSelect.value === 'outro' ? idiomaOutroInput.value.trim() : idiomaSelect.value,
      condicao: form.condicao.value,
      tipo: form.tipo.value,
      trocas: {
        interesses: interessesTroca,
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
