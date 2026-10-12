// "Salvar": a guia de registro e a gravação do material na pasta que a pessoa escolher.
//
// Dois caminhos, conforme o navegador:
//  1. File System Access API (Chromium, Edge): a pessoa escolhe a pasta e o material é escrito lá,
//     numa subpasta com o nome do autor e a data.
//  2. Sem essa API (Firefox, Safari): baixa a mesma estrutura dentro de um .zip — que é justamente
//     a "pasta compactada" que o aviso pede para enviar por e-mail.

import * as dados from './dados.js';
import * as anexos from './anexos.js';
import { montarZip } from './zip.js';

const $ = (sel) => document.querySelector(sel);
const temApiDePasta = () => typeof window.showDirectoryPicker === 'function';

export function criarSalvar({ obterColecao, aoTerminar }) {
  const caixa = $('#salvar');
  const fundo = $('#fundo-salvar');
  const form = $('#form-salvar');
  const listaCampos = $('#campos-livres');
  const aviso = $('#salvar-aviso');
  let focoAnterior = null;

  // --- campos livres: a pessoa inventa o rótulo ---
  function linhaCampo(rotulo = '', valor = '') {
    const li = document.createElement('li');
    li.className = 'campo-livre';

    const r = document.createElement('input');
    r.type = 'text'; r.className = 'rotulo'; r.placeholder = 'Nome do campo'; r.value = rotulo;
    r.setAttribute('aria-label', 'Nome do campo');

    const v = document.createElement('input');
    v.type = 'text'; v.className = 'valor'; v.placeholder = 'Conteúdo'; v.value = valor;
    v.setAttribute('aria-label', 'Conteúdo do campo');

    const x = document.createElement('button');
    x.type = 'button'; x.className = 'b b-mini b-perigo'; x.textContent = '×';
    x.setAttribute('aria-label', 'Remover este campo');
    x.addEventListener('click', () => li.remove());

    li.append(r, v, x);
    return li;
  }

  $('#btn-add-campo').addEventListener('click', () => {
    const li = linhaCampo();
    listaCampos.append(li);
    li.querySelector('.rotulo').focus();
  });

  function lerRegistroDoForm() {
    return dados.normalizarRegistro({
      autor: $('#s-autor').value,
      email: $('#s-email').value,
      campos: [...listaCampos.querySelectorAll('.campo-livre')].map((li) => ({
        rotulo: li.querySelector('.rotulo').value,
        valor: li.querySelector('.valor').value,
      })),
      salvoEm: new Date().toISOString(),
    });
  }

  // --- abrir / fechar ---
  function abrir() {
    const guardado = dados.lerRegistro();
    $('#s-autor').value = guardado.autor;
    $('#s-email').value = guardado.email;
    listaCampos.innerHTML = '';
    for (const c of guardado.campos) listaCampos.append(linhaCampo(c.rotulo, c.valor));

    const n = anexos.quantos();
    $('#salvar-resumo').textContent =
      `${obterColecao().pontos.length} ponto(s)` + (n ? ` e ${n} arquivo(s) de mídia` : '') + '.';
    $('#salvar-modo').textContent = temApiDePasta()
      ? 'Você vai escolher a pasta no próximo passo.'
      : 'Este navegador não deixa escolher pasta, então o material vem num arquivo .zip — já é a pasta compactada pronta para enviar.';

    aviso.hidden = true;
    focoAnterior = document.activeElement;
    fundo.hidden = false;
    caixa.hidden = false;
    $('#s-autor').focus();
  }

  function fechar() {
    caixa.hidden = true;
    fundo.hidden = true;
    focoAnterior?.focus?.();
  }

  function erro(texto) {
    aviso.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = texto;
    aviso.append(li);
    aviso.hidden = false;
  }

  // --- o que vai para o disco ---
  async function montarMaterial(registro) {
    const colecao = obterColecao();
    const cod = new TextEncoder();
    const itens = [{ nome: 'pontos.json', dados: cod.encode(dados.paraTexto(colecao, registro)) }];

    for (const { caminho, file } of anexos.todos()) {
      itens.push({ nome: caminho, dados: new Uint8Array(await file.arrayBuffer()) });
    }

    const campos = registro.campos.filter((c) => c.rotulo).map((c) => `- ${c.rotulo}: ${c.valor}`);
    itens.push({
      nome: 'LEIA-ME.txt',
      dados: cod.encode(
        `Mapa Interativo — material cadastrado\n` +
        `Museu Virtual do Vale do Ivaí (MUVVI)\n\n` +
        `Autor: ${registro.autor}\n` +
        (registro.email ? `E-mail: ${registro.email}\n` : '') +
        `Salvo em: ${new Date(registro.salvoEm).toLocaleString('pt-BR')}\n` +
        (campos.length ? campos.join('\n') + '\n' : '') +
        `Pontos: ${colecao.pontos.length}\n` +
        `Arquivos de mídia: ${anexos.quantos()}\n\n` +
        `pontos.json guarda os pontos; a pasta ${anexos.PASTA}/ guarda as imagens, vídeos e áudios.\n\n` +
        `Para contribuir com este material, envie esta pasta compactada para:\n` +
        `museuvirtualdovaledoivai@gmail.com\n`),
    });

    return itens;
  }

  // --- gravar ---
  async function gravarNaPasta(itens, nomePasta) {
    const raiz = await window.showDirectoryPicker({ mode: 'readwrite', id: 'muvvi-mapa' });
    const destino = await raiz.getDirectoryHandle(nomePasta, { create: true });

    for (const item of itens) {
      const partes = item.nome.split('/');
      const arquivo = partes.pop();
      let pasta = destino;
      for (const p of partes) pasta = await pasta.getDirectoryHandle(p, { create: true });
      const fh = await pasta.getFileHandle(arquivo, { create: true });
      const fluxo = await fh.createWritable();
      await fluxo.write(item.dados);
      await fluxo.close();
    }
    return `${raiz.name}/${nomePasta}`;
  }

  function baixarZip(itens, nomePasta) {
    const zip = montarZip(itens.map((i) => ({ nome: `${nomePasta}/${i.nome}`, dados: i.dados })));
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.href = url; a.download = `${nomePasta}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    return `${nomePasta}.zip`;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const registro = lerRegistroDoForm();
    if (!registro.autor) { erro('Preencha o nome do autor.'); $('#s-autor').focus(); return; }

    const botao = $('#btn-salvar-confirma');
    botao.disabled = true;
    const rotuloAntes = botao.textContent;
    botao.textContent = 'Salvando…';

    try {
      dados.salvarRegistro(registro);
      const itens = await montarMaterial(registro);
      const nomePasta = dados.nomeBase(registro);
      const onde = temApiDePasta() ? await gravarNaPasta(itens, nomePasta) : baixarZip(itens, nomePasta);
      fechar();
      aoTerminar?.(onde, itens.length);
    } catch (e) {
      // Fechar o seletor de pasta sem escolher nada não é erro: é desistência.
      if (e?.name === 'AbortError') { erro('Você fechou a janela de pastas sem escolher. Nada foi salvo.'); }
      else erro(`Não consegui salvar: ${e.message}`);
    } finally {
      botao.disabled = false;
      botao.textContent = rotuloAntes;
    }
  });

  $('#btn-salvar-cancela').addEventListener('click', fechar);
  $('#btn-fechar-salvar').addEventListener('click', fechar);
  fundo.addEventListener('click', fechar);
  document.addEventListener('keydown', (ev) => {
    if (!caixa.hidden && ev.key === 'Escape') { ev.preventDefault(); fechar(); }
  });

  return { abrir, estaAberta: () => !caixa.hidden };
}
