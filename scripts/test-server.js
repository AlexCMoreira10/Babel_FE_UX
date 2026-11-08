const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..', 'www');
const host = '127.0.0.1';
const port = 3000;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};
const testToken = 'token-teste-local';
const testUserId = 'usuario-teste-01';
let profiles = new Map();
let messages = [];
let notifications = [];
let ownedBooks = [];
let books = [];
let drafts = new Map();
let imageDrafts = new Map();
let users = new Map();

function fakeCover(label) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="220"><rect width="100%" height="100%" fill="#e5eef2"/><text x="50%" y="50%" text-anchor="middle" fill="#133c55">${label}</text></svg>`)}`;
}

function createBook(id, titulo, autor, generos, latitude, longitude, tipo = 'troca') {
  return {
    id,
    titulo,
    autor,
    descricao: `Descrição fictícia de ${titulo}, disponível apenas no ambiente local de testes.`,
    editora: 'Editora de Teste',
    anoPublicacao: 2020,
    idioma: 'Português',
    condicao: 'bom',
    tipo,
    status: 'disponivel',
    preco: tipo === 'venda' ? 25.9 : null,
    generos,
    fotos: [fakeCover(titulo)],
    localizacao: '01001-000',
    geocode: { type: 'Point', coordinates: [longitude, latitude] },
    usuarioId: testUserId,
    usuario: { uid: testUserId, displayName: 'Leitor de Teste', email: 'leitor@teste.local' },
    criadoEm: new Date().toISOString()
  };
}

function resetData() {
  profiles = new Map([[testUserId, {
    uid: testUserId,
    nome: 'Leitor de Teste',
    email: 'leitor@teste.local',
    data_nascimento: '1995-05-10',
    telefone: ['11999990000'],
    endereco: {
      cep: '01001-000',
      rua: 'Rua de Teste',
      numero: 10,
      bairro: 'Sé',
      cidade: 'São Paulo',
      estado: 'SP'
    },
    geocode: { type: 'Point', coordinates: [-46.6333, -23.5505] },
    localizacaoSyncStatus: 'sincronizado'
  }]]);
  users = new Map([['leitor@teste.local', {
    uid: testUserId,
    email: 'leitor@teste.local',
    displayName: 'Leitor de Teste',
    photoURL: '',
    password: 'BabelTeste123!'
  }]]);
  books = [
    createBook('livro-01', 'O Pequeno Príncipe', 'Antoine de Saint-Exupéry', ['Fantasia', 'Infantil'], -23.5505, -46.6333),
    createBook('livro-02', 'O Hobbit', 'J. R. R. Tolkien', ['Fantasia', 'Aventura'], -23.555, -46.638, 'venda'),
    createBook('livro-03', 'Dom Casmurro', 'Machado de Assis', ['Romance', 'Clássico'], -23.56, -46.64, 'doacao'),
    createBook('livro-04', '1984', 'George Orwell', ['Distopia', 'Ficção'], -23.565, -46.63),
    createBook('livro-05', 'Orgulho e Preconceito', 'Jane Austen', ['Romance', 'Clássico'], -23.57, -46.65, 'venda'),
    createBook('livro-06', 'A Revolução dos Bichos', 'George Orwell', ['Ficção', 'Sátira'], -23.58, -46.62),
    createBook('livro-07', 'Capitães da Areia', 'Jorge Amado', ['Romance', 'Brasileiro'], -23.59, -46.64, 'doacao'),
    createBook('livro-08', 'O Alienista', 'Machado de Assis', ['Clássico', 'Sátira'], -23.6, -46.65)
  ];
  ownedBooks = [books[2]];
  notifications = [{
    id: 'notificacao-01',
    titulo: 'Bem-vindo ao ambiente de testes',
    mensagem: 'Esta notificação é fictícia e armazenada somente em memória.',
    lida: false,
    criadoEm: new Date().toISOString()
  }];
  messages = [{
    id: 'mensagem-01',
    id_remetente: 'outro-usuario-teste',
    id_destinatario: testUserId,
    conteudo: 'Olá! Esta conversa é simulada.',
    data_envio: new Date().toISOString(),
    lida: false
  }];
  drafts = new Map();
  imageDrafts = new Map();
}

resetData();

function isAuthenticated(request) {
  return request.headers.authorization === `Bearer ${testToken}`;
}

function send(response, status, data, headers = {}) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(data === null ? '' : JSON.stringify(data));
}

async function readJson(request) {
  let text = '';
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 1024 * 1024) throw new Error('Request body exceeds local test limit.');
  }
  return text ? JSON.parse(text) : {};
}

function paginated(items, url) {
  const page = Math.max(Number.parseInt(url.searchParams.get('page'), 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit'), 10) || 16, 1), 100);
  const start = (page - 1) * limit;
  return {
    total: items.length,
    page,
    limit,
    totalPaginas: Math.ceil(items.length / limit),
    dados: items.slice(start, start + limit)
  };
}

function visibleBooks(url) {
  let result = books.filter(book => book.status === 'disponivel');
  const title = url.searchParams.get('titulo');
  const author = url.searchParams.get('autor');
  const type = url.searchParams.get('tipo');
  if (title) result = result.filter(book => book.titulo.toLocaleLowerCase('pt-BR').includes(title.toLocaleLowerCase('pt-BR')));
  if (author) result = result.filter(book => book.autor === author);
  if (type) result = result.filter(book => book.tipo === type);
  return result;
}

async function handleApi(request, response, url) {
  const method = request.method;
  const pathname = decodeURIComponent(url.pathname.replace(/^\/api/, ''));
  if (method === 'OPTIONS') return send(response, 204, null);

  if (method === 'GET' && pathname === '/livros') {
    const result = paginated(visibleBooks(url), url);
    result.dados = result.dados.map(book => {
      const { geocode, localizacao, ...publicBook } = book;
      return { ...publicBook, localizacao: 'São Paulo - SP' };
    });
    return send(response, 200, result);
  }
  if (method === 'POST' && pathname === '/livros/proximos') {
    const body = await readJson(request);
    let result = visibleBooks(new URL(`http://local/?titulo=${encodeURIComponent(body.titulo || '')}&tipo=${encodeURIComponent(body.tipo || '')}`))
      .filter(book => book.geocode && [3, 5, 10].includes(Number(body.raioKm)));
    const toRad = value => value * Math.PI / 180;
    result = result.map(book => {
      const [longitude, latitude] = book.geocode.coordinates;
      const a = Math.sin(toRad(latitude - body.latitude) / 2) ** 2 +
        Math.cos(toRad(body.latitude)) * Math.cos(toRad(latitude)) *
        Math.sin(toRad(longitude - body.longitude) / 2) ** 2;
      return { ...book, distanciaKm: Math.round(6371 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10 };
    }).filter(book => book.distanciaKm <= Number(body.raioKm))
      .sort((a, b) => a.distanciaKm - b.distanciaKm);
    const resultPage = paginated(result, new URL(`http://local/?page=${body.page || 1}&limit=${body.limit || 16}`));
    resultPage.dados = resultPage.dados.map(book => {
      const { geocode, localizacao, ...publicBook } = book;
      return { ...publicBook, distanciaKm: book.distanciaKm };
    });
    return send(response, 200, resultPage);
  }

  if (method === 'POST' && pathname === '/usuarios/cadastro') {
    const body = await readJson(request);
    if (users.has(body.email)) return send(response, 409, { erro: 'Este e-mail já está cadastrado.' });
    const uid = `usuario-teste-${crypto.randomUUID()}`;
    const user = { uid, email: body.email, displayName: body.nome, password: body.senha, photoURL: '' };
    users.set(body.email, user);
    const profile = { ...body, uid, geocode: body.geocode || null };
    profiles.set(uid, profile);
    return send(response, 201, profile);
  }

  if (method === 'GET' && pathname === '/me') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, profiles.get(testUserId));
  }
  if (method === 'PUT' && pathname === '/me') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    const patch = await readJson(request);
    const profile = { ...profiles.get(testUserId), ...patch };
    profiles.set(testUserId, profile);
    return send(response, 200, profile);
  }
  if (method === 'POST' && pathname === '/me/localizacao/sincronizar') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, { sincronizado: true });
  }
  if (method === 'GET' && pathname === '/me/estante') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, { dados: ownedBooks });
  }
  if (method === 'GET' && pathname === '/me/livros') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, paginated(books.filter(book => book.usuarioId === testUserId), url));
  }
  if (method === 'GET' && pathname === '/notificacoes') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, notifications);
  }
  const notificationMatch = pathname.match(/^\/notificacoes\/([^/]+)\/lida$/);
  if (method === 'PUT' && notificationMatch) {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    const notification = notifications.find(item => item.id === notificationMatch[1]);
    if (notification) notification.lida = true;
    return send(response, notification ? 200 : 404, notification || { erro: 'Notificação não encontrada.' });
  }

  if (method === 'GET' && pathname === '/mensagens/conversas') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, [{
      id_usuario: 'outro-usuario-teste',
      participante: { id: 'outro-usuario-teste', nome: 'Leitor Simulado', foto: '' },
      ultima_mensagem: messages.at(-1),
      mensagens_nao_lidas: 1
    }]);
  }
  if (method === 'GET' && pathname.startsWith('/mensagens/')) {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, messages);
  }
  if (method === 'GET' && pathname === '/mensagens') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, messages);
  }
  if (method === 'POST' && pathname === '/mensagens') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    const body = await readJson(request);
    const message = { id: crypto.randomUUID(), id_remetente: testUserId, ...body, data_envio: new Date().toISOString() };
    messages.push(message);
    return send(response, 201, message);
  }
  const messageRead = pathname.match(/^\/mensagens\/([^/]+)\/lida$/);
  if (method === 'PUT' && messageRead) {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, { sucesso: true });
  }

  const bookIdMatch = pathname.match(/^\/livros\/([^/]+)$/);
  if (bookIdMatch && method === 'GET') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Detalhes por ID exigem sessão simulada no backend.' });
    const book = books.find(item => item.id === bookIdMatch[1]) || [...drafts.values()].find(item => item.id === bookIdMatch[1]);
    return send(response, book ? 200 : 404, book || { erro: 'Livro não encontrado.' });
  }
  if (bookIdMatch && method === 'PUT') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    const book = books.find(item => item.id === bookIdMatch[1]);
    if (!book) return send(response, 404, { erro: 'Livro não encontrado.' });
    Object.assign(book, await readJson(request));
    return send(response, 200, book);
  }
  if (method === 'POST' && pathname === '/livros/rascunhos') {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    const body = await readJson(request);
    const id = `rascunho-${crypto.randomUUID()}`;
    const draft = { ...body, id, usuarioId: testUserId, usuario: profiles.get(testUserId), status: 'rascunho' };
    drafts.set(id, draft);
    return send(response, 201, { id, livroId: id });
  }
  const publishDraft = pathname.match(/^\/livros\/rascunhos\/([^/]+)\/publicar$/);
  if (method === 'POST' && publishDraft) {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    const draft = drafts.get(publishDraft[1]);
    if (!draft) return send(response, 404, { erro: 'Rascunho não encontrado.' });
    const body = await readJson(request);
    const book = { ...draft, ...body, status: 'disponivel', fotos: body.fotos || [], geocode: profiles.get(testUserId)?.geocode };
    books.unshift(book);
    drafts.delete(publishDraft[1]);
    return send(response, 201, { ...book, qrCode: fakeCover('QR DE TESTE'), qrUrl: `http://127.0.0.1:3000/html/rastreio.html?token=${book.id}` });
  }
  const draftDelete = pathname.match(/^\/livros\/rascunhos\/([^/]+)$/);
  if (method === 'DELETE' && draftDelete) {
    drafts.delete(draftDelete[1]);
    return send(response, 204, null);
  }
  const qr = pathname.match(/^\/livros\/([^/]+)\/qrcode$/);
  if (method === 'GET' && qr) {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    return send(response, 200, { qrCode: fakeCover('QR DE TESTE'), qrUrl: `http://127.0.0.1:3000/html/rastreio.html?token=${qr[1]}` });
  }
  const imageDraft = pathname.match(/^\/livros\/([^/]+)\/rascunhos-imagens$/);
  if (method === 'POST' && imageDraft) {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    const id = `imagens-${crypto.randomUUID()}`;
    imageDrafts.set(id, imageDraft[1]);
    return send(response, 201, { id });
  }
  const imageDraftDelete = pathname.match(/^\/livros\/([^/]+)\/rascunhos-imagens\/([^/]+)$/);
  if (method === 'DELETE' && imageDraftDelete) {
    imageDrafts.delete(imageDraftDelete[2]);
    return send(response, 204, null);
  }
  if (method === 'GET' && pathname.startsWith('/livros/rastreio/')) {
    return send(response, 200, { livro: books[0], historico: [], token: pathname.split('/').at(-1) });
  }
  if (pathname.startsWith('/melhor-envio/')) {
    if (!isAuthenticated(request)) return send(response, 401, { erro: 'Sessão simulada necessária.' });
    if (pathname.endsWith('/status')) return send(response, 200, { conectado: false, podeAutorizar: true, responsavelConfigurado: true });
    if (pathname.endsWith('/authorize')) return send(response, 200, { url: 'http://127.0.0.1:3000/__test/freight-info' });
    if (pathname.endsWith('/cotacao')) return send(response, 200, { cotacoes: [{ nomeServico: 'Frete fictício', valor: 12.5, prazoEntrega: 3 }] });
  }

  return send(response, 404, { erro: `Endpoint não simulado: ${method} ${pathname}` });
}

function testModeRequested(request, url) {
  const explicit = url.searchParams.get('babelTestMode') === '1';
  const cookie = (request.headers.cookie || '').split('; ')
    .some(value => value === 'babelTestMode=1');
  return explicit || cookie;
}

async function handle(request, response) {
  const hostHeader = request.headers.host || '';
  if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(hostHeader)) {
    return send(response, 403, { erro: 'Mock server aceita apenas conexões loopback 127.0.0.1.' });
  }

  const url = new URL(request.url, `http://${hostHeader}`);
  const testMode = testModeRequested(request, url);
  const headers = testMode && url.searchParams.get('babelTestMode') === '1'
    ? { 'Set-Cookie': 'babelTestMode=1; Path=/; SameSite=Lax' }
    : {};

  if (url.pathname === '/__test/health') {
    return send(response, 200, { mode: 'local-mocks', outboundNetwork: false }, headers);
  }
  if (url.pathname === '/__test/reset' && request.method === 'POST') {
    resetData();
    return send(response, 200, { reset: true }, headers);
  }
  if (url.pathname.startsWith('/__test/auth/')) {
    const body = await readJson(request);
    if (url.pathname === '/__test/auth/login' && request.method === 'POST') {
      const user = users.get(body.email);
      if (!user || user.password !== body.password) return send(response, 401, { erro: 'Credenciais de teste inválidas.' }, headers);
      return send(response, 200, { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: '' }, headers);
    }
    if (url.pathname === '/__test/auth/register' && request.method === 'POST') {
      if (users.has(body.email)) return send(response, 409, { erro: 'Este e-mail já está cadastrado.' }, headers);
      const uid = `usuario-teste-${crypto.randomUUID()}`;
      const user = { uid, email: body.email, displayName: body.nome, photoURL: '', password: body.senha };
      users.set(body.email, user);
      const profile = {
        ...body,
        uid,
        endereco: body.endereco || {},
        geocode: body.geocode || null
      };
      profiles.set(uid, profile);
      return send(response, 201, { perfil: profile }, headers);
    }
  }
  if (url.pathname.startsWith('/__test/viacep/')) {
    const cep = url.pathname.split('/').at(-1);
    return send(response, 200, {
      cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
      logradouro: 'Rua de Teste',
      complemento: '',
      bairro: 'Sé',
      localidade: 'São Paulo',
      uf: 'SP'
    }, headers);
  }
  if (url.pathname === '/__test/freight-info') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
    return response.end('<h1>Autorização de frete simulada</h1><p>Nenhum serviço externo foi chamado.</p>');
  }
  if (url.pathname === '/favicon.ico') {
    response.writeHead(204, { 'Cache-Control': 'no-store' });
    return response.end();
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      return await handleApi(request, response, url);
    } catch (error) {
      return send(response, 400, { erro: error.message }, headers);
    }
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { erro: 'Método não permitido.' });
  let requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filename = path.resolve(root, `.${requested}`);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    return send(response, 404, { erro: 'Arquivo local não encontrado.', caminho: requested });
  }

  let contents = fs.readFileSync(filename);
  const mime = mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream';
  if (testMode && mime.startsWith('text/html')) {
    let html = contents.toString('utf8');
    html = html.replace(/<script\b[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>\s*<\/script>/gi, '');
    html = html.replace(/<link\b[^>]*\bhref=["']https?:\/\/[^"']+["'][^>]*>/gi, '');
    html = html.replace(/<script\b[^>]*\bsrc=["'](?:\/\/)[^"']+["'][^>]*>\s*<\/script>/gi, '');
    html = html.replace(/<link\b[^>]*\bhref=["'](?:\/\/)[^"']+["'][^>]*>/gi, '');
    html = html.replace(/<head\b[^>]*>/i, match => `${match}\n<script src="/js/test-mode.js"></script>`);
    contents = Buffer.from(html);
  } else if (testMode && mime.startsWith('text/css')) {
    contents = Buffer.from(contents.toString('utf8').replace(/url\(\s*(['"]?)https?:\/\/[^)]*\)/gi, 'none'));
  }

  response.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-store',
    'Content-Length': contents.length,
    ...(testMode && url.searchParams.get('babelTestMode') === '1'
      ? { 'Set-Cookie': 'babelTestMode=1; Path=/; SameSite=Lax' }
      : {})
  });
  response.end(request.method === 'HEAD' ? undefined : contents);
}

const server = http.createServer((request, response) => {
  handle(request, response).catch(error => {
    console.error('Local test server error:', error);
    if (!response.headersSent) send(response, 500, { erro: 'Falha no servidor de testes local.' });
    else response.destroy();
  });
});

server.listen(port, host, () => {
  console.log(`Mock server local em http://${host}:${port}`);
  console.log(`Abra http://${host}:${port}/?babelTestMode=1 para ativar mocks nesta sessão.`);
  console.log('Dados apenas em memória; conexões de saída não são criadas pelo servidor.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
