import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: "AIzaSyA1GzaVBqE6BQ8QALyv6oD2uqFlUuk0S54",
  authDomain: "babel-5dcbd.firebaseapp.com",
  projectId: "babel-5dcbd",
  storageBucket: "babel-5dcbd.firebasestorage.app",
  messagingSenderId: "537037438052",
  appId: "1:537037438052:web:7ae0839725eaf0bbb73371"
};

const auth = getAuth(initializeApp(firebaseConfig));
const provider = new GoogleAuthProvider();
const loginBtn = document.getElementById("loginBtn");
const emailLoginForm = document.getElementById("emailLoginForm");
const emailLoginBtn = document.getElementById("emailLoginBtn");
const loginFeedback = document.getElementById("loginFeedback");

function mensagemErroLogin(erro) {
  const mensagens = {
    "auth/invalid-email": "Informe um endereço de e-mail válido.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente."
  };
  return mensagens[erro.code] || "Não foi possível entrar. Tente novamente.";
}

async function salvarSessao(usuario) {
  const token = await usuario.getIdToken();
  const dadosUsuario = {
    displayName: usuario.displayName || usuario.email,
    email: usuario.email,
    photoURL: usuario.photoURL || "",
    uid: usuario.uid
  };

  localStorage.setItem("token", token);
  localStorage.setItem("usuario", JSON.stringify(dadosUsuario));
  window.location.replace("../index.html");
}

async function entrarComGoogleAndroid() {
  const { FirebaseAuthentication } = await import(
    "https://unpkg.com/@capacitor-firebase/authentication@8.5.2/dist/esm/index.js"
  );
  const resultadoNativo = await FirebaseAuthentication.signInWithGoogle();
  const idTokenGoogle = resultadoNativo.credential?.idToken;

  if (!idTokenGoogle) {
    throw new Error("O Google não retornou um ID token para autenticação.");
  }

  const credencialFirebase = GoogleAuthProvider.credential(idTokenGoogle);
  const resultadoFirebase = await signInWithCredential(auth, credencialFirebase);
  return resultadoFirebase.user;
}

if (emailLoginForm) {
  emailLoginForm.addEventListener("submit", async evento => {
    evento.preventDefault();
    if (!emailLoginForm.reportValidity()) return;

    emailLoginBtn.disabled = true;
    loginBtn.disabled = true;
    loginFeedback.textContent = "Entrando...";

    try {
      const email = document.getElementById("loginEmail").value.trim();
      const senha = document.getElementById("loginPassword").value;
      const resultado = await signInWithEmailAndPassword(auth, email, senha);
      await salvarSessao(resultado.user);
    } catch (erro) {
      console.error("Erro no login com e-mail:", erro);
      loginFeedback.textContent = mensagemErroLogin(erro);
      emailLoginBtn.disabled = false;
      loginBtn.disabled = false;
    }
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    loginBtn.disabled = true;
    emailLoginBtn.disabled = true;
    loginFeedback.textContent = "Conectando ao Google...";

    try {
      const usuario = Capacitor.getPlatform() === "android"
        ? await entrarComGoogleAndroid()
        : (await signInWithPopup(auth, provider)).user;
      await salvarSessao(usuario);
    } catch (erro) {
      console.error("Erro no login com Google:", erro);
      loginFeedback.textContent = "Não foi possível entrar com o Google. Tente novamente.";
      loginBtn.disabled = false;
      emailLoginBtn.disabled = false;
    }
  });
}
