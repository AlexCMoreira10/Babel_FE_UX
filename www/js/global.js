/**
 * Script Global da Plataforma
 * Gerencia o estado de login e atualiza a UI de acordo
 */

/**
 * Verifica o status de login do usuário
 * Atualiza a navbar e exibe/oculta elementos baseado no login
 */
function verificarStatusLogin() {
  const usuario = localStorage.getItem('usuario');
  const token = localStorage.getItem('token');
  
  const profileLink = document.getElementById('profileLink');
  const msgLink = document.getElementById('msgLink');
  
  if (usuario && token) {
    // Usuário está logado
    try {
      const usuarioObj = JSON.parse(usuario);
      
      if (profileLink) {
        profileLink.href = './html/perfil.html';
        profileLink.innerHTML = `
          <ion-icon name="person-outline"></ion-icon>
          Perfil
        `;
      }
      
      // Mostra botão de mensagens
      if (msgLink) {
        msgLink.classList.remove('hidden');
      }
    } catch (erro) {
      console.error('Erro ao fazer parse do usuário:', erro);
      limparLogin();
    }
  } else {
    // Usuário não está logado
    if (profileLink) {
      profileLink.href = './html/login.html';
      profileLink.innerHTML = `
        <ion-icon name="person-outline"></ion-icon>
        Entrar
      `;
    }
    
    // Oculta botão de mensagens
    if (msgLink) {
      msgLink.classList.add('hidden');
    }
  }
}

/**
 * Remove dados de login do localStorage
 */
function limparLogin() {
  localStorage.removeItem('usuario');
  localStorage.removeItem('token');
  verificarStatusLogin();
}

/**
 * Atualiza o status quando a página recebe foco
 */
window.addEventListener('focus', verificarStatusLogin);

/**
 * Verifica o status ao carregar a página
 */
window.addEventListener('DOMContentLoaded', verificarStatusLogin);

/**
 * Detecta mudanças no localStorage
 */
window.addEventListener('storage', (evento) => {
  if (evento.key === 'usuario' || evento.key === 'token') {
    verificarStatusLogin();
  }
});
