export function configurarSelecaoImagens({
  inputGaleria, inputCamera, botaoCamera, feedback, preview,
  obterTotalExistente, textoContador, validarArquivos
}) {
  let capturadas = [];
  const urlsPreview = new Map();

  function arquivosSelecionados() {
    return [...Array.from(inputGaleria.files || []), ...capturadas];
  }

  function atualizarPreview() {
    preview.replaceChildren();
    const arquivosGaleria = Array.from(inputGaleria.files || []);
    const arquivos = [...arquivosGaleria, ...capturadas];
    for (const [arquivo, url] of urlsPreview) {
      if (!arquivos.includes(arquivo)) {
        URL.revokeObjectURL(url);
        urlsPreview.delete(arquivo);
      }
    }
    const contador = document.createElement('span');
    contador.className = 'small-text';
    contador.textContent = textoContador(obterTotalExistente() + arquivosGaleria.length + capturadas.length);
    preview.append(contador);

    arquivos.forEach((arquivo, indice) => {
      const item = document.createElement('div');
      item.className = 'imagem-selecionada';
      const imagem = document.createElement('img');
      let url = urlsPreview.get(arquivo);
      if (!url) {
        url = URL.createObjectURL(arquivo);
        urlsPreview.set(arquivo, url);
      }
      imagem.src = url;
      imagem.alt = `Pré-visualização: ${arquivo.name}`;
      const nome = document.createElement('span');
      nome.textContent = arquivo.name;
      item.append(imagem, nome);
      if (indice >= arquivosGaleria.length) {
        const indiceCaptura = indice - arquivosGaleria.length;
        const remover = document.createElement('button');
        remover.type = 'button';
        remover.className = 'btn-secondary';
        remover.textContent = 'Remover foto';
        remover.setAttribute('aria-label', `Remover foto ${arquivo.name}`);
        remover.addEventListener('click', () => {
          capturadas.splice(indiceCaptura, 1);
          feedback.textContent = 'Foto removida.';
          atualizarPreview();
        });
        item.append(remover);
      }
      preview.append(item);
    });
  }

  botaoCamera.addEventListener('click', () => {
    feedback.textContent = 'Abra a câmera e confirme a foto. Se ela não abrir, verifique a permissão de câmera do dispositivo.';
    inputCamera.click();
  });
  inputCamera.addEventListener('cancel', () => {
    feedback.textContent = 'Nenhuma foto foi adicionada. Se necessário, confira a permissão de câmera e tente novamente.';
  });
  inputCamera.addEventListener('change', () => {
    const novas = Array.from(inputCamera.files || []);
    inputCamera.value = '';
    if (!novas.length) {
      feedback.textContent = 'Nenhuma foto foi adicionada. Se necessário, confira a permissão de câmera e tente novamente.';
      return;
    }
    try {
      validarArquivos([...arquivosSelecionados(), ...novas], obterTotalExistente());
      capturadas.push(...novas);
      feedback.textContent = 'Foto adicionada à pré-visualização.';
      atualizarPreview();
    } catch (erro) {
      feedback.textContent = erro.message;
    }
  });
  inputGaleria.addEventListener('change', atualizarPreview);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    urlsPreview.forEach(url => URL.revokeObjectURL(url));
    urlsPreview.clear();
  });

  return { arquivosSelecionados, atualizarPreview };
}
