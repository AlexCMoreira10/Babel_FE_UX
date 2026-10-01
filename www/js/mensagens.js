/**
 * Sistema de Mensagens da Plataforma
 * Gerencia o envio, recebimento e exibição de mensagens entre usuários
 */

// Configuração de URLs da API
const URL_BASE_LOCAL = 'http://localhost:3000/api';
const URL_BASE_REMOTE = 'https://babel-be-lovat.vercel.app/api';

let URL_BASE = URL_BASE_LOCAL;

/**
 * Função para fazer requisições com fallback entre URLs
 */
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

// Elementos do DOM
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

// Estado da aplicação
let usuarioLogado = null;
let conversaSelecionada = null;
let mensagens = [];
let conversas = [];

/**
 * Verifica se o usuário está logado
 */
function verificarLogin() {
  const usuarioStr = localStorage.getItem('usuario');
  
  if (!usuarioStr) {
    window.location.href = './login.html';
    return false;
  }
  
  try {
    usuarioLogado = JSON.parse(usuarioStr);
    return true;
  } catch (erro) {
    console.error('Erro ao carregar usuário:', erro);
    window.location.href = './login.html';
    return false;
  }
}

/**
 * Carrega todas as mensagens do usuário
 */
async function carregarMensagens() {
  if (!usuarioLogado) return;

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const resposta = await fetchComFallback(`${URL_BASE}/mensagens`, { headers });
    
    if (!resposta.ok) {
      throw new Error(`Erro ao carregar mensagens: ${resposta.status}`);
    }

    const dados = await resposta.json();
    mensagens = Array.isArray(dados) ? dados : dados.mensagens || [];
    
    // Agrupa mensagens por conversa
    agruparConversas();
    exibirConversas();
  } catch (erro) {
    console.error('Erro ao carregar mensagens:', erro);
    conversasList.innerHTML = '<div class="conversa-item-carregando"><p>Erro ao carregar mensagens</p></div>';
  }
}

/**
 * Agrupa as mensagens em conversas
 */
function agruparConversas() {
  const conversasMap = new Map();

  mensagens.forEach(msg => {
    // Determine o ID do outro usuário
    const outroUsuario = msg.id_remetente === usuarioLogado.uid ? msg.id_destinatario : msg.id_remetente;
    
    if (!conversasMap.has(outroUsuario)) {
      conversasMap.set(outroUsuario, {
        id_usuario: outroUsuario,
        mensagens: [],
        ultima_mensagem: null,
        nao_lidas: 0
      });
    }

    const conversa = conversasMap.get(outroUsuario);
    conversa.mensagens.push(msg);
    
    // Atualiza última mensagem e conta não lidas
    if (!conversa.ultima_mensagem || new Date(msg.data_envio) > new Date(conversa.ultima_mensagem.data_envio)) {
      conversa.ultima_mensagem = msg;
    }
    
    if (!msg.lida && msg.id_destinatario === usuarioLogado.uid) {
      conversa.nao_lidas++;
    }
  });

  conversas = Array.from(conversasMap.values());
  
  // Ordena conversas pela última mensagem (mais recente primeiro)
  conversas.sort((a, b) => {
    const dataA = new Date(a.ultima_mensagem?.data_envio || 0);
    const dataB = new Date(b.ultima_mensagem?.data_envio || 0);
    return dataB - dataA;
  });
}

/**
 * Exibe a lista de conversas
 */
function exibirConversas() {
  if (conversas.length === 0) {
    conversasList.innerHTML = '<div class="conversa-item-carregando"><p>Nenhuma mensagem</p></div>';
    return;
  }

  conversasList.innerHTML = conversas.map((conversa, index) => {
    const ultimaMensagem = conversa.ultima_mensagem;
    const dataEnvio = new Date(ultimaMensagem.data_envio);
    const horaFormatada = formatarHora(dataEnvio);
    
    const preview = ultimaMensagem.id_remetente === usuarioLogado.uid 
      ? `Você: ${ultimaMensagem.conteudo}` 
      : ultimaMensagem.conteudo;

    const classeNaoLida = !ultimaMensagem.lida && ultimaMensagem.id_destinatario === usuarioLogado.uid 
      ? 'nao-lida' 
      : '';

    return `
      <div class="conversa-item ${conversa.id_usuario === conversaSelecionada?.id_usuario ? 'ativa' : ''}" data-conversa="${index}">
        <div class="conversa-info">
          <div class="conversa-nome">${ultimaMensagem.id_remetente === usuarioLogado.uid ? 'Para: ' : 'De: '}${conversa.id_usuario}</div>
          <div class="conversa-preview ${classeNaoLida}">${preview}</div>
        </div>
        <div class="conversa-hora">${horaFormatada}</div>
      </div>
    `;
  }).join('');

  // Adiciona event listeners
  document.querySelectorAll('.conversa-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = item.dataset.conversa;
      selecionarConversa(index);
    });
  });
}

/**
 * Seleciona uma conversa e exibe suas mensagens
 */
function selecionarConversa(index) {
  conversaSelecionada = conversas[index];
  
  // Atualiza visual
  document.querySelectorAll('.conversa-item').forEach((item, i) => {
    item.classList.toggle('ativa', i === parseInt(index));
  });

  // Atualiza cabeçalho do chat
  chatNome.textContent = conversaSelecionada.id_usuario;
  chatStatus.textContent = 'Online';

  // Exibe o painel de chat
  chatVazio.classList.add('hidden');
  chatAtivo.classList.remove('hidden');

  // Carrega as mensagens da conversa
  exibirMensagensConversa();

  // Marca as mensagens como lidas
  marcarMensagensComoLidas();
}

/**
 * Exibe as mensagens da conversa selecionada
 */
function exibirMensagensConversa() {
  if (!conversaSelecionada) return;

  const mensagensConversa = conversaSelecionada.mensagens;

  mensagensArea.innerHTML = mensagensConversa.map(msg => {
    const ehEnviada = msg.id_remetente === usuarioLogado.uid;
    const dataEnvio = new Date(msg.data_envio);
    const horaFormatada = formatarHora(dataEnvio);

    return `
      <div class="mensagem ${ehEnviada ? 'enviada' : 'recebida'}">
        <div class="mensagem-conteudo">${escaparHTML(msg.conteudo)}</div>
        <div class="mensagem-hora">${horaFormatada}</div>
      </div>
    `;
  }).join('');

  // Scroll para a última mensagem
  mensagensArea.scrollTop = mensagensArea.scrollHeight;
}

/**
 * Marca as mensagens da conversa como lidas
 */
async function marcarMensagensComoLidas() {
  if (!conversaSelecionada) return;

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    // Marca mensagens não lidas como lidas
    const mensagensNaoLidas = conversaSelecionada.mensagens.filter(
      msg => !msg.lida && msg.id_destinatario === usuarioLogado.uid
    );

    for (const msg of mensagensNaoLidas) {
      await fetchComFallback(`${URL_BASE}/mensagens/${msg._id || msg.id}/marcar-lida`, {
        method: 'PUT',
        headers
      });
    }
  } catch (erro) {
    console.error('Erro ao marcar mensagens como lidas:', erro);
  }
}

/**
 * Envia uma nova mensagem
 */
async function enviarMensagem(evento) {
  evento.preventDefault();

  if (!conversaSelecionada || !inputMensagem.value.trim()) {
    return;
  }

  const conteudo = inputMensagem.value.trim();
  inputMensagem.value = '';

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const resposta = await fetchComFallback(`${URL_BASE}/mensagens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conteudo,
        id_destinatario: conversaSelecionada.id_usuario,
        id_remetente: usuarioLogado.uid
      })
    });

    if (!resposta.ok) {
      throw new Error(`Erro ao enviar mensagem: ${resposta.status}`);
    }

    // Recarrega as mensagens
    await carregarMensagens();
    
    if (conversaSelecionada) {
      selecionarConversa(conversas.findIndex(c => c.id_usuario === conversaSelecionada.id_usuario));
    }
  } catch (erro) {
    console.error('Erro ao enviar mensagem:', erro);
    inputMensagem.value = conteudo; // Recupera o texto
    alert('Erro ao enviar mensagem. Tente novamente.');
  }
}

/**
 * Formata a data para exibição
 */
function formatarHora(data) {
  const agora = new Date();
  const diff = agora - data;
  const minutos = Math.floor(diff / 60000);
  const horas = Math.floor(diff / 3600000);
  const dias = Math.floor(diff / 86400000);

  if (minutos < 1) return 'Agora';
  if (minutos < 60) return `${minutos}m`;
  if (horas < 24) return `${horas}h`;
  if (dias < 7) return `${dias}d`;
  
  return data.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
}

/**
 * Escapa caracteres HTML para evitar XSS
 */
function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

/**
 * Filtra conversas baseado no texto de busca
 */
function filtrarConversas(texto) {
  const conversasUl = conversasList;
  const items = conversasUl.querySelectorAll('.conversa-item');
  
  items.forEach(item => {
    const nome = item.querySelector('.conversa-nome').textContent.toLowerCase();
    const preview = item.querySelector('.conversa-preview').textContent.toLowerCase();
    
    if (nome.includes(texto.toLowerCase()) || preview.includes(texto.toLowerCase())) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Fecha o chat no mobile
 */
function fecharChat() {
  conversaSelecionada = null;
  chatVazio.classList.remove('hidden');
  chatAtivo.classList.add('hidden');
  document.querySelectorAll('.conversa-item').forEach(item => {
    item.classList.remove('ativa');
  });
}

// Event Listeners
if (formEnviarMensagem) {
  formEnviarMensagem.addEventListener('submit', enviarMensagem);
}

if (filtroConversa) {
  filtroConversa.addEventListener('input', (e) => {
    filtrarConversas(e.target.value);
  });
}

if (btnFecharChat) {
  btnFecharChat.addEventListener('click', fecharChat);
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
  if (verificarLogin()) {
    carregarMensagens();
    
    // Recarrega mensagens a cada 3 segundos
    setInterval(carregarMensagens, 3000);
  }
});
