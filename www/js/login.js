import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { Capacitor } from "@capacitor/core";

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

if (loginBtn) {
  loginBtn.onclick = async () => {
    try {
      loginBtn.innerText = "Aguarde...";
      loginBtn.disabled = true;

      const usuario = Capacitor.getPlatform() === "android"
        ? await entrarComGoogleAndroid()
        : (await signInWithPopup(auth, provider)).user;
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

        window.location.replace("../index.html");
      }
    } catch (erro) {
      console.error("Erro no login:", erro);
      alert(`Não foi possível entrar com o Google.\n${erro.message || "Tente novamente."}`);
    } finally {
      loginBtn.innerText = "Entrar com Google";
      loginBtn.disabled = false;
    }
  };
}