// A ficha do ponto. Abre vazia pelo botão "Adicionar ponto" — o lugar no mapa é escolhido de
// dentro dela, pelo botão "Marcar no mapa". Não conhece o mapa: pede a marcação por callback.

import { LADOS } from './listas.js';
import { lerTags, escreverTags } from './tags.js';
import { normalizarPonto, validarPonto } from './dados.js';
import * as anexos from './anexos.js';

const $ = (sel) => document.querySelector(sel);

// Tipo de uma mídia informada por endereço, deduzido da extensão.
function tipoDaUrl(url) {
  if (/\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/i.test(url)) return 'imagem';
  if (/\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(url)) return 'video';
  if (/\.(mp3|ogg|wav|m4a|flac)(\?|#|$)/i.test(url)) return 'audio';
  if (/\.(glb|gltf)(\?|#|$)/i.test(url)) return 'modelo3d';
  return 'imagem';
}

export function criarFicha({ aoGuardar, aoExcluir, aoPedirMarcacao, aoMudarCoordenada, aoFechar, idsEmUso }) {
  const caixa = $('#ficha');
  const fundo = $('#fundo-modal');
  const form = $('#form-ponto');
  const titulo = $('#h-ficha');
  const listaErros = $('#erros-ficha');
  const btnExcluir = $('#btn-excluir');
  const estadoLugar = $('#lugar-estado');
  const listaAnexos = $('#anexos');

  const campo = {
    titulo: $('#f-titulo'), tags: $('#f-tags'), municipio: $('#f-municipio'),
    lat: $('#f-lat'), lng: $('#f-lng'), ano: $('#f-ano'), lado: $('#f-lado'),
    resumo: $('#f-resumo'), midiaUrl: $('#f-midia-url'), midiaCredito: $('#f-midia-credito'),
    fonte: $('#f-fonte'), revisado: $('#f-revisado'),
  };

  const opcoes = (el, itens, { vazio } = {}) => {
    el.innerHTML = '';
    if (vazio) el.append(new Option(vazio, ''));
    for (const it of itens) el.append(new Option(it.nome ?? it.curto, it.id));
  };
  opcoes(campo.lado, LADOS);

  let emEdicao = null;
  let eraNovo = false;
  let focoAnterior = null;
  let anexados = [];          // [{ caminho, tipo, bytes }] do ponto que está aberto

  // ---------- lugar ----------

  function mostrarLugar() {
    const lat = Number(campo.lat.value), lng = Number(campo.lng.value);
    const tem = Number.isFinite(lat) && Number.isFinite(lng) && campo.lat.value !== '' && campo.lng.value !== '';
    estadoLugar.textContent = tem ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Nenhum lugar marcado ainda';
    estadoLugar.classList.toggle('marcado', tem);
    $('#btn-marcar').innerHTML = tem
      ? '<span aria-hidden="true">◎</span> Marcar outro lugar no mapa'
      : '<span aria-hidden="true">◎</span> Marcar no mapa';
  }

  // Põe a coordenada vinda do mapa (clique ou arrasto do marcador).
  function definirCoordenada(lat, lng) {
    campo.lat.value = Number(lat).toFixed(6);
    campo.lng.value = Number(lng).toFixed(6);
    mostrarLugar();
  }

  $('#btn-marcar').addEventListener('click', () => {
    esconder();                       // sai da frente para a pessoa ver o mapa
    aoPedirMarcacao?.();
  });

  const avisarCoordenada = () => {
    mostrarLugar();
    const lat = Number(campo.lat.value), lng = Number(campo.lng.value);
    if (Number.isFinite(lat) && Number.isFinite(lng)) aoMudarCoordenada?.(lat, lng);
  };
  campo.lat.addEventListener('change', avisarCoordenada);
  campo.lng.addEventListener('change', avisarCoordenada);

  $('#btn-colar-coord').addEventListener('click', async () => {
    let texto = '';
    try { texto = await navigator.clipboard.readText(); }
    catch { texto = prompt('Cole a coordenada (latitude, longitude):') ?? ''; }
    const nums = String(texto).match(/-?\d+(?:[.,]\d+)?/g)?.map((n) => Number(n.replace(',', '.')));
    if (!nums || nums.length < 2) { mostrarErros(['Não encontrei dois números nesse texto.']); return; }
    const [lat, lng] = nums;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { mostrarErros(['Esses números não parecem latitude e longitude.']); return; }
    definirCoordenada(lat, lng);
    esconderErros();
    aoMudarCoordenada?.(lat, lng);
  });

  // ---------- anexos ----------

  function desenharAnexos() {
    listaAnexos.innerHTML = '';
    for (const a of anexados) {
      const li = document.createElement('li');
      li.className = 'anexo';

      if (a.tipo === 'imagem') {
        const img = document.createElement('img');
        img.src = anexos.previa(a.caminho) ?? '';
        img.alt = ''; img.className = 'anexo-capa';
        li.append(img);
      } else {
        const ic = document.createElement('span');
        ic.className = 'anexo-capa anexo-icone';
        ic.textContent = a.tipo === 'video' ? '▶' : a.tipo === 'audio' ? '♪' : '◆';
        ic.setAttribute('aria-hidden', 'true');
        li.append(ic);
      }

      const txt = document.createElement('span');
      txt.className = 'anexo-texto';
      const nome = document.createElement('span');
      nome.className = 'anexo-nome';
      nome.textContent = a.caminho.replace(/^.*\//, '');
      const meta = document.createElement('span');
      meta.className = 'anexo-meta';
      meta.textContent = `${a.tipo} · ${anexos.legivel(a.bytes)}`;
      txt.append(nome, meta);
      li.append(txt);

      const x = document.createElement('button');
      x.type = 'button'; x.className = 'b b-mini b-perigo'; x.textContent = '×';
      x.setAttribute('aria-label', `Remover ${nome.textContent}`);
      x.addEventListener('click', () => {
        anexos.remover(a.caminho);
        anexados = anexados.filter((o) => o.caminho !== a.caminho);
        desenharAnexos();
      });
      li.append(x);
      listaAnexos.append(li);
    }
    $('#aviso-anexos').hidden = anexados.length === 0;
  }

  function receberArquivos(lista) {
    const aceitos = [...lista].filter((f) => f && f.size > 0);
    if (!aceitos.length) return;
    for (const f of aceitos) anexados.push(anexos.adicionar(f));
    desenharAnexos();
  }

  const solta = $('#solta');
  const entradaArquivo = $('#arq-midia');
  solta.addEventListener('click', () => entradaArquivo.click());
  solta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); entradaArquivo.click(); }
  });
  entradaArquivo.addEventListener('change', (ev) => { receberArquivos(ev.target.files); ev.target.value = ''; });

  for (const evento of ['dragenter', 'dragover']) {
    solta.addEventListener(evento, (ev) => { ev.preventDefault(); solta.classList.add('sobre'); });
  }
  for (const evento of ['dragleave', 'drop']) {
    solta.addEventListener(evento, (ev) => { ev.preventDefault(); solta.classList.remove('sobre'); });
  }
  solta.addEventListener('drop', (ev) => receberArquivos(ev.dataTransfer?.files ?? []));
  // Largar fora da área não deve fazer o navegador abrir o arquivo e perder o trabalho.
  for (const evento of ['dragover', 'drop']) {
    window.addEventListener(evento, (ev) => { if (!solta.contains(ev.target)) ev.preventDefault(); });
  }

  // ---------- abrir / fechar ----------

  function abrir(ponto, { novo = false } = {}) {
    emEdicao = { ...ponto };
    eraNovo = novo;
    focoAnterior = document.activeElement;

    titulo.textContent = novo ? 'Adicionar um ponto' : 'Editar ponto';
    btnExcluir.hidden = novo;

    campo.titulo.value = ponto.titulo ?? '';
    campo.tags.value = escreverTags(ponto.tags);
    campo.municipio.value = ponto.municipio ?? '';
    campo.lat.value = ponto.lat ?? '';
    campo.lng.value = ponto.lng ?? '';
    campo.ano.value = ponto.ano ?? '';
    campo.lado.value = ponto.ladoDoRio ?? '';
    campo.resumo.value = ponto.resumo ?? '';
    campo.fonte.value = ponto.fonte ?? '';
    campo.revisado.checked = ponto.revisado === true;

    const midias = ponto.midias ?? [];
    campo.midiaUrl.value = midias.find((m) => m.url)?.url ?? '';
    campo.midiaCredito.value = midias.find((m) => m.credito)?.credito ?? '';
    anexados = midias
      .filter((m) => m.arquivo && anexos.tem(m.arquivo))
      .map((m) => ({ caminho: m.arquivo, tipo: m.tipo, bytes: anexos.obter(m.arquivo)?.size ?? 0 }));

    desenharAnexos();
    mostrarLugar();
    esconderErros();
    mostrar();
    campo.titulo.focus();
  }

  // mostrar/esconder sem perder o que está preenchido — é assim que "Marcar no mapa" funciona
  function mostrar() { fundo.hidden = false; caixa.hidden = false; }
  function esconder() { fundo.hidden = true; caixa.hidden = true; }

  function reabrir() { mostrar(); campo.titulo.focus(); }

  function fechar({ avisar = true } = {}) {
    esconder();
    emEdicao = null;
    anexados = [];
    focoAnterior?.focus?.();
    if (avisar) aoFechar?.();
  }

  const estaAberta = () => !caixa.hidden;
  const temPonto = () => emEdicao !== null;

  // ---------- erros ----------

  function mostrarErros(msgs) {
    listaErros.innerHTML = '';
    for (const m of msgs) { const li = document.createElement('li'); li.textContent = m; listaErros.append(li); }
    listaErros.hidden = msgs.length === 0;
    if (msgs.length) listaErros.scrollIntoView?.({ block: 'nearest' });
  }
  const esconderErros = () => { listaErros.innerHTML = ''; listaErros.hidden = true; };

  // ---------- guardar ----------

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();

    const credito = campo.midiaCredito.value.trim();
    const midias = anexados.map((a) => ({ tipo: a.tipo, arquivo: a.caminho, credito }));
    const url = campo.midiaUrl.value.trim();
    if (url) midias.push({ tipo: tipoDaUrl(url), url, credito });

    const ponto = normalizarPonto({
      id: eraNovo ? '' : emEdicao.id,
      titulo: campo.titulo.value,
      tags: lerTags(campo.tags.value),
      lat: campo.lat.value, lng: campo.lng.value,
      municipio: campo.municipio.value,
      ano: campo.ano.value,
      ladoDoRio: campo.lado.value,
      resumo: campo.resumo.value,
      midias,
      fonte: campo.fonte.value,
      revisado: campo.revisado.checked,
    }, idsEmUso?.() ?? new Set());

    const erros = validarPonto(ponto);
    // O erro de coordenada aqui quase sempre quer dizer "ainda não marquei o lugar" — vale um texto
    // que aponte o caminho em vez de falar em latitude.
    if (!Number.isFinite(ponto.lat) || !Number.isFinite(ponto.lng)) {
      mostrarErros([...erros.filter((e) => !/Latitude|Longitude/.test(e)),
        'Falta marcar o lugar: use "Marcar no mapa" ou digite a coordenada.']);
      $('#btn-marcar').focus();
      return;
    }
    if (erros.length) { mostrarErros(erros); campo.titulo.focus(); return; }

    aoGuardar(ponto, { novo: eraNovo, idAnterior: eraNovo ? null : emEdicao.id });
    fechar({ avisar: false });
  });

  $('#btn-cancelar').addEventListener('click', () => fechar());
  $('#btn-fechar-ficha').addEventListener('click', () => fechar());
  fundo.addEventListener('click', () => fechar());

  btnExcluir.addEventListener('click', () => {
    if (!emEdicao) return;
    if (!confirm(`Excluir "${emEdicao.titulo}"?`)) return;
    const id = emEdicao.id;
    fechar({ avisar: false });
    aoExcluir(id);
  });

  document.addEventListener('keydown', (ev) => {
    if (!estaAberta()) return;
    if (ev.key === 'Escape') { ev.preventDefault(); fechar(); return; }
    if (ev.key !== 'Tab') return;
    const focaveis = [...caixa.querySelectorAll('button,input,select,textarea,summary,[href]')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focaveis.length) return;
    const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  });

  // Sugestões do campo de tags: o que já existe no mapa, para ninguém recriar uma tag que já tem.
  function sugerirTags(rotulos) {
    const lista = document.getElementById('tags-conhecidas');
    lista.innerHTML = '';
    for (const r of rotulos) lista.append(new Option(r));
  }

  return { abrir, fechar, reabrir, estaAberta, temPonto, definirCoordenada, sugerirTags };
}
