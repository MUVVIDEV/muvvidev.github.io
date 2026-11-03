// Administração dos acessos: fila de pedidos, convite nominal, membros e registro. Só aparece para quem tem a função "admin";
// a recusa de verdade acontece no servidor (publicador/core.mjs: exigirAdmin), isto aqui só evita mostrar botão que não funciona.
import { h, $ } from './core/dom.js';
import { loadConfig } from './core/auth.js';
import { carregarHost } from './core/host.js';
import { createPublicador } from './core/publicador.js';

const fmt = (iso) => { try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso || ''; } };
const ACAO = { aprovou: 'aprovou', recusou: 'recusou', convidou: 'liberou', revogou: 'removeu' };
const ROTULO = { site: 'edita o site', admin: 'administra' };

let pub, eu, dados;
const msg = (t, tipo = '') => { const m = $('#msg'); m.textContent = t || ''; m.className = `ac-msg ${tipo}`; };
const ocupado = (sim) => document.querySelectorAll('#painel button, #painel input').forEach((e) => { e.disabled = sim; });

async function recarregar() {
  dados = await pub.acessos();
  $('#sec-entrar').hidden = true; $('#painel').hidden = false;
  desenha();
}

// Executa uma ação, mostra o resultado e recarrega a lista (também quando falha: o 404/409 costuma ser "outra pessoa já decidiu").
async function agir(fazer, ok) {
  ocupado(true); msg('Gravando…');
  try { await fazer(); msg(ok, 'ok'); }
  catch (e) { msg(e.message, 'erro'); }
  try { await recarregar(); } catch (e) { msg(e.message, 'erro'); }
  ocupado(false);
}

function desenha() {
  const { pedidos, membros, registro } = dados;
  $('#sub-pedidos').textContent = pedidos.length ? `${pedidos.length} aguardando. Quem pede só entra depois que você aprovar.` : '';
  const lp = $('#l-pedidos');
  lp.replaceChildren(...(pedidos.length ? pedidos.map(itemPedido) : [h('li', { class: 'ac-vazio' }, 'Ninguém esperando agora.')]));

  $('#sub-membros').textContent = `${membros.length} ${membros.length === 1 ? 'pessoa' : 'pessoas'}.`;
  $('#l-membros').replaceChildren(...membros.map(itemMembro));

  $('#l-registro').replaceChildren(...(registro.length ? registro.map((r) => h('li', {}, h('time', { datetime: r.em }, fmt(r.em)), `${r.por} ${ACAO[r.acao] || r.acao} ${r.nome || r.quem || ''}`.trim()
    + (r.funcoes?.length ? ` (${r.funcoes.map((f) => ROTULO[f] || f).join(', ')})` : ''))) : [h('li', {}, 'Nada decidido ainda.')]));
}

function itemPedido(p) {
  const site = h('input', { type: 'checkbox' });
  const nome = p.nome;
  return h('li', { class: 'ac-item' },
    h('div', { class: 'ac-quem' }, h('strong', {}, p.nome), h('span', {}, `${p.email} · pediu em ${fmt(p.em)}`)),
    h('div', { class: 'ac-acoes' },
      h('label', {}, site, 'pode editar o site'),
      h('button', { class: 'dbtn primario', type: 'button', onclick: () => agir(() => pub.decidir(p.id, 'aprovar', { funcoes: site.checked ? ['site'] : [] }), `${nome} agora pode entrar.`) }, 'Aprovar'),
      h('button', { class: 'dbtn', type: 'button', onclick: () => confirm(`Recusar o pedido de ${nome}?`) && agir(() => pub.decidir(p.id, 'recusar'), `Pedido de ${nome} recusado.`) }, 'Recusar')));
}

function itemMembro(m) {
  const sou = m.slug === eu.slug;
  return h('li', { class: 'ac-item' },
    h('div', { class: 'ac-quem' }, h('strong', {}, m.nome + (sou ? ' (você)' : '')),
      h('span', {}, m.slug), ' ', ...m.funcoes.map((f) => h('span', { class: `ac-chip ${f}` }, ROTULO[f] || f))),
    h('div', { class: 'ac-acoes' }, sou ? null
      : h('button', { class: 'dbtn remover', type: 'button', onclick: () => confirm(`Tirar o acesso de ${m.nome}? A pessoa deixa de poder publicar e entrar.`) && agir(() => pub.revogar(m.slug), `${m.nome} não tem mais acesso.`) }, 'Remover')));
}

$('#f-convite').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target; const funcoes = ['site', 'admin'].filter((k) => f[k].checked);
  agir(async () => { await pub.convidar({ nome: f.nome.value, email: f.email.value, funcoes }); f.reset(); }, 'E-mail liberado.');
});

async function main() {
  const cfg = await loadConfig();
  const H = await carregarHost({ carregarConfig: loadConfig });
  eu = await H.identidade();
  if (!eu) { H.entrar('arquivos/acessos/'); return; }
  $('#quem').textContent = eu.nome;
  if (!eu.admin) { msg('Só quem administra os acessos vê esta página. Peça a quem administra o site para te dar essa função.', 'erro'); return; }
  if (!cfg.publicador) { msg('O publicador ainda não foi configurado neste site.', 'erro'); return; }
  pub = createPublicador({ url: cfg.publicador, clientId: cfg.googleClientId, slug: eu.slug, ...(cfg.googleFake ? { requestToken: async () => ({ access_token: 'homologacao', expires_in: 3600 }) } : {}) });
  // Se a confirmação do Google ainda vale (esta aba), entra direto; senão pede um clique (a janela do Google exige gesto do usuário).
  if (pub.isConfirmado()) { try { await recarregar(); return; } catch (e) { msg(e.message, 'erro'); } }
  $('#sec-entrar').hidden = false;
  $('#entrar').onclick = async () => { msg('Abrindo o Google…'); try { await recarregar(); msg(''); } catch (e) { msg(e.message, 'erro'); } };
}
main().catch((e) => msg(e.message || 'Algo deu errado.', 'erro'));
