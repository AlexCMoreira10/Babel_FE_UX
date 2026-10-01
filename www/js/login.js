import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* CONFIG FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyA1GzaVBqE6BQ8QALyv6oD2uqFlUuk0S54",
  authDomain: "babel-5dcbd.firebaseapp.com",
  projectId: "babel-5dcbd",
  storageBucket: "babel-5dcbd.firebasestorage.app",
  messagingSenderId: "537037438052",
  appId: "1:537037438052:web:7ae0839725eaf0bbb73371"
};

/* INICIALIZA FIREBASE */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/*Criar variavel global para armazenar o token do usuário*/
let token = null;

/* URL DO BACKEND pode ser alterada conforme necessário */
// const URL_BASE = "http://localhost:3000/api";
// const URL_BASE = "https://babel-be-lovat.vercel.app/api";

/* BOTÃO */
const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.onclick = async () => {
    try {
      loginBtn.innerText = "Entrando...";
      loginBtn.disabled = true;

      const result = await signInWithPopup(auth, provider);
      const usuario = result.user;
      token = await usuario.getIdToken();
      console.log("Token do usuário:", token);

      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("usuario", JSON.stringify({
          displayName: usuario.displayName,
          email: usuario.email,
          photoURL: usuario.photoURL,
          uid: usuario.uid
        }));

        alert("Login bem-sucedido! 💛");
        window.location.href = "../index.html";
      } else {
        alert("Falha no login. Tente novamente.");
        loginBtn.innerText = "Entrar com Google";
        loginBtn.disabled = false;
      }
    } catch (erro) {
      console.error("Erro no login:", erro);
      alert("Erro ao fazer login 😢\nVeja o console (F12)");
      loginBtn.innerText = "Entrar com Google";
      loginBtn.disabled = false;
    }
  };
}