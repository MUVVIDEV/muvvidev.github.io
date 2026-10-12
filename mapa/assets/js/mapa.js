// Mapa do Vale — módulo principal. Guarda o estado (os pontos e o filtro) e mantém mapa e lista
// mostrando sempre a mesma coisa.
//
// O Leaflet vem da tag <script> do index.html (global `L`), servido de vendor/leaflet — sem CDN,
// para funcionar também sem internet e em cada uma das réplicas do acervo.

import { faceDe, catalogo, corDaTag, chaveDaTag } from './tags.js';
import * as dados from './dados.js';
import * as anexos from './anexos.js';
import { criarFicha } from './ficha.js';
import { criarSalvar } from './salvar.js';
import { criarHidrografia } from './hidrografia.js';

const $ = (sel) => document.querySelector(sel);

const LIMITES = L.latLngBounds([-25.70, -54.40], [-22.60, -50.20]);

// ---------- estado ----------

let colecao = { versao: dados.VERSAO_ARQUIVO, atualizadoEm: null, pontos: [] };
let temRascunho = false;
// Nenhuma tag marcada = mostra tudo. Marcar uma ou mais = só os pontos que têm alguma delas.
const filtro = { tags: new Set(), busca: '' };
const CHAVE_FIXADAS = 'muvvi.mapa.tagsFixadas.v1';
let fixadas = new Set(lerFixadas());
let quantasTagsMostradas = 0;
const LOTE_DE_TAGS = 40;

function lerFixadas() {
  try { return JSON.parse(localStorage.getItem(CHAVE_FIXADAS)) ?? []; } catch { return []; }
}
function gravarFixadas() {
  try { localStorage.setItem(CHAVE_FIXADAS, JSON.stringify([...fixadas])); } catch { /* ignora */ }
}
let selecionado = null;
let marcando = false;        // a pessoa está escolhendo o lugar no mapa
const marcadores = new Map();
let marcadorNovo = null;     // marcador arrastável do ponto em edição

// ---------- recado ----------

let timerRecado;
function recado(texto) {
  const el = $('#recado');
  el.textContent = texto;
  el.classList.add('vendo');
  clearTimeout(timerRecado);
  timerRecado = setTimeout(() => el.classList.remove('vendo'), 5000);
}

// ---------- mapa ----------

const mapa = L.map('mapa', {
  center: [-24.05, -52.05], zoom: 8, minZoom: 7, maxZoom: 18,
  maxBounds: LIMITES.pad(0.25), maxBoundsViscosity: 0.8,
  scrollWheelZoom: true, worldCopyJump: false,
});

const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; colaboradores do OpenStreetMap', maxZoom: 18, noWrap: true,
});
let avisouFalha = false;
base.on('tileerror', () => {
  if (avisouFalha) return;
  avisouFalha = true;
  const aviso = $('#falhou-mapa');
  aviso.textContent = 'As imagens do mapa não carregaram (pode ser falta de internet). Os pontos continuam na lista ao lado, e o mapa volta sozinho quando a conexão voltar.';
  aviso.hidden = false;
});
base.addTo(mapa);

const hidrografia = criarHidrografia({ mapa, recado });

const camadaPontos = L.layerGroup().addTo(mapa);

function iconeDe(face, { rascunho = false } = {}) {
  return L.divIcon({
    className: '',
    html: `<div class="marcador${rascunho ? ' rascunho' : ''}" style="background:${face.cor}"><span aria-hidden="true">${face.glifo}</span></div>`,
    iconSize: [26, 26], iconAnchor: [13, 25], popupAnchor: [0, -24],
  });
}

// ---------- filtro ----------

function visiveis() {
  const q = filtro.busca.trim().toLowerCase();
  return colecao.pontos.filter((p) => {
    if (filtro.tags.size) {
      const minhas = (p.tags ?? []).map(chaveDaTag);
      if (!minhas.some((t) => filtro.tags.has(t))) return false;
    }
    if (!q) return true;
    return [p.titulo, p.municipio, p.resumo, p.fonte, String(p.ano ?? ''), ...(p.tags ?? [])]
      .join(' ').toLowerCase().includes(q);
  });
}

// ---------- desenho ----------

function conteudoPopup(p) {
  const meta = [p.municipio, p.ano,
    p.ladoDoRio === 'antes' ? 'Antes da ponte' : p.ladoDoRio === 'depois' ? 'Depois da ponte' : null]
    .filter(Boolean).join(' · ');

  const caixa = document.createElement('div');
  const h = document.createElement('h3'); h.textContent = p.titulo; caixa.append(h);
  if (meta) { const m = document.createElement('p'); m.className = 'pop-meta'; m.textContent = meta; caixa.append(m); }

  if (p.tags?.length) {
    const linha = document.createElement('p');
    linha.className = 'pop-tags';
    for (const tag of p.tags) {
      const et = document.createElement('span');
      et.className = 'etiqueta';
      et.style.background = corDaTag(tag);
      et.textContent = tag;
      linha.append(et);
    }
    caixa.append(linha);
  }

  for (const midia of p.midias ?? []) {
    const fonte = midia.arquivo ? anexos.previa(midia.arquivo) : midia.url;
    if (!fonte) continue;
    if (midia.tipo === 'imagem') {
      const img = document.createElement('img');
      img.className = 'pop-midia'; img.src = fonte; img.alt = midia.credito || p.titulo;
      img.loading = 'lazy'; img.decoding = 'async';
      caixa.append(img);
    } else if (midia.tipo === 'audio') {
      const au = document.createElement('audio');
      au.controls = true; au.src = fonte; au.className = 'pop-midia';
      caixa.append(au);
    } else if (midia.url) {
      const a = document.createElement('a');
      a.href = midia.url; a.rel = 'noopener'; a.target = '_blank';
      a.textContent = 'Abrir mídia →';
      const linha = document.createElement('p'); linha.className = 'pop-resumo'; linha.append(a);
      caixa.append(linha);
    } else {
      const s = document.createElement('p'); s.className = 'pop-fonte';
      s.textContent = `Arquivo anexado: ${midia.arquivo.replace(/^.*\//, '')}`;
      caixa.append(s);
    }
  }

  if (p.resumo) { const r = document.createElement('p'); r.className = 'pop-resumo'; r.textContent = p.resumo; caixa.append(r); }

  const acoes = document.createElement('div'); acoes.className = 'pop-acoes';
  const editar = document.createElement('button');
  editar.type = 'button'; editar.className = 'b b-mini'; editar.textContent = 'Editar';
  editar.addEventListener('click', () => editarPonto(p.id));
  acoes.append(editar);
  caixa.append(acoes);

  const rodape = [];
  if (p.fonte) rodape.push(`Fonte: ${p.fonte}`);
  rodape.push(`Coordenada: ${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}`);
  if (!p.revisado) rodape.push('Ainda não conferido.');
  const f = document.createElement('p'); f.className = 'pop-fonte'; f.textContent = rodape.join(' · ');
  caixa.append(f);

  return caixa;
}

function desenharMapa(lista) {
  camadaPontos.clearLayers();
  marcadores.clear();
  for (const p of lista) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const mk = L.marker([p.lat, p.lng], { icon: iconeDe(faceDe(p)), title: p.titulo, alt: p.titulo, keyboard: true });
    mk.bindPopup(() => conteudoPopup(p), { minWidth: 220, maxWidth: 300 });
    mk.on('click', () => destacar(p.id, { centralizar: false }));
    mk.addTo(camadaPontos);
    marcadores.set(p.id, mk);
  }
}

function desenharLista(lista) {
  const ul = $('#lista');
  ul.innerHTML = '';
  for (const p of lista) {
    const face = faceDe(p);
    const li = document.createElement('li');
    li.className = 'item' + (p.id === selecionado ? ' ativo' : '');
    li.dataset.id = p.id;

    const abrir = document.createElement('button');
    abrir.type = 'button'; abrir.className = 'item-abrir';
    abrir.innerHTML = `<span class="pin" style="background:${face.cor}" aria-hidden="true">${face.glifo}</span>`;
    const texto = document.createElement('span');
    texto.className = 'item-texto' + (p.revisado ? '' : ' nao-revisado');
    const t = document.createElement('span'); t.className = 'item-titulo'; t.textContent = p.titulo;
    const m = document.createElement('span'); m.className = 'item-meta';
    const nMidias = (p.midias ?? []).length;
    m.textContent = [(p.tags ?? []).join(', '), p.municipio, p.ano].filter(Boolean).join(' · ')
      + (nMidias ? ` · ${nMidias} mídia${nMidias > 1 ? 's' : ''}` : '')
      + (p.revisado ? '' : ' · a conferir');
    texto.append(t, m);
    abrir.append(texto);
    abrir.addEventListener('click', () => destacar(p.id, { centralizar: true, abrirPopup: true }));

    const editar = document.createElement('button');
    editar.type = 'button'; editar.className = 'item-editar';
    editar.setAttribute('aria-label', `Editar ${p.titulo}`);
    editar.textContent = '✎';
    editar.addEventListener('click', () => editarPonto(p.id));

    li.append(abrir, editar);
    ul.append(li);
  }
  const vazio = $('#lista-vazia');
  vazio.hidden = lista.length > 0;
  vazio.textContent = colecao.pontos.length === 0
    ? 'Nenhum ponto cadastrado ainda. Comece em "Adicionar ponto".'
    : 'Nenhum ponto com esse filtro.';
  const total = colecao.pontos.length;
  $('#contagem').textContent = lista.length === total ? `(${total})` : `(${lista.length} de ${total})`;
}

// Só o mapa e a lista. Usado quando o catálogo de tags não mudou — redesenhar os chips a cada
// clique no filtro tiraria o foco do teclado de cima do checkbox que a pessoa acabou de marcar.
function redesenharConteudo() {
  const lista = visiveis();
  desenharMapa(lista);
  desenharLista(lista);
}

// Tudo, inclusive a barra de tags. A barra vem primeiro para o filtro já estar coerente com o
// catálogo quando a lista for calculada.
function redesenhar() {
  desenharTags();
  redesenharConteudo();
}

function destacar(id, { centralizar = false, abrirPopup = false } = {}) {
  selecionado = id;
  for (const li of $('#lista').children) li.classList.toggle('ativo', li.dataset.id === id);
  const mk = marcadores.get(id);
  if (!mk) return;
  if (centralizar) mapa.setView(mk.getLatLng(), Math.max(mapa.getZoom(), 11), { animate: true });
  if (abrirPopup) mk.openPopup();
}

// ---------- marcar lugar no mapa ----------

function entrarEmMarcacao() {
  marcando = true;
  $('#marcando').hidden = false;
  mapa.getContainer().style.cursor = 'crosshair';
  mapa.getContainer().focus?.();
}

function sairDaMarcacao() {
  marcando = false;
  $('#marcando').hidden = true;
  mapa.getContainer().style.cursor = '';
}

$('#btn-cancelar-marcar').addEventListener('click', () => {
  sairDaMarcacao();
  ficha.reabrir();
});

// O clique no mapa só marca lugar quando a ficha pediu — fora disso, o mapa é só de leitura.
mapa.on('click', (ev) => {
  if (!marcando) return;
  const { lat, lng } = ev.latlng;
  sairDaMarcacao();
  porMarcadorNovo(lat, lng);
  ficha.definirCoordenada(lat, lng);
  ficha.reabrir();
  recado('Lugar marcado. Dá para arrastar o marcador depois, se precisar ajustar.');
});

function porMarcadorNovo(lat, lng) {
  limparMarcadorNovo();
  marcadorNovo = L.marker([lat, lng], {
    icon: iconeDe({ cor: '#1d6fa5', glifo: '+' }, { rascunho: true }),
    draggable: true, keyboard: true,
    title: 'Lugar deste ponto (arraste para ajustar)', alt: 'Lugar deste ponto',
  }).addTo(mapa);
  marcadorNovo.on('drag', (e) => ficha.definirCoordenada(e.latlng.lat, e.latlng.lng));
  mapa.panTo([lat, lng]);
}

function limparMarcadorNovo() {
  if (marcadorNovo) { mapa.removeLayer(marcadorNovo); marcadorNovo = null; }
}

// ---------- ficha ----------

const idsEmUso = () => new Set(colecao.pontos.map((p) => p.id));

const ficha = criarFicha({
  idsEmUso,
  aoPedirMarcacao: entrarEmMarcacao,
  aoGuardar: (ponto, { novo, idAnterior }) => {
    if (novo) colecao.pontos.push(ponto);
    else {
      const i = colecao.pontos.findIndex((p) => p.id === idAnterior);
      if (i >= 0) colecao.pontos[i] = ponto; else colecao.pontos.push(ponto);
    }
    limparMarcadorNovo();
    anexos.recolherLixo(colecao.pontos);
    guardar();
    redesenhar();
    destacar(ponto.id, { centralizar: true, abrirPopup: true });
    recado(novo ? `"${ponto.titulo}" foi adicionado.` : `"${ponto.titulo}" foi atualizado.`);
  },
  aoExcluir: (id) => {
    const p = colecao.pontos.find((x) => x.id === id);
    colecao.pontos = colecao.pontos.filter((x) => x.id !== id);
    if (selecionado === id) selecionado = null;
    limparMarcadorNovo();
    anexos.recolherLixo(colecao.pontos);
    guardar();
    redesenhar();
    recado(`"${p?.titulo ?? id}" foi excluído.`);
  },
  aoMudarCoordenada: (lat, lng) => {
    if (marcadorNovo) marcadorNovo.setLatLng([lat, lng]);
    else porMarcadorNovo(lat, lng);
  },
  aoFechar: () => { limparMarcadorNovo(); sairDaMarcacao(); },
});

function editarPonto(id) {
  const p = colecao.pontos.find((x) => x.id === id);
  if (!p) return;
  mapa.closePopup();
  limparMarcadorNovo();
  if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) porMarcadorNovo(p.lat, p.lng);
  ficha.abrir(p, { novo: false });
}

// Adicionar começa pela ficha; o lugar é escolhido de dentro dela.
$('#btn-adicionar').addEventListener('click', () => {
  limparMarcadorNovo();
  ficha.abrir(dados.normalizarPonto({}, idsEmUso()), { novo: true });
});

// ---------- salvar ----------

const salvar = criarSalvar({
  obterColecao: () => colecao,
  aoTerminar: (onde, quantos) => recado(`Salvo em "${onde}" — ${quantos} arquivo(s).`),
});
$('#btn-salvar').addEventListener('click', () => {
  if (!colecao.pontos.length) { recado('Ainda não há nada para salvar: adicione ao menos um ponto.'); return; }
  salvar.abrir();
});

// ---------- filtros ----------

const rolagemTags = $('#tags-rolagem');
const fimDasTags = $('#tags-fim');

// Ordem da barra: as fixadas primeiro, o resto em ordem alfabética. Dentro de cada grupo o
// catálogo já vem alfabético.
function tagsOrdenadas() {
  const todas = catalogo(colecao.pontos);
  const presas = todas.filter((t) => fixadas.has(t.chave));
  const soltas = todas.filter((t) => !fixadas.has(t.chave));
  return [...presas, ...soltas];
}

function chipDaTag(t) {
  const chip = document.createElement('span');
  chip.className = 'tag-chip' + (fixadas.has(t.chave) ? ' presa' : '') + (filtro.tags.has(t.chave) ? ' ligada' : '');
  chip.style.setProperty('--cor', t.cor);
  chip.dataset.chave = t.chave;

  const label = document.createElement('label');
  label.title = `${t.rotulo} — ${t.quantos} ponto${t.quantos > 1 ? 's' : ''}`;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = t.chave;
  input.checked = filtro.tags.has(t.chave);
  input.addEventListener('change', () => {
    if (input.checked) filtro.tags.add(t.chave); else filtro.tags.delete(t.chave);
    chip.classList.toggle('ligada', input.checked);
    redesenharConteudo();
  });
  const bolha = document.createElement('span');
  bolha.className = 'bolha'; bolha.setAttribute('aria-hidden', 'true');
  const nome = document.createElement('span'); nome.className = 'tag-nome'; nome.textContent = t.rotulo;
  const conta = document.createElement('span'); conta.className = 'tag-conta'; conta.textContent = t.quantos;
  label.append(input, bolha, nome, conta);

  const prender = document.createElement('button');
  prender.type = 'button';
  prender.className = 'tag-fixar';
  prender.setAttribute('aria-pressed', String(fixadas.has(t.chave)));
  prender.setAttribute('aria-label', `${fixadas.has(t.chave) ? 'Desafixar' : 'Fixar'} a tag ${t.rotulo}`);
  prender.title = fixadas.has(t.chave) ? 'Desafixar' : 'Fixar';
  prender.textContent = '📌';
  prender.addEventListener('click', () => {
    if (fixadas.has(t.chave)) fixadas.delete(t.chave); else fixadas.add(t.chave);
    gravarFixadas();
    desenharTags();
    rolagemTags.scrollLeft = 0;      // a fixada vai para a frente; mostra isso acontecendo
  });

  chip.append(label, prender);
  return chip;
}

// Desenha só o que já foi "alcançado" pela rolagem. O resto entra em lotes, conforme a pessoa
// rola — com muitas tags, montar todos os chips de uma vez trava a barra.
function desenharTags() {
  const todas = tagsOrdenadas();
  quantasTagsMostradas = Math.min(Math.max(quantasTagsMostradas, LOTE_DE_TAGS), todas.length);

  // Tag que sumiu do catálogo (o último ponto dela foi excluído) não pode continuar filtrando.
  const existentes = new Set(todas.map((t) => t.chave));
  let mudouFiltro = false;
  for (const chave of [...filtro.tags]) if (!existentes.has(chave)) { filtro.tags.delete(chave); mudouFiltro = true; }

  for (const velho of [...rolagemTags.querySelectorAll('.tag-chip')]) velho.remove();
  const pedaco = document.createDocumentFragment();
  for (const t of todas.slice(0, quantasTagsMostradas)) pedaco.append(chipDaTag(t));
  rolagemTags.insertBefore(pedaco, fimDasTags);

  $('#tags-vazio').hidden = todas.length > 0;
  rolagemTags.hidden = todas.length === 0;
  fimDasTags.dataset.restam = String(Math.max(0, todas.length - quantasTagsMostradas));

  ficha.sugerirTags(todas.map((t) => t.rotulo));
  return mudouFiltro;
}

// Rolagem infinita: quando o fim da barra aparece, carrega mais um lote.
//
// Depois de desenhar, o observador é religado de propósito. Um lote nem sempre empurra a sentinela
// para fora de vista (tags curtas, tela larga), e o IntersectionObserver não avisa de novo enquanto
// o estado não muda — sem religar, a barra travaria no primeiro lote.
const vigia = new IntersectionObserver((entradas) => {
  if (!entradas.some((e) => e.isIntersecting)) return;
  carregarMaisTags();
}, { root: rolagemTags, rootMargin: '200px' });

function carregarMaisTags() {
  const total = catalogo(colecao.pontos).length;
  if (quantasTagsMostradas >= total) return;
  quantasTagsMostradas += LOTE_DE_TAGS;
  desenharTags();
  vigia.unobserve(fimDasTags);
  vigia.observe(fimDasTags);
}

vigia.observe(fimDasTags);

// A rolagem suave é boa para o botão de fixar (a tag presa desliza até a frente), mas atrasaria o
// carregamento do próximo lote. Aqui o que vale é a posição de agora, não a da animação.
rolagemTags.addEventListener('scroll', () => {
  const faltaPouco = rolagemTags.scrollLeft + rolagemTags.clientWidth >= rolagemTags.scrollWidth - 200;
  if (faltaPouco) carregarMaisTags();
}, { passive: true });

// A barra é horizontal: rolar o mouse para baixo em cima dela anda para o lado.
rolagemTags.addEventListener('wheel', (ev) => {
  if (ev.deltaY === 0 || ev.shiftKey) return;
  const antes = rolagemTags.scrollLeft;
  rolagemTags.scrollLeft += ev.deltaY;
  if (rolagemTags.scrollLeft !== antes) ev.preventDefault();
}, { passive: false });

$('#form-busca').addEventListener('submit', (ev) => ev.preventDefault());
let timerBusca;
$('#q').addEventListener('input', (ev) => {
  clearTimeout(timerBusca);
  const v = ev.target.value;
  timerBusca = setTimeout(() => { filtro.busca = v; redesenharConteudo(); }, 140);
});

// ---------- gaveta de dados ----------

const painel = $('#painel-dados');
$('#btn-dados').addEventListener('click', () => {
  const abrindo = painel.hidden;
  painel.hidden = !abrindo;
  $('#btn-dados').setAttribute('aria-expanded', String(abrindo));
  if (abrindo) atualizarEstadoRascunho();
});

function atualizarEstadoRascunho() {
  const n = anexos.quantos();
  $('#estado-rascunho').textContent = temRascunho
    ? `Agora: ${colecao.pontos.length} ponto(s)${n ? ` e ${n} arquivo(s) de mídia` : ''}, guardados neste navegador.`
    : `Agora: ${colecao.pontos.length} ponto(s).`;
}

function guardar() {
  temRascunho = true;
  if (!dados.salvarRascunho(colecao)) recado('Não consegui guardar neste navegador — use Salvar para não perder o trabalho.');
  atualizarEstadoRascunho();
}

$('#btn-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(dados.paraTexto(colecao, dados.lerRegistro()));
    recado('JSON copiado.');
  } catch { recado('Este navegador não deixou copiar. Use Salvar.'); }
});

$('#arq-json').addEventListener('change', async (ev) => {
  const arq = ev.target.files?.[0];
  if (!arq) return;
  try {
    const lida = dados.paraColecao(JSON.parse(await arq.text()));
    if (!lida.pontos.length) { recado('Esse arquivo não tem nenhum ponto.'); return; }
    colecao = lida;
    selecionado = null;
    guardar();
    redesenhar();
    recado(`Abri ${lida.pontos.length} ponto(s) de ${arq.name}.` +
      (lida.pontos.some((p) => p.midias?.some((m) => m.arquivo))
        ? ' As mídias em arquivo ficam na pasta original; aqui aparecem só pelo nome.' : ''));
  } catch (e) {
    recado(`Não consegui ler esse arquivo: ${e.message}`);
  } finally { ev.target.value = ''; }
});

$('#btn-descartar').addEventListener('click', async () => {
  if (!confirm('Apagar tudo o que você cadastrou neste navegador? Não dá para desfazer.')) return;
  dados.apagarRascunho();
  temRascunho = false;
  const pub = await dados.carregarPublicado();
  colecao = { versao: pub.versao, atualizadoEm: pub.atualizadoEm, pontos: pub.pontos };
  selecionado = null;
  anexos.recolherLixo(colecao.pontos);
  redesenhar();
  atualizarEstadoRascunho();
  recado('Pronto, tudo limpo.');
});

// ---------- partida ----------

const publicado = await dados.carregarPublicado();
const rascunho = dados.lerRascunho();

if (rascunho?.pontos?.length) {
  colecao = rascunho;
  temRascunho = true;
  recado(`Retomei o que você tinha aqui: ${rascunho.pontos.length} ponto(s).`);
} else {
  colecao = { versao: publicado.versao, atualizadoEm: publicado.atualizadoEm, pontos: publicado.pontos };
  if (publicado.erro) {
    const aviso = $('#falhou-mapa');
    aviso.textContent = `Não consegui ler dados/pontos.json (${publicado.erro}). Dá para adicionar pontos assim mesmo, ou abrir um arquivo salvo em "Dados…".`;
    aviso.hidden = false;
  }
}

hidrografia.iniciar();

redesenhar();
atualizarEstadoRascunho();

if (colecao.pontos.length) {
  const comCoord = colecao.pontos.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (comCoord.length) mapa.fitBounds(L.latLngBounds(comCoord.map((p) => [p.lat, p.lng])).pad(0.18), { animate: false });
}
