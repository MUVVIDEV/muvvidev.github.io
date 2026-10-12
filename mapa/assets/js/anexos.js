// Os arquivos que a pessoa arrasta para a ficha (foto, vídeo, áudio, modelo 3D).
//
// Ficam na memória desta aba até o momento de salvar, quando são gravados na pasta escolhida.
// Não vão para o localStorage de propósito: um vídeo estoura a cota e derrubaria o rascunho inteiro.
// Quem anexa é avisado disso na própria ficha.

import { paraSlug } from './dados.js';

export const PASTA = 'midia';

const arquivos = new Map();   // caminho relativo ("midia/foto.jpg") -> File
const previas = new Map();    // caminho -> objectURL, criado sob demanda

// Tipo da nossa lista a partir do que o sistema diz do arquivo.
export function tipoDoArquivo(file) {
  const mime = file.type || '';
  if (mime.startsWith('image/')) return 'imagem';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (/\.(glb|gltf)$/i.test(file.name)) return 'modelo3d';
  return 'imagem';
}

// "Foto da Ponte (1).JPG" -> "foto-da-ponte-1.jpg". Mantém a extensão e evita colisão.
function caminhoLivre(nomeOriginal) {
  const ponto = nomeOriginal.lastIndexOf('.');
  const ext = ponto > 0 ? nomeOriginal.slice(ponto + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
  const base = paraSlug(ponto > 0 ? nomeOriginal.slice(0, ponto) : nomeOriginal) || 'arquivo';
  let tentativa = `${PASTA}/${base}.${ext}`;
  let n = 2;
  while (arquivos.has(tentativa)) tentativa = `${PASTA}/${base}-${n++}.${ext}`;
  return tentativa;
}

export function adicionar(file) {
  const caminho = caminhoLivre(file.name || 'arquivo');
  arquivos.set(caminho, file);
  return { caminho, tipo: tipoDoArquivo(file), bytes: file.size };
}

export function remover(caminho) {
  arquivos.delete(caminho);
  const url = previas.get(caminho);
  if (url) { URL.revokeObjectURL(url); previas.delete(caminho); }
}

export const tem = (caminho) => arquivos.has(caminho);
export const obter = (caminho) => arquivos.get(caminho) ?? null;
export const todos = () => [...arquivos.entries()].map(([caminho, file]) => ({ caminho, file }));
export const quantos = () => arquivos.size;

export function previa(caminho) {
  if (previas.has(caminho)) return previas.get(caminho);
  const file = arquivos.get(caminho);
  if (!file) return null;
  const url = URL.createObjectURL(file);
  previas.set(caminho, url);
  return url;
}

// Descarta o que não é mais apontado por nenhum ponto — chamado depois de excluir ou editar.
export function recolherLixo(pontos) {
  const usados = new Set();
  for (const p of pontos) for (const m of p.midias ?? []) if (m.arquivo) usados.add(m.arquivo);
  for (const caminho of [...arquivos.keys()]) if (!usados.has(caminho)) remover(caminho);
}

export function legivel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
