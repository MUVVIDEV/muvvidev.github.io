// Camada de dados do protótipo: carrega `dados/pontos.json`, normaliza, guarda rascunho no
// navegador e devolve o JSON pronto para ser commitado.
//
// Por que assim: no modelo do Gehrarte não há banco nem servidor — o conteúdo publicado é um
// arquivo JSON versionado no repositório. Quem edita trabalha sobre um rascunho local e, no fim,
// baixa o arquivo e abre um Pull Request. Nada é enviado para fora do navegador.

import { lerTags, limparTag, chaveDaTag } from './tags.js';

const ARQUIVO = 'dados/pontos.json';
const CHAVE_RASCUNHO = 'muvvi.mapa.rascunho.v1';
const CHAVE_REGISTRO = 'muvvi.mapa.registro.v1';

export const VERSAO_ARQUIVO = 1;

// ---------- identidade ----------

// Slug legível a partir do título: é o `id` do ponto e também o nome que aparece na URL.
export function paraSlug(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'ponto';
}

// Garante que o slug não colida com um já existente (acrescenta -2, -3, ...).
export function slugLivre(base, usados) {
  const raiz = paraSlug(base);
  if (!usados.has(raiz)) return raiz;
  let n = 2;
  while (usados.has(`${raiz}-${n}`)) n += 1;
  return `${raiz}-${n}`;
}

// ---------- normalização e validação ----------

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

// Coordenada com 6 casas decimais ≈ 11 cm no terreno: mais do que qualquer acervo precisa, e evita
// que um clique do mouse grave 15 dígitos de ruído no arquivo.
const coord = (v) => { const n = num(v); return Number.isFinite(n) ? Number(n.toFixed(6)) : null; };

// As tags de um ponto. Aceita lista pronta ou texto digitado, e converte o campo `eixo` dos
// arquivos antigos numa tag comum — assim nada do que já foi cadastrado se perde.
function normalizarTags(bruto) {
  const cru = Array.isArray(bruto?.tags) ? bruto.tags : typeof bruto?.tags === 'string' ? lerTags(bruto.tags) : [];
  const vistas = new Set();
  const saida = [];
  for (const t of [...cru, ...(bruto?.eixo ? [bruto.eixo] : [])]) {
    const tag = limparTag(t);
    const chave = chaveDaTag(tag);
    if (!tag || vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(tag);
  }
  return saida;
}

// Um ponto pode ter várias mídias. Aceita também o formato antigo de uma `midia` só, para os
// arquivos já escritos continuarem abrindo.
//   url     → endereço na internet
//   arquivo → caminho relativo dentro da pasta salva (ex.: "midia/foto.jpg"), vindo de um upload
function normalizarMidias(bruto) {
  const lista = Array.isArray(bruto?.midias) ? bruto.midias
    : bruto?.midia && bruto.midia.tipo && bruto.midia.tipo !== 'nenhuma' ? [bruto.midia]
    : [];
  return lista
    .map((m) => ({
      tipo: String(m?.tipo ?? 'imagem').trim() || 'imagem',
      url: String(m?.url ?? '').trim(),
      arquivo: String(m?.arquivo ?? '').trim(),
      credito: String(m?.credito ?? '').trim(),
    }))
    .filter((m) => m.url || m.arquivo);
}

// Aceita um objeto vindo do JSON (ou do formulário) e devolve um ponto com a forma esperada.
// Campos desconhecidos são descartados de propósito: o arquivo publicado tem que ser previsível.
export function normalizarPonto(bruto, usados = new Set()) {
  const lat = coord(bruto?.lat);
  const lng = coord(bruto?.lng);
  const titulo = String(bruto?.titulo ?? '').trim();
  const id = bruto?.id ? paraSlug(bruto.id) : slugLivre(titulo, usados);

  return {
    id,
    titulo,
    tags: normalizarTags(bruto),
    lat, lng,
    municipio: String(bruto?.municipio ?? '').trim(),
    ano: Number.isFinite(num(bruto?.ano)) ? Math.trunc(num(bruto.ano)) : null,
    ladoDoRio: ['antes', 'depois'].includes(bruto?.ladoDoRio) ? bruto.ladoDoRio : '',
    resumo: String(bruto?.resumo ?? '').trim(),
    midias: normalizarMidias(bruto),
    fonte: String(bruto?.fonte ?? '').trim(),
    // Marca de curadoria: o conteúdo de exemplo entra como `false` e só vira `true` quando
    // alguém da equipe confere a informação e a coordenada.
    revisado: bruto?.revisado === true,
  };
}

// Erros que impedem o ponto de ir para o arquivo. Devolve uma lista de mensagens (vazia = ok).
export function validarPonto(ponto) {
  const erros = [];
  if (!ponto.titulo) erros.push('O título é obrigatório.');
  if (!Number.isFinite(ponto.lat) || ponto.lat < -90 || ponto.lat > 90) erros.push('Latitude deve ser um número entre -90 e 90.');
  if (!Number.isFinite(ponto.lng) || ponto.lng < -180 || ponto.lng > 180) erros.push('Longitude deve ser um número entre -180 e 180.');
  if (ponto.midias?.some((m) => !m.url && !m.arquivo)) erros.push('Toda mídia precisa de um endereço (URL) ou de um arquivo anexado.');
  if (ponto.ano !== null && (ponto.ano < 1000 || ponto.ano > 2300)) erros.push('O ano parece fora de faixa.');
  return erros;
}

// ---------- carregar e salvar ----------

// Lê o arquivo publicado. Em caso de falha devolve uma coleção vazia e a mensagem do erro,
// para a interface poder cair na lista e avisar — nunca uma tela branca.
export async function carregarPublicado() {
  try {
    const resposta = await fetch(ARQUIVO, { cache: 'no-cache' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const json = await resposta.json();
    return { ...paraColecao(json), erro: null };
  } catch (e) {
    return { versao: VERSAO_ARQUIVO, atualizadoEm: null, pontos: [], erro: e.message || String(e) };
  }
}

// Aceita tanto `{ versao, pontos: [...] }` quanto um array solto de pontos.
export function paraColecao(json) {
  const lista = Array.isArray(json) ? json : Array.isArray(json?.pontos) ? json.pontos : [];
  const usados = new Set();
  const pontos = [];
  for (const bruto of lista) {
    const p = normalizarPonto(bruto, usados);
    usados.add(p.id);
    pontos.push(p);
  }
  return { versao: Number(json?.versao) || VERSAO_ARQUIVO, atualizadoEm: json?.atualizadoEm ?? null, registro: json?.registro ?? null, pontos };
}

// O rascunho local: o que a pessoa está editando antes de publicar.
export function lerRascunho() {
  try {
    const cru = localStorage.getItem(CHAVE_RASCUNHO);
    return cru ? paraColecao(JSON.parse(cru)) : null;
  } catch { return null; }
}

export function salvarRascunho(colecao) {
  try {
    localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(paraArquivo(colecao)));
    return true;
  } catch { return false; }   // modo privado, cota cheia: não é motivo para travar a edição
}

export function apagarRascunho() {
  try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* ignora */ }
}

// ---------- registro (quem cadastrou) ----------

// O registro acompanha o arquivo salvo: vai nos metadados e no nome do arquivo. Só o nome do autor
// é obrigatório; o resto são campos que a própria pessoa inventa.
export function normalizarRegistro(bruto) {
  const campos = Array.isArray(bruto?.campos) ? bruto.campos : [];
  return {
    autor: String(bruto?.autor ?? '').trim(),
    email: String(bruto?.email ?? '').trim(),
    campos: campos
      .map((c) => ({ rotulo: String(c?.rotulo ?? '').trim(), valor: String(c?.valor ?? '').trim() }))
      .filter((c) => c.rotulo || c.valor),
    salvoEm: bruto?.salvoEm ?? null,
  };
}

export function lerRegistro() {
  try {
    const cru = localStorage.getItem(CHAVE_REGISTRO);
    return cru ? normalizarRegistro(JSON.parse(cru)) : normalizarRegistro({});
  } catch { return normalizarRegistro({}); }
}

export function salvarRegistro(registro) {
  try { localStorage.setItem(CHAVE_REGISTRO, JSON.stringify(normalizarRegistro(registro))); } catch { /* ignora */ }
}

// Nome do arquivo e da pasta: "mapa-interativo-<autor>-<data>".
export function nomeBase(registro) {
  const autor = paraSlug(registro?.autor || 'sem-autor');
  const dia = (registro?.salvoEm ?? new Date().toISOString()).slice(0, 10);
  return `mapa-interativo-${autor}-${dia}`;
}

// ---------- saída ----------

// O JSON exatamente como vai para `dados/pontos.json`: ordenado por título, para o
// `git diff` de cada publicação mostrar só o que mudou de verdade.
export function paraArquivo(colecao, registro = null) {
  const pontos = [...colecao.pontos]
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { sensitivity: 'base' }))
    .map((p) => {
      const saida = {
        id: p.id, titulo: p.titulo,
        tags: p.tags?.length ? p.tags : undefined,
        lat: p.lat, lng: p.lng,
        municipio: p.municipio || undefined,
        ano: p.ano ?? undefined,
        ladoDoRio: p.ladoDoRio || undefined,
        resumo: p.resumo || undefined,
        midias: p.midias?.length
          ? p.midias.map((m) => ({ tipo: m.tipo, url: m.url || undefined, arquivo: m.arquivo || undefined, credito: m.credito || undefined }))
          : undefined,
        fonte: p.fonte || undefined,
        revisado: p.revisado || undefined,
      };
      // JSON.stringify já come as chaves `undefined`; isso mantém o arquivo enxuto.
      return saida;
    });
  const saida = { versao: VERSAO_ARQUIVO, atualizadoEm: new Date().toISOString().slice(0, 10) };
  if (registro?.autor) {
    saida.registro = {
      autor: registro.autor,
      email: registro.email || undefined,
      salvoEm: registro.salvoEm ?? new Date().toISOString(),
      ...Object.fromEntries(registro.campos.filter((c) => c.rotulo).map((c) => [c.rotulo, c.valor])),
    };
  }
  saida.pontos = pontos;
  return saida;
}

export function paraTexto(colecao, registro = null) {
  return JSON.stringify(paraArquivo(colecao, registro), null, 2) + '\n';
}
