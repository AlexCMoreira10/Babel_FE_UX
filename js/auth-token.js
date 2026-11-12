const testMode = window.BABEL_TEST_MODE === true;
const firebaseConfig = {
  apiKey: 'AIzaSyA1GzaVBqE6BQ8QALyv6oD2uqFlUuk0S54',
  authDomain: 'babel-5dcbd.firebaseapp.com',
  projectId: 'babel-5dcbd',
  storageBucket: 'babel-5dcbd.firebasestorage.app',
  messagingSenderId: '537037438052',
  appId: '1:537037438052:web:7ae0839725eaf0bbb73371'
};

let auth;
const firebasePronto = testMode ? Promise.resolve() : Promise.all([
  import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
]).then(([appModule, authModule]) => {
  const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
  auth = authModule.getAuth(app);
});

/**
 * Devolve um ID token válido da sessão atual.
 * Como os ID tokens do Firebase expiram a cada hora, renovamos pelo SDK sempre
 * que possível (o SDK renova automaticamente quando perto de expirar) e
 * atualizamos o localStorage. Se a renovação falhar, caímos de volta para o
 * token salvo, e o servidor decide se ainda vale.
 */
export async function obterTokenValido() {
  const tokenSalvo = localStorage.getItem('token');
  if (testMode) return tokenSalvo;

  try {
    await firebasePronto;
    const usuario = auth.currentUser;
    if (usuario) {
      const token = await usuario.getIdToken();
      if (token && token !== tokenSalvo) localStorage.setItem('token', token);
      return token || tokenSalvo;
    }
  } catch (erro) {
    console.warn('Não foi possível renovar o token da sessão:', erro);
  }
  return tokenSalvo;
}
