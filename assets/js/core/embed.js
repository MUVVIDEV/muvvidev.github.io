// Mostra, dentro de uma página do site, uma página feita no editor (paginas/<id>/page.json).
// Só entra se alguém já PUBLICOU a página (publishedAt): enquanto isso, vale o que o código do site já mostra.
//   modo 'tela'    a página inteira cabe na janela, centralizada (landing: sem rolagem)
//   modo 'largura' ocupa a largura do contêiner e cresce em altura (faixa de destaque da home)
import { renderArtboard, observeEntrances, usedFonts } from './render.js';
import { loadFonts } from './fonts.js';
import { W, pageH, bgCss, pageW, ehUnico, temAbas } from './model.js';
import { BASE } from './util.js';
import { fetchPublished, pageDir } from './site.js';
import { docDeAba, abaDoHash } from './sites.js';

export async function mountPublished(host, pageId, { modo = 'largura', onBg } = {}) {
  const doc = await fetchPublished(pageId);
  if (!doc) return null;
  const dir = `${BASE}${pageDir(pageId)}`;
  const assetUrl = (id) => { const a = doc.assets?.[id]; return a ? `${dir}assets/${id}.${a.ext}` : null; };
  loadFonts(usedFonts(doc));
  document.documentElement.classList.add('js-anim');
  if (!document.querySelector('link[data-embed-anim]')) {   // estilos base dos elementos (a landing e a home não carregam anim.css)
    const l = document.createElement('link');
    Object.assign(l, { rel: 'stylesheet', href: `${BASE}assets/css/anim.css` });
    l.dataset.embedAnim = '1';
    document.head.append(l);
  }

  // Página do site COM ABAS (o museu): o que se desenha é a aba do endereço (#/<aba>; sem hash, a
  // primeira) somada ao topo e ao rodapé compartilhados. É a mesma regra do visualizador (perfil.js › vista).
  const vista = () => (temAbas(doc) ? docDeAba(doc, abaDoHash(location.hash, doc) || doc.abas[0].id) : doc);

  const draw = () => {
    const v = vista();
    const dev = ehUnico(v) ? 'd' : matchMedia('(max-width:720px)').matches ? 'm' : 'd';
    const cw = host.clientWidth || document.documentElement.clientWidth, ch = host.clientHeight || innerHeight;
    const s = modo === 'tela' ? Math.min(cw / pageW(v, dev), ch / pageH(v, dev)) : Math.min(cw / pageW(v, dev), dev === 'd' ? 1.5 : 2);
    const stage = document.createElement('div');
    stage.className = 'stage';
    stage.style.cssText = `position:relative;margin:0 auto;overflow:hidden;width:${pageW(v, dev) * s}px;height:${pageH(v, dev) * s}px`;
    loadFonts(usedFonts(v));
    const ab = renderArtboard(v, { dev, assetUrl, editing: false });
    ab.style.transform = `scale(${s})`;
    Object.assign(ab.style, { position: 'absolute', left: '0', top: '0', overflow: 'hidden', transformOrigin: '0 0' });
    stage.append(ab);
    host.replaceChildren(stage);
    observeEntrances(host);
  };
  host.classList.add('pagina-publicada');
  const pintarFundo = () => onBg?.(bgCss(vista().page.bg));
  pintarFundo();
  draw();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 120); });
  // trocar de aba é trocar o endereço: redesenha, repinta o fundo e volta ao topo
  if (temAbas(doc)) addEventListener('hashchange', () => { pintarFundo(); draw(); scrollTo(0, 0); });
  return doc;
}
