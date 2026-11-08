# Frontend: fonte e build

A fonte oficial do cliente fica na raiz: `index.html`, `html/`, `css/` e `js/`.
Edite esses arquivos, não os arquivos gerados em `www/`. A mesma estrutura de
caminhos relativos funciona quando a raiz é publicada no GitHub Pages ou
quando `www/` é utilizada pelo Capacitor.

```bash
npm run build       # gera www/ a partir da fonte oficial
npm run check:web   # identifica arquivos ausentes, extras ou com conteúdo diferente
npm test            # verifica build, integridade, caminhos e sintaxe
```

O build copia apenas arquivos web permitidos de `index.html`, `html/`, `css/`
e `js/`; diretórios de testes, dependências, arquivos ocultos, configurações e
credenciais não são copiados. Ele falha ao encontrar arquivos inesperados em
`www/`, sem apagá-los: revise-os e mova-os manualmente antes de repetir o
build. Arquivos existentes em `www/` que também existem na fonte são
sobrescritos; preserve alterações locais antes de executar o comando. As
configurações públicas do Firebase usadas pelo navegador continuam no código
cliente; nunca coloque chaves privadas ou credenciais de serviço nele.

O Capacitor permanece configurado com `webDir: "www"`; execute o build antes
de `npx cap sync` ou `npx cap copy`. Esses comandos não publicam o site.
Ao servir localmente, use `localhost` ou HTTPS para testar geolocalização.

## Ambiente visual local com mocks

Este ambiente é isolado: usa somente dados em memória e atende apenas conexões
loopback. Não inicia o backend, não acessa Firebase, não faz uploads e não envia
requisições de saída. As telas CDN são removidas no modo de teste. O navegador
recebe um bloqueador que permite `fetch` somente para a mesma origem; falhas
não podem recorrer à API remota.

Comandos exatos, a partir da raiz:

```bash
npm run build
npm run check
npm test
npm run test:server
```

Deixe o servidor ativo e abra no Chrome/Chromium:

`http://localhost:3000/?babelTestMode=1`

Ou abra a página pelo terminal:

```bash
google-chrome --new-window 'http://localhost:3000/?babelTestMode=1'
# Alternativa quando o executável instalado se chama chromium:
chromium 'http://localhost:3000/?babelTestMode=1'
```

O parâmetro ativa os mocks explicitamente; o servidor escuta apenas em
`127.0.0.1` (loopback). O modo não liga em domínios públicos e o app, no modo
teste, permite apenas a mesma origem e o serviço loopback local. Credenciais fictícias:
`leitor@teste.local` / `BabelTeste123!`. Para testar cadastro, use outro e-mail
fictício. A geolocalização usa ponto simulado de São Paulo.

Os registros são reinicializados ao reiniciar o servidor. Para restaurar os
dados fictícios sem parar o servidor:

```bash
curl -X POST http://127.0.0.1:3000/__test/reset
```

Para encerrar, pressione `Ctrl+C` no terminal do `npm run test:server`.
Depois, feche a aba de testes ou limpe o cookie e a sessão do navegador:

```js
document.cookie = 'babelTestMode=; Max-Age=0; Path=/';
sessionStorage.removeItem('babelTestMode');
sessionStorage.removeItem('livroSelecionado');
sessionStorage.removeItem('livroPublicadoQr');
localStorage.removeItem('token');
localStorage.removeItem('usuario');
```

Não abra outras instâncias locais do app com o cookie de testes ativo. Login
Google real, Firebase, scanner QR nativo e callbacks reais do Melhor Envio são
deliberadamente indisponíveis. O QR e o frete apresentados são fictícios.
Uploads são simulados em memória; nenhum arquivo é transmitido ou persistido.
O scanner QR nativo fica desativado antes de carregar qualquer módulo nativo.

Na busca normal, a opção **Autor** usa o filtro existente da API e exige o
nome exato, inclusive maiúsculas e minúsculas. A API de proximidade aceita
apenas título e tipo: para ativá-la, selecione **Título**. Busca parcial por
autor combinada com proximidade depende de suporte futuro no backend.

# Build para celular
- bash 
- npm init -y
- npm install @capacitor/core @capacitor/cli
- npm install @capacitor/android

- npx cap init "babel" "com.alexcmoreira.babel" --web-dir='www'
- npx cap add android
- npx cap copy
- npx cap sync 
- npx cap open android

- app/build/outputs/apk/debug/

# API de Livros - Uso no Postman

## 1. Visão geral

- Base URL: `http://localhost:3000/api`
- Base URL: `https://babel-be-lovat.vercel.app/`
- Essa API é o backend do aplicativo de troca/venda/doação de livros.

### Autenticação

- Todas as rotas (exceto futuras rotas públicas) exigem autenticação via Firebase.
- Cabeçalho obrigatório em todas as requisições protegidas:
  - Authorization: Bearer {{token}}
- O `token` deve ser obtido via login com Google no Firebase.

## 2. Configuração sugerida no Postman

1. Crie um novo environment chamado `Local`.
2. Adicione as variáveis:
   - `baseUrl = http://localhost:3000`
   - `token = COLE_SEU_TOKEN_AQUI`
3. Use `{{baseUrl}}` e `{{token}}` nas requisições.

---

## 3. Rotas da API

### 3.1 Listar livros (com paginação e filtros)

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros`

### 3.1 Listar todos os livros

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros/api/livros`
- Resposta: `200 OK`
- Exemplo de uso:
  - Request: `GET http://localhost:3000/api/livros?page=1&limit=10&titulo=pequeno`

- Resposta: 200 OK

### 3.2 Criar um novo livro

- Método: `POST`
- Endpoint: `{{baseUrl}}/api/livros`
- Cabeçalho: `Content-Type: application/json`
- Body: raw JSON

Exemplo de body válido:

```json
{
  "titulo": "O Pequeno Príncipe",
  "autor": "Antoine de Saint-Exupéry",
  "descricao": "Livro em bom estado, capa dura.",
  "editora": "Agir",
  "anoPublicacao": 1943,
  "generos": ["Infantil", "Fantasia"],
  "idioma": "Português",
  "condicao": "bom",
  "tipo": "doacao",
  "trocas": {
    "interesses": ["Romance", "História"],
    "aceitaRetirada": true
  },
  
  "fotos": ["https://exemplo.com/foto1.jpg"],
  "localizacao": "São Paulo - SP"
}
```

- Regras de validação:`
  - `titulo` e `autor` obrigatórios
  - `condicao` deve ser um de: `novo`, `bom`, `regular`, `usado`
  - `tipo` deve ser um de: `doacao`, `troca`, `venda`
  - `preco` é obrigatório se `tipo` for `venda`
  - `preco` não é permitido se `tipo` for `doacao` ou `troca`
  - `usuarioId` obrigatório

### 3.3 Buscar livro por ID

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros/:id`
- Exemplo: `GET http://localhost:3000/api/livros/abc123`
- Resposta:
  - `200 OK` com o livro
  - `404 Not Found` se não existir

### 3.4 Atualizar livro

- Método: `PUT`
- Endpoint: `{{baseUrl}}/api/livros/:id`
- Cabeçalho: `Content-Type: application/json`
- Body: raw JSON com pelo menos um campo a ser alterado

Exemplo de body de atualização:

```json
{
  "titulo": "O Pequeno Príncipe - Segunda Edição",
  "condicao": "novo",
  "status": "disponivel | reservado | trocado | vendido"
}
```

- Regras de validação:
  - deve enviar pelo menos um campo válido
  - `tipo`, `condicao` e `status` devem respeitar os valores permitidos
  - `preco` só pode ser enviado se `tipo` for `venda`

### 3.5 Deletar livro

- Método: `DELETE`
- Endpoint: `{{baseUrl}}/api/livros/:id`
- Exemplo: `DELETE http://localhost:3000/api/livros/abc123`
- Resposta:
  - `204 No Content` em caso de sucesso
  - `404 Not Found` se não existir

### 3.6 Buscar por título

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros/busca/titulo`
- Query string: `titulo`
- Exemplo:
  - `GET http://localhost:3000/api/livros/busca/titulo?titulo=pequeno`
- Observação:
  - agora a busca encontra o termo em qualquer posição do título
  - por exemplo, `pequeno` encontra `O Pequeno Príncipe`

### 3.7 Busca avançada combinando filtros

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros/busca/avancada`
- Query string: qualquer combinação de:
  - `titulo`
  - `genero`
  - `autor`
  - `editora`
  - `tipo`
  - `ehDoacao`

Exemplos:
  - `GET http://localhost:3000/api/livros/busca/avancada?titulo=pequeno&ehDoacao=true`
  - `GET http://localhost:3000/api/livros/busca/avancada?titulo=pequeno&genero=fantasia`
  - `GET http://localhost:3000/api/livros/busca/avancada?genero=infantil&tipo=doacao`

### 3.8 Buscar por gênero

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros/busca/genero`
- Query string: `genero`
- Exemplo:
  - `GET http://localhost:3000/api/livros/busca/genero?genero=fantasia`

### 3.8 Buscar por editora

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros/busca/editora`
- Query string: `editora`
- Exemplo:
  - `GET http://localhost:3000/api/livros/busca/editora?editora=agir`

### 3.9 Buscar por autor

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros/busca/autor`
- Query string: `autor`
- Exemplo:
  - `GET http://localhost:3000/api/livros/busca/autor?autor=antoine`

### 3.10 Filtrar por tipo de livro

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/livros/filtro/tipo`
- Query string: `ehDoacao`
- Exemplo:
  - `GET http://localhost:3000/api/livros/filtro/tipo?ehDoacao=true`

- Observação:
  - aceita `true` ou `false`
  - retorna livros de doação quando `true`
  - retorna livros de troca/venda quando `false`
  
### 3.11 Notificações

#### Listar notificações do usuário

- Método: `GET`
- Endpoint: `{{baseUrl}}/api/notificacoes`
- Cabeçalho: `Authorization: Bearer {{token}}`
- Descrição: retorna as notificações associadas ao usuário autenticado.
- Exemplo:
  - `GET http://localhost:3000/api/notificacoes`
- Resposta:
  - `200 OK` com um array de notificações
  - `401 Unauthorized` se o token estiver ausente ou inválido

#### Marcar notificação como lida

- Método: `PUT`
- Endpoint: `{{baseUrl}}/api/notificacoes/:id/lida`
- Cabeçalho: `Authorization: Bearer {{token}}`
- Descrição: atualiza o status da notificação para lida.
- Exemplo:
  - `PUT http://localhost:3000/api/notificacoes/abc123/lida`
- Resposta:
  - `200 OK` com `{ mensagem: 'Notificação marcada como lida' }`
  - `401 Unauthorized` se o token estiver ausente ou inválido

## 4. Erros comuns no Postman

- `400 Bad Request`
  - body inválido
  - falta de campo obrigatório
  - `preco` enviado com `tipo` diferente de `venda`
  - query string ausente em endpoints de busca

- `404 Not Found`
  - ID de livro inexistente

- `500 Internal Server Error`
  - problema no servidor ou no Firebase

## 5. Recomendações para criar o collection

- Crie uma coleção `API Livros`
- Adicione requests:
  - `Listar livros`
  - `Criar livro`
  - `Buscar livro por ID`
  - `Atualizar livro`
  - `Deletar livro`
  - `Buscar por título`
  - `Buscar por gênero`
  - `Buscar por editora`
  - `Buscar por autor`
  - `Filtrar por tipo`
- Use `{{baseUrl}}` nas URLs
- Para requests `POST` e `PUT`, use `raw` + `JSON`

## 6. Exemplo de uso rápido

No Postman, copie a URL e defina o body conforme o exemplo abaixo para criar um livro:

```json
{
  "titulo": "O Pequeno Príncipe",
  "autor": "Antoine de Saint-Exupéry",
  "descricao": "Exemplar em bom estado.",
  "editora": "Agir",
  "anoPublicacao": 1943,
  "generos": ["Infantil", "Fantasia"],
  "idioma": "Português",
  "condicao": "bom",
  "tipo": "doacao",
  
  "localizacao": "São Paulo - SP"
}
```

Use esse documento como base de referência para testar todas as rotas do backend no Postman.
