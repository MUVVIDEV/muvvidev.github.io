// Painel do museu em /arquivos/: atalhos para o ArtAtk (páginas do site), o Mapa interativo e, para quem administra, os Acessos.
// Só desenha atalhos: quem pode o quê continua sendo decidido no servidor (publicador/core.mjs).
import { h, $ } from './core/dom.js';
import { loadConfig } from './core/auth.js';
import { carregarHost } from './core/host.js';
import { BASE } from './core/util.js';

const cartao = ({ href, titulo, texto, tag, classe = '' }) => (href
  ? h('a', { class: `pcard ${classe}`, href, role: 'listitem' }, h('span', { class: 'ptag' }, tag), h('h3', {}, titulo), h('p', {}, texto))
  : h('div', { class: `pcard p-off ${classe}`, role: 'listitem' }, h('span', { class: 'ptag' }, tag), h('h3', {}, titulo), h('p', {}, texto)));

async function main() {
  const H = await carregarHost({ carregarConfig: loadConfig });
  const sess = await H.identidade();
  if (!sess) return;                       // arquivos.js já mandou para o login
  const grade = $('#g-painel'); if (!grade) return;
  const cartoes = [
    cartao({
      href: sess.podeSite ? `${BASE}editor/` : null, tag: 'ArtAtk', titulo: 'Editor de páginas',
      texto: sess.podeSite ? 'Edite as páginas do museu e publique. O que já está no ar aparece logo abaixo, em “Páginas publicadas”.' : 'Só quem organiza o site edita as páginas. Você pode ver o que está publicado logo abaixo.',
    }),
    cartao({ href: `${BASE}mapa/`, tag: 'Mapa', titulo: 'Mapa interativo', texto: 'Marque lugares do Vale do Ivaí, organize por tags e salve o material numa pasta do seu computador.' }),
  ];
  if (sess.admin) cartoes.push(cartao({ href: `${BASE}arquivos/acessos/`, tag: 'Administração', titulo: 'Acessos', texto: 'Aprove quem pediu para entrar, libere e-mails e veja quem tem acesso.', classe: 'p-admin' }));
  grade.replaceChildren(...cartoes);
  $('#sec-painel').hidden = false;
}
main().catch((e) => console.error('painel:', e));
