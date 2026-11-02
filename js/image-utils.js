const FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#eef6f5"/><path d="M108 112h78c24 0 42 17 42 40v134c0-23-18-40-42-40h-78zM292 112h-78c-24 0-42 17-42 40v134c0-23 18-40 42-40h78z" fill="none" stroke="#5f6f7d" stroke-width="12" stroke-linejoin="round"/><text x="200" y="338" text-anchor="middle" fill="#5f6f7d" font-family="sans-serif" font-size="22">Imagem indisponível</text></svg>';

export const IMAGEM_FALLBACK_URL = `data:image/svg+xml,${encodeURIComponent(FALLBACK_SVG)}`;

export function normalizarUrlImagem(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return '';
  const urlOriginal = valor.trim();
  if (/\s/.test(urlOriginal)) return '';
  const temProtocolo = /^[a-z][a-z\d+.-]*:/i.test(urlOriginal) || urlOriginal.startsWith('//');

  try {
    const url = new URL(urlOriginal, document.baseURI);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    if (!temProtocolo && url.protocol === 'file:') return url.href;
  } catch {
    return '';
  }

  return '';
}

export function resolverUrlImagem(valor) {
  return normalizarUrlImagem(valor) || IMAGEM_FALLBACK_URL;
}

export function validarListaUrlsImagem(valor) {
  const urls = String(valor ?? '').split(',').map(url => url.trim()).filter(Boolean);
  const invalidas = urls.filter(url => {
    if (/\s/.test(url)) return true;
    try {
      const parsed = new URL(url);
      return !['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return true;
    }
  });
  return { urls, invalidas };
}

document.addEventListener('error', evento => {
  const imagem = evento.target;
  if (!(imagem instanceof HTMLImageElement) || imagem.dataset.fallbackApplied) return;
  imagem.dataset.fallbackApplied = 'true';
  imagem.src = IMAGEM_FALLBACK_URL;
  imagem.alt = 'Imagem indisponível';
}, true);
