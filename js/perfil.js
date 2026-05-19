const perfilNome = document.getElementById('perfilNome');
const perfilEmail = document.getElementById('perfilEmail');
const perfilUid = document.getElementById('perfilUid');
const logoutBtn = document.getElementById('logoutBtn');

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
  } catch (erro) {
    console.error('Erro ao carregar perfil:', erro);
    window.location.href = '../html/login.html';
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '../index.html';
  });
}

window.addEventListener('DOMContentLoaded', carregarPerfil);