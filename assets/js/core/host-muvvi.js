// Host do MUVVI: a mesma mecânica do Gehrarte (login Google + users.json, Publicador, Drive, páginas do site,
// perfis da equipe) com a identidade do museu. Existe porque, sem ele, o ArtAtk instalado no MUVVI caía no
// fallback do Gehrarte (core/host.js) e se apresentava como "Gehrarte" depois do login — a marca aparece na tela
// de arquivos, nos títulos de aba e nas telas de publicar e do Drive.
// Ativa-se com "host": "muvvi" no config.json do site; o nome vem de config.json › marca.nome.
import { criarHostGehrarte } from './host-gehrarte.js';

export function criarHostMuvvi(cfg = {}) {
  return {
    ...criarHostGehrarte(cfg),
    id: 'muvvi',
    marca: { nome: cfg.marca?.nome || 'MUVVI', editor: 'ArtAtk' },
  };
}
