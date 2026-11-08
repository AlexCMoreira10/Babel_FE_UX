function extrairLivros(resposta) {
  if (Array.isArray(resposta)) return resposta;
  if (Array.isArray(resposta?.livros)) return resposta.livros;
  if (Array.isArray(resposta?.dados)) return resposta.dados;
  if (Array.isArray(resposta?.data)) return resposta.data;
  return [];
}

function totalPaginas(resposta) {
  const total = Number(
    resposta?.totalPaginas ??
    resposta?.totalPages ??
    resposta?.paginacao?.totalPaginas ??
    resposta?.pagination?.totalPages
  );
  return Number.isInteger(total) && total >= 0 ? total : null;
}

function normalizarGenero(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

function livroTemGenero(livro, genero) {
  const generos = [
    ...(Array.isArray(livro?.generos) ? livro.generos : []),
    ...(livro?.genero ? [livro.genero] : [])
  ];
  const alvo = normalizarGenero(genero);
  return generos.some(item => normalizarGenero(item) === alvo);
}

async function percorrerCatalogo(listarPagina, processarPagina, { pageSize }) {
  let page = 1;
  let pages = null;
  while (pages === null || page <= pages) {
    const resposta = await listarPagina(page, pageSize);
    const livros = extrairLivros(resposta);
    pages = totalPaginas(resposta) ?? (livros.length < pageSize ? page : null);
    const resultado = processarPagina(livros);
    if (resultado !== undefined) return resultado;
    if (livros.length === 0) break;
    page += 1;
  }
  return undefined;
}

export async function buscarLivroNoCatalogo(id, listarPagina, { pageSize = 100 } = {}) {
  const idBuscado = String(id || '');
  if (!idBuscado) return null;
  const livro = await percorrerCatalogo(listarPagina, livros =>
    livros.find(item => String(item?.id || item?._id || '') === idBuscado), { pageSize });
  return livro || null;
}

export async function buscarRecomendacoesPorGenero(
  genero,
  livroAtualId,
  listarPagina,
  { pageSize = 100, maxResults = 6 } = {}
) {
  if (!genero) return [];
  const recomendacoes = [];
  const idAtual = String(livroAtualId || '');
  await percorrerCatalogo(listarPagina, livros => {
    for (const livro of livros) {
      const idLivro = String(livro?.id || livro?._id || '');
      if (idLivro !== idAtual && livroTemGenero(livro, genero)) {
        recomendacoes.push(livro);
        if (recomendacoes.length >= maxResults) return recomendacoes;
      }
    }
    return undefined;
  }, { pageSize });
  return recomendacoes;
}

export async function carregarDetalheComFallback({
  token,
  carregarAutenticado,
  carregarPublico,
  carregarBackup
}) {
  let erroAutenticado;
  if (token) {
    try {
      const livro = await carregarAutenticado();
      if (livro) return livro;
    } catch (erro) {
      erroAutenticado = erro;
    }
  }

  let erroPublico;
  try {
    const livro = await carregarPublico();
    if (livro) return livro;
  } catch (erro) {
    erroPublico = erro;
  }

  const backup = carregarBackup();
  if (backup) return backup;
  throw erroPublico || erroAutenticado || new Error('Livro não encontrado no catálogo público.');
}
