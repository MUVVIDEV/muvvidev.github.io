// Traçado dos rios no mapa, com troca de conjunto de dados.
//
// O desenho do rio não é enfeite: é a espinha do Vale, e o visitante usa ele para se situar.
// Por isso ele vem de fonte declarada, e o seletor deixa ver de qual — IBGE e OpenStreetMap
// desenham o mesmo Ivaí com traços um pouco diferentes, e comparar é parte do trabalho da
// curadoria. O conjunto "esquemático" é o traçado à mão que o mapa usava antes; fica
// disponível só para mostrar o tamanho do erro que ele tinha.
//
// Os arquivos vêm de dados/hidrografia/, gerados por tools/baixar-hidrografia.py.

const CHAVE_ESCOLHA = 'muvvi.mapa.tracado.v1';
const CAMINHO = 'dados/hidrografia/';

// O traçado antigo, desenhado à mão: 13 pontos, nenhum deles com fonte. Fica aqui para
// comparação e como última reserva se os arquivos não carregarem.
const ESQUEMATICO = {
  id: 'esquematico',
  rio: 'ivai',
  nome: 'Rio Ivaí',
  fonte_curta: 'esquemático (à mão)',
  fonte: 'Linha desenhada à mão em 2026, sem base cartográfica. Serve para orientar o olho, não para medir.',
  licenca: '—',
  url: null,
  escala: 'nenhuma',
  comprimento_km: null,
  vertices: 13,
  linhas: 1,
  cor: '#9aa7b1',
  embutido: [[
    [-51.0833, -25.0167], [-51.2400, -24.8600], [-51.3300, -24.6900], [-51.4700, -24.5300],
    [-51.6100, -24.3600], [-51.7600, -24.2000], [-51.9000, -24.0400], [-52.1200, -23.8700],
    [-52.4100, -23.7000], [-52.8300, -23.5400], [-53.2000, -23.4100], [-53.5100, -23.3200],
    [-53.7167, -23.2833],
  ]],
};

const NENHUM = { id: 'nenhum', rotulo: 'Não mostrar', nenhum: true };

export function criarHidrografia({ mapa, recado }) {
  const geometrias = new Map();      // id -> coordenadas já carregadas
  let conjuntos = [];
  let camada = null;
  let atual = null;
  let elSelect = null;
  let elFonte = null;
  const elCredito = document.getElementById('credito-tracado');

  // No seletor vai só o nome da fonte; os números ficam na linha de baixo, que tem a
  // largura inteira do controle e não corta.
  function rotuloDe(c) {
    return c.nenhum ? c.rotulo : c.fonte_curta;
  }

  function fichaDe(c) {
    const km = c.comprimento_km ? `${String(c.comprimento_km).replace('.', ',')} km` : null;
    const escala = c.escala && c.escala !== 'nenhuma' ? c.escala : null;
    return [escala, km, `${c.vertices} pontos`].filter(Boolean).join(' · ');
  }

  // ---------- controle no canto do mapa ----------

  function montarControle() {
    const Controle = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const caixa = L.DomUtil.create('div', 'ctrl-tracado');
        caixa.innerHTML = `
          <label class="ctrl-rotulo" for="sel-tracado">Traçado do rio</label>
          <select id="sel-tracado" class="ctrl-select"></select>
          <p class="ctrl-fonte" id="ctrl-fonte"></p>`;
        L.DomEvent.disableClickPropagation(caixa);
        L.DomEvent.disableScrollPropagation(caixa);
        return caixa;
      },
    });
    mapa.addControl(new Controle());

    elSelect = document.getElementById('sel-tracado');
    elFonte = document.getElementById('ctrl-fonte');

    for (const c of [...conjuntos, NENHUM]) {
      const op = document.createElement('option');
      op.value = c.id;
      op.textContent = rotuloDe(c);
      elSelect.append(op);
    }
    elSelect.addEventListener('change', () => mostrar(elSelect.value, { lembrar: true }));
  }

  // ---------- desenho ----------

  async function coordenadasDe(c) {
    if (c.embutido) return c.embutido;
    if (geometrias.has(c.id)) return geometrias.get(c.id);
    const resposta = await fetch(`${CAMINHO}${c.arquivo}`, { cache: 'no-cache' });
    if (!resposta.ok) throw new Error(`não foi possível ler ${c.arquivo}`);
    const gj = await resposta.json();
    const g = gj.geometry;
    const coords = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    geometrias.set(c.id, coords);
    return coords;
  }

  async function mostrar(id, { lembrar = false } = {}) {
    const c = [...conjuntos, NENHUM].find((x) => x.id === id) ?? conjuntos[0];
    if (lembrar) { try { localStorage.setItem(CHAVE_ESCOLHA, c.id); } catch { /* ignora */ } }
    if (elSelect && elSelect.value !== c.id) elSelect.value = c.id;

    if (camada) { camada.remove(); camada = null; }
    atual = c;

    if (c.nenhum) {
      if (elFonte) elFonte.textContent = '';
      if (elCredito) elCredito.textContent = '';
      return;
    }

    let coords;
    try {
      coords = await coordenadasDe(c);
    } catch (erro) {
      if (elFonte) elFonte.textContent = 'Este traçado não carregou.';
      recado?.(`O traçado "${c.fonte_curta}" não carregou. ${erro.message}`);
      return;
    }
    if (atual !== c) return;                   // trocaram de novo enquanto carregava

    // [lon, lat] no arquivo (padrão GeoJSON), [lat, lon] no Leaflet.
    const linhas = coords.map((l) => l.map(([x, y]) => [y, x]));
    camada = L.polyline(linhas, {
      color: c.cor ?? '#1d6fa5',
      weight: 5,
      opacity: 0.55,
      smoothFactor: 1,
      interactive: true,
    }).bindTooltip(`${c.nome} — ${c.fonte_curta}`, { sticky: true }).addTo(mapa);
    camada.bringToBack();

    // Quem desenhou isto fica escrito no próprio desenho: o Leaflet junta a multilinha toda num
    // <path> só e recorta o traço pelo que está na vista, então o SVG sozinho não diz de que
    // conjunto ele veio nem quanto ele tem. Serve para inspecionar a página e para os testes.
    const elemento = camada.getElement?.();
    if (elemento) {
      elemento.dataset.tracado = c.id;
      elemento.dataset.linhas = String(linhas.length);
      elemento.dataset.vertices = String(linhas.reduce((n, l) => n + l.length, 0));
    }

    if (elFonte) {
      elFonte.textContent = fichaDe(c);
      elFonte.title = c.fonte;
    }
    // A licença do traçado pede crédito visível — e quem olha o mapa merece saber de quem é a
    // linha que está vendo, não só quem abre o seletor.
    if (elCredito) elCredito.textContent = ` · traçado do rio: ${c.fonte_curta}`;
  }

  // ---------- partida ----------

  async function iniciar() {
    try {
      const resposta = await fetch(`${CAMINHO}catalogo.json`, { cache: 'no-cache' });
      if (!resposta.ok) throw new Error(String(resposta.status));
      const catalogo = await resposta.json();
      conjuntos = catalogo.conjuntos ?? [];
    } catch {
      conjuntos = [];                          // sem arquivos: resta o traçado antigo
    }
    conjuntos = [...conjuntos, ESQUEMATICO];

    montarControle();
    let escolha = null;
    try { escolha = localStorage.getItem(CHAVE_ESCOLHA); } catch { /* ignora */ }
    const padrao = conjuntos.find((c) => c.padrao) ?? conjuntos[0];
    await mostrar(escolha ?? padrao.id);
  }

  return { iniciar, mostrar, get atual() { return atual; }, get conjuntos() { return conjuntos; } };
}
