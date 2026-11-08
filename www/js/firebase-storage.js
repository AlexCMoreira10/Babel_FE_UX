import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA1GzaVBqE6BQ8QALyv6oD2uqFlUuk0S54',
  authDomain: 'babel-5dcbd.firebaseapp.com',
  projectId: 'babel-5dcbd',
  storageBucket: 'babel-5dcbd.firebasestorage.app',
  messagingSenderId: '537037438052',
  appId: '1:537037438052:web:7ae0839725eaf0bbb73371'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
const LIMITE_IMAGEM_BYTES = 5 * 1024 * 1024;
const EXTENSAO_POR_TIPO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function extrairPathStorage(urlValue) {
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }

  const prefixo = `/v0/b/${firebaseConfig.storageBucket}/o/`;
  if (url.protocol !== 'https:' ||
      url.hostname !== 'firebasestorage.googleapis.com' ||
      !url.pathname.startsWith(prefixo)) {
    return null;
  }

  try {
    return decodeURIComponent(url.pathname.slice(prefixo.length));
  } catch {
    return null;
  }
}

export function aguardarUsuarioFirebase() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve, reject) => {
    let cancelar = () => {};
    cancelar = onAuthStateChanged(auth, (usuario) => {
      cancelar();
      if (usuario) {
        resolve(usuario);
      } else {
        reject(new Error('Sua sessão Firebase expirou. Entre novamente para continuar.'));
      }
    }, (erro) => {
      cancelar();
      reject(erro);
    });
  });
}

export function validarArquivosImagem(files, totalExistente = 0) {
  const arquivos = Array.from(files || []);
  if (totalExistente + arquivos.length > 5) {
    throw new Error('O anúncio pode ter no máximo 5 imagens.');
  }

  for (const arquivo of arquivos) {
    if (!Object.hasOwn(EXTENSAO_POR_TIPO, arquivo.type)) {
      throw new Error(`Formato não permitido: ${arquivo.name}. Use JPEG, PNG ou WebP.`);
    }
    if (arquivo.size <= 0 || arquivo.size > LIMITE_IMAGEM_BYTES) {
      throw new Error(`A imagem ${arquivo.name} deve ter até 5 MB.`);
    }
  }

  return arquivos;
}

export async function enviarImagensLivro(files, { usuario, livroId, uploadId }) {
  if (!usuario?.uid || !livroId || !uploadId) {
    throw new Error('Não foi possível identificar a sessão ou a operação de upload.');
  }

  const arquivos = validarArquivosImagem(files);
  const enviados = [];

  try {
    for (const arquivo of arquivos) {
      const extensao = EXTENSAO_POR_TIPO[arquivo.type];
      const path = `livros/${usuario.uid}/${livroId}/${crypto.randomUUID()}.${extensao}`;
      const referencia = ref(storage, path);
      await uploadBytes(referencia, arquivo, {
        contentType: arquivo.type,
        customMetadata: { uploadId }
      });

      const imagem = { path, url: '' };
      enviados.push(imagem);
      imagem.url = await getDownloadURL(referencia);
    }
    return enviados;
  } catch (erro) {
    erro.uploadedFiles = enviados;
    throw erro;
  }
}

export async function removerUploadsDaOperacao(files, usuarioId) {
  const falhas = [];
  for (const arquivo of files || []) {
    const path = typeof arquivo === 'string' ? arquivo : arquivo?.path;
    if (!path?.startsWith(`livros/${usuarioId}/`)) {
      falhas.push(path || 'caminho inválido');
      continue;
    }

    try {
      await deleteObject(ref(storage, path));
    } catch (erro) {
      if (erro.code !== 'storage/object-not-found') {
        falhas.push(path);
        console.error(`Não foi possível remover o upload ${path}:`, erro);
      }
    }
  }

  if (falhas.length) {
    throw new Error(`Não foi possível remover ${falhas.length} arquivo(s) temporário(s).`);
  }
}

export async function removerImagensStorageProprias(urls, usuarioId) {
  const arquivosProprios = Array.from(urls || [])
    .map((url) => ({ url, path: extrairPathStorage(url) }))
    .filter(({ path }) => path?.startsWith(`livros/${usuarioId}/`));

  await removerUploadsDaOperacao(arquivosProprios, usuarioId);
}
