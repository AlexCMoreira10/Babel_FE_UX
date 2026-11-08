const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const catalogoPromise = import('../js/detalhes-catalogo.mjs');

test('details page uses the existing public paginated catalog, not the missing genre route', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/detalhes.js'), 'utf8');
  const publicList = source.match(/async function listarPaginaPublica[\s\S]*?\n}/)?.[0] || '';
  assert.match(publicList, /\/livros/);
  assert.match(publicList, /searchParams\.set\('page'/);
  assert.match(publicList, /searchParams\.set\('limit'/);
  assert.doesNotMatch(publicList, /Authorization/);
  assert.doesNotMatch(source, /\/livros\/busca\/genero/);
});

test('public detail lookup follows catalog pagination', async () => {
  const { buscarLivroNoCatalogo } = await catalogoPromise;
  const pages = [];
  const result = await buscarLivroNoCatalogo('book-3', async (page, limit) => {
    pages.push({ page, limit });
    return {
      totalPaginas: 2,
      dados: page === 1
        ? [{ id: 'book-1' }, { id: 'book-2' }]
        : [{ id: 'book-3', titulo: 'Livro público' }]
    };
  }, { pageSize: 2 });

  assert.equal(result.titulo, 'Livro público');
  assert.deepEqual(pages, [{ page: 1, limit: 2 }, { page: 2, limit: 2 }]);
});

test('genre recommendations filter locally, omit current book and honor result limit', async () => {
  const { buscarRecomendacoesPorGenero } = await catalogoPromise;
  const pages = [];
  const result = await buscarRecomendacoesPorGenero('Ficção', 'current', async (page, limit) => {
    pages.push(page);
    return {
      totalPaginas: 2,
      dados: page === 1
        ? [
            { id: 'current', generos: ['Ficção'] },
            { id: 'other-1', generos: ['ficcao'] }
          ]
        : [
            { id: 'other-2', genero: 'FICÇÃO' },
            { id: 'other-3', generos: ['Romance'] }
          ]
    };
  }, { pageSize: 2, maxResults: 2 });

  assert.deepEqual(result.map(book => book.id), ['other-1', 'other-2']);
  assert.deepEqual(pages, [1, 2]);
});

test('genre recommendations stop once enough matches are found', async () => {
  const { buscarRecomendacoesPorGenero } = await catalogoPromise;
  const pages = [];
  const result = await buscarRecomendacoesPorGenero('Fantasia', 'current', async page => {
    pages.push(page);
    return {
      totalPaginas: 5,
      dados: [
        { id: 'current', genero: 'Fantasia' },
        { id: 'one', genero: 'Fantasia' },
        { id: 'two', genero: 'Fantasia' }
      ]
    };
  }, { pageSize: 3, maxResults: 2 });

  assert.deepEqual(result.map(book => book.id), ['one', 'two']);
  assert.deepEqual(pages, [1]);
});

test('public API failures are surfaced to recommendation and detail callers', async () => {
  const { buscarRecomendacoesPorGenero, carregarDetalheComFallback } = await catalogoPromise;
  const apiError = new Error('HTTP 503');
  await assert.rejects(
    buscarRecomendacoesPorGenero('Romance', 'current', async () => {
      throw apiError;
    }, { pageSize: 10 }),
    error => error === apiError
  );
  await assert.rejects(
    carregarDetalheComFallback({
      token: null,
      carregarAutenticado: async () => assert.fail('visitor must not call protected endpoint'),
      carregarPublico: async () => { throw apiError; },
      carregarBackup: () => null
    }),
    error => error === apiError
  );
});

test('visitors use public catalog; authenticated detail requests fall back to public catalog', async () => {
  const { carregarDetalheComFallback } = await catalogoPromise;
  let protectedRequests = 0;
  const visitorBook = await carregarDetalheComFallback({
    token: null,
    carregarAutenticado: async () => { protectedRequests++; },
    carregarPublico: async () => ({ id: 'public-book' }),
    carregarBackup: () => null
  });
  assert.equal(visitorBook.id, 'public-book');
  assert.equal(protectedRequests, 0);

  const authenticatedBook = await carregarDetalheComFallback({
    token: 'valid-session',
    carregarAutenticado: async () => { throw new Error('HTTP 401'); },
    carregarPublico: async () => ({ id: 'public-book' }),
    carregarBackup: () => null
  });
  assert.equal(authenticatedBook.id, 'public-book');
});

test('matching session backup is used only when both API paths fail', async () => {
  const { carregarDetalheComFallback } = await catalogoPromise;
  const backup = { id: 'saved-book' };
  const result = await carregarDetalheComFallback({
    token: null,
    carregarAutenticado: async () => assert.fail('visitor must not call protected endpoint'),
    carregarPublico: async () => null,
    carregarBackup: () => backup
  });
  assert.equal(result, backup);
});
