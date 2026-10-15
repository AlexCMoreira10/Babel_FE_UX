import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1GzaVBqE6BQ8QALyv6oD2uqFlUuk0S54",
  authDomain: "babel-5dcbd.firebaseapp.com",
  projectId: "babel-5dcbd",
  storageBucket: "babel-5dcbd.firebasestorage.app",
  messagingSenderId: "537037438052",
  appId: "1:537037438052:web:7ae0839725eaf0bbb73371"
};

const URL_BASE_LOCAL = "http://localhost:3000/api";
const URL_BASE_REMOTE = "https://babel-be-lovat.vercel.app/api";
const URL_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? URL_BASE_LOCAL
  : URL_BASE_REMOTE;
const auth = getAuth(initializeApp(firebaseConfig));
const cadastroForm = document.getElementById("cadastroForm");
const cadastroBtn = document.getElementById("cadastroBtn");
const cadastroFeedback = document.getElementById("cadastroFeedback");
const telefonesList = document.getElementById("telefonesList");
const adicionarTelefoneBtn = document.getElementById("adicionarTelefone");
const senhaInput = document.getElementById("senha");
const confirmarSenhaInput = document.getElementById("confirmarSenha");
const dataNascimentoInput = document.getElementById("dataNascimento");
const cepInput = document.getElementById("cep");
const cepFeedback = document.getElementById("cepFeedback");
const consultarCepBtn = document.getElementById("consultarCep");
const usarLocalizacaoBtn = document.getElementById("usarLocalizacao");
const localizacaoFeedback = document.getElementById("localizacaoFeedback");
let cepConsultado = "";
let cepConsultaAtual = "";
let cepConsultaPromise = null;
let cepConsultaController = null;
let localizacaoEmAndamento = false;

function mostrarFeedback(mensagem, tipo = "") {
  cadastroFeedback.textContent = mensagem;
  cadastroFeedback.classList.toggle("erro", tipo === "erro");
  cadastroFeedback.classList.toggle("sucesso", tipo === "sucesso");
}

function preencherCampoEndereco(id, valor, { substituirVazio = false } = {}) {
  const campo = document.getElementById(id);
  if (substituirVazio && campo.value.trim()) return;
  campo.value = valor || "";
}

async function consultarCep() {
  const cep = cepInput.value.replace(/\D/g, "");
  if (cep.length !== 8) {
    cepFeedback.textContent = "Informe um CEP válido com 8 números.";
    cepFeedback.classList.add("erro");
    return;
  }

  if (cepConsultado === cep) return;
  if (cepConsultaPromise && cepConsultaAtual === cep) return cepConsultaPromise;
  cepConsultaController?.abort();

  const controller = new AbortController();
  cepConsultaController = controller;
  cepConsultaAtual = cep;
  consultarCepBtn.disabled = true;
  consultarCepBtn.textContent = "Buscando...";
  cepFeedback.classList.remove("erro", "sucesso");
  cepFeedback.textContent = "Consultando o ViaCEP...";

  cepConsultaPromise = (async () => {
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal
      });
      if (!resposta.ok) {
        throw new Error(`O ViaCEP retornou o status ${resposta.status}.`);
      }

      const dados = await resposta.json();
      if (dados.erro) {
        cepFeedback.textContent = "CEP não encontrado. Confira o número ou preencha o endereço manualmente.";
        cepFeedback.classList.add("erro");
        return;
      }

      if (cepInput.value.replace(/\D/g, "") !== cep) return;

      preencherCampoEndereco("cep", dados.cep);
      preencherCampoEndereco("rua", dados.logradouro);
      preencherCampoEndereco("complemento", dados.complemento, { substituirVazio: true });
      preencherCampoEndereco("bairro", dados.bairro);
      preencherCampoEndereco("cidade", dados.localidade);
      preencherCampoEndereco("estado", dados.uf);
      cepConsultado = cep;
      cepFeedback.textContent = "Endereço preenchido. Você ainda pode editar os campos.";
      cepFeedback.classList.add("sucesso");
    } catch (erro) {
      if (erro.name === "AbortError") return;
      console.error("Erro ao consultar o ViaCEP:", erro);
      cepFeedback.textContent = "Não foi possível consultar o CEP. Confira sua conexão ou preencha o endereço manualmente.";
      cepFeedback.classList.add("erro");
    } finally {
      if (cepConsultaController === controller) {
        consultarCepBtn.disabled = false;
        consultarCepBtn.textContent = "Buscar CEP";
        cepConsultaController = null;
        cepConsultaPromise = null;
        cepConsultaAtual = "";
      }
    }
  })();

  return cepConsultaPromise;
}

function obterMensagemErroLocalizacao(erro) {
  switch (erro.code) {
    case 1:
      return "Permissão de localização negada. Autorize o acesso nas configurações do navegador ou do dispositivo.";
    case 2:
      return "Sua localização não está disponível. Confira o sinal/GPS e tente novamente.";
    case 3:
      return "A localização demorou demais para ser obtida. Tente novamente.";
    default:
      return "Não foi possível obter sua localização. Você pode informar as coordenadas manualmente.";
  }
}

function usarLocalizacaoAtual() {
  if (localizacaoEmAndamento) return;

  if (!window.isSecureContext) {
    localizacaoFeedback.textContent = "A localização automática exige HTTPS (ou localhost).";
    localizacaoFeedback.classList.add("erro");
    return;
  }

  if (!navigator.geolocation) {
    localizacaoFeedback.textContent = "Este navegador não oferece suporte à localização. Informe as coordenadas manualmente.";
    localizacaoFeedback.classList.add("erro");
    return;
  }

  localizacaoEmAndamento = true;
  usarLocalizacaoBtn.disabled = true;
  usarLocalizacaoBtn.textContent = "Obtendo localização...";
  localizacaoFeedback.classList.remove("erro", "sucesso");
  localizacaoFeedback.textContent = "Aguardando autorização e posição do dispositivo...";

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      document.getElementById("longitude").value = String(coords.longitude);
      document.getElementById("latitude").value = String(coords.latitude);
      localizacaoFeedback.textContent = "Localização preenchida. As coordenadas ainda podem ser editadas.";
      localizacaoFeedback.classList.add("sucesso");
      finalizarLocalizacao();
    },
    erro => {
      console.warn("Não foi possível obter a localização do usuário:", erro);
      localizacaoFeedback.textContent = obterMensagemErroLocalizacao(erro);
      localizacaoFeedback.classList.add("erro");
      finalizarLocalizacao();
    },
    {
      enableHighAccuracy: false,
      maximumAge: 60000,
      timeout: 15000
    }
  );
}

function finalizarLocalizacao() {
  localizacaoEmAndamento = false;
  usarLocalizacaoBtn.disabled = false;
  usarLocalizacaoBtn.textContent = "Usar minha localização";
}

function obterMensagemErroApi(corpo, status) {
  if (status === 409) return "Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.";
  if (status === 400) {
    return corpo?.message || corpo?.mensagem || corpo?.error || "Confira os dados informados e tente novamente.";
  }
  return corpo?.message || corpo?.mensagem || corpo?.error || "Não foi possível criar sua conta. Tente novamente.";
}

async function enviarCadastro(dados) {
  const opcoes = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  };

  let resposta;
  try {
    resposta = await fetch(`${URL_BASE}/usuarios/cadastro`, opcoes);
  } catch (erro) {
    if (URL_BASE !== URL_BASE_LOCAL) throw erro;
    console.warn(`Falha ao conectar em ${URL_BASE_LOCAL}, tentando ${URL_BASE_REMOTE}...`);
    resposta = await fetch(`${URL_BASE_REMOTE}/usuarios/cadastro`, opcoes);
  }

  const textoResposta = await resposta.text();
  let corpo = {};
  if (textoResposta) {
    try {
      corpo = JSON.parse(textoResposta);
    } catch {
      corpo = { message: textoResposta };
    }
  }

  if (!resposta.ok) {
    throw new Error(obterMensagemErroApi(corpo, resposta.status));
  }

  return corpo;
}

function obterTelefones() {
  return Array.from(telefonesList.querySelectorAll('input[name="telefone"]'))
    .map(input => input.value.trim())
    .filter(Boolean);
}

function obterEndereco() {
  const campos = ["rua", "numero", "complemento", "bairro", "cidade", "estado", "cep"];
  const valores = Object.fromEntries(campos.map(campo => [
    campo,
    document.getElementById(campo).value.trim()
  ]));

  if (!Object.values(valores).some(Boolean)) return undefined;
  const endereco = {};
  for (const [campo, valor] of Object.entries(valores)) {
    if (valor) endereco[campo] = campo === "numero" ? Number(valor) : valor;
  }
  return endereco;
}

function obterGeocode() {
  const longitudeInput = document.getElementById("longitude");
  const latitudeInput = document.getElementById("latitude");
  const longitudeVazia = longitudeInput.value.trim() === "";
  const latitudeVazia = latitudeInput.value.trim() === "";

  if (longitudeVazia && latitudeVazia) return undefined;
  if (longitudeVazia || latitudeVazia) {
    throw new Error("Informe longitude e latitude juntas ou deixe as duas em branco.");
  }

  const longitude = Number(longitudeInput.value);
  const latitude = Number(latitudeInput.value);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("A longitude deve estar entre -180 e 180 graus.");
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("A latitude deve estar entre -90 e 90 graus.");
  }

  return { type: "Point", coordinates: [longitude, latitude] };
}

function construirDadosCadastro() {
  const senha = senhaInput.value;
  if (senha !== confirmarSenhaInput.value) {
    confirmarSenhaInput.setCustomValidity("As senhas não coincidem.");
    confirmarSenhaInput.reportValidity();
    throw new Error("As senhas não coincidem.");
  }
  confirmarSenhaInput.setCustomValidity("");

  const dataNascimento = dataNascimentoInput.value;
  if (dataNascimento > new Date().toISOString().slice(0, 10)) {
    throw new Error("A data de nascimento não pode estar no futuro.");
  }

  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const telefone = obterTelefones();
  if (!nome) throw new Error("Informe seu nome completo.");
  if (!email) throw new Error("Informe seu e-mail.");
  if (!telefone.length) throw new Error("Informe pelo menos um telefone para contato.");

  const dados = {
    nome,
    email,
    senha,
    telefone,
    data_nascimento: `${dataNascimento}T00:00:00.000Z`
  };

  const endereco = obterEndereco();
  const geocode = obterGeocode();
  if (endereco) dados.endereco = endereco;
  if (geocode) dados.geocode = geocode;
  return dados;
}

function salvarSessao(usuario, perfil, nome) {
  return usuario.getIdToken().then(token => {
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify({
      displayName: perfil.nome || nome || usuario.displayName || usuario.email,
      email: perfil.email || usuario.email,
      photoURL: perfil.foto || usuario.photoURL || "",
      uid: usuario.uid
    }));
  });
}

function adicionarCampoTelefone() {
  const item = document.createElement("div");
  item.className = "telefone-item";
  item.innerHTML = `
    <input name="telefone" type="tel" autocomplete="tel" placeholder="Outro telefone" aria-label="Telefone adicional">
    <button class="btn-remover-telefone" type="button" aria-label="Remover telefone">Remover</button>`;
  telefonesList.append(item);
  item.querySelector("input").focus();
}

adicionarTelefoneBtn.addEventListener("click", adicionarCampoTelefone);
telefonesList.addEventListener("click", evento => {
  const botaoRemover = evento.target.closest(".btn-remover-telefone");
  if (botaoRemover) botaoRemover.closest(".telefone-item").remove();
});

consultarCepBtn.addEventListener("click", consultarCep);
usarLocalizacaoBtn.addEventListener("click", usarLocalizacaoAtual);
cepInput.addEventListener("blur", () => {
  if (cepInput.value.trim()) consultarCep();
});
cepInput.addEventListener("input", () => {
  if (cepInput.value.replace(/\D/g, "") !== cepConsultado) {
    cepConsultado = "";
    cepFeedback.textContent = "";
    cepFeedback.classList.remove("erro", "sucesso");
  }
});
confirmarSenhaInput.addEventListener("input", () => confirmarSenhaInput.setCustomValidity(""));
dataNascimentoInput.max = new Date().toISOString().slice(0, 10);

cadastroForm.addEventListener("submit", async evento => {
  evento.preventDefault();
  confirmarSenhaInput.setCustomValidity("");
  if (!cadastroForm.reportValidity()) return;

  let dados;
  try {
    dados = construirDadosCadastro();
  } catch (erro) {
    mostrarFeedback(erro.message, "erro");
    return;
  }

  cadastroBtn.disabled = true;
  cadastroBtn.textContent = "Criando conta...";
  mostrarFeedback("Estamos criando sua conta...");

  try {
    const perfil = await enviarCadastro(dados);
    try {
      const resultadoLogin = await signInWithEmailAndPassword(auth, dados.email, dados.senha);
      await salvarSessao(resultadoLogin.user, perfil, dados.nome);
      mostrarFeedback("Conta criada! Redirecionando para sua estante...", "sucesso");
      window.setTimeout(() => window.location.replace("../index.html"), 700);
    } catch (erroLogin) {
      console.error("Conta criada, mas não foi possível iniciar a sessão:", erroLogin);
      senhaInput.value = "";
      confirmarSenhaInput.value = "";
      cadastroBtn.textContent = "Conta criada";
      mostrarFeedback("Sua conta foi criada, mas não foi possível iniciar a sessão automaticamente. Entre com seu e-mail e senha.", "sucesso");
    }
  } catch (erro) {
    console.error("Erro no cadastro:", erro);
    mostrarFeedback(erro.message || "Não foi possível criar sua conta. Tente novamente.", "erro");
    cadastroBtn.disabled = false;
    cadastroBtn.textContent = "Criar conta";
  }
});
