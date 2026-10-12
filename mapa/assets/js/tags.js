// Tags livres: quem cadastra escreve as suas, sem lista fechada para escolher.
//
// Substituíram os cinco eixos fixos do roteiro — que continuam podendo existir, só que como
// tags quaisquer ("O Rio", "Vestígios"…), sem privilégio nenhum no código.

// Mesma tag escrita de formas diferentes tem de contar como uma só. A chave é a forma reduzida
// (sem acento, minúscula, espaços colapsados); o rótulo guarda como a pessoa escreveu.
export function chaveDaTag(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function limparTag(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 48);
}

// Lista de tags a partir de um texto digitado, separando por vírgula (e por ";" e quebra de linha,
// que é o que aparece quando alguém cola de outro lugar). Sem repetir, preservando a ordem.
export function lerTags(texto) {
  const vistas = new Set();
  const saida = [];
  for (const bruta of String(texto ?? '').split(/[,;\n]/)) {
    const tag = limparTag(bruta);
    if (!tag) continue;
    const chave = chaveDaTag(tag);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(tag);
  }
  return saida;
}

export const escreverTags = (tags) => (tags ?? []).join(', ');

// Cor estável por tag: a mesma palavra dá sempre a mesma cor, em qualquer máquina e em qualquer
// sessão. Sem isso, cada recarga embaralharia as cores do mapa.
export function corDaTag(tag) {
  const chave = chaveDaTag(tag);
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  const matiz = h % 360;
  // Saturação e luminosidade presas numa faixa escura o bastante para texto branco em cima
  // manter contraste (fica em torno de 4,5:1 ou melhor em todos os matizes).
  const sat = 42 + (h >> 9) % 18;     // 42–59%
  const luz = 30 + (h >> 17) % 8;     // 30–37%
  return `hsl(${matiz} ${sat}% ${luz}%)`;
}

// Primeira letra visível, para o marcador no mapa.
export function glifoDaTag(tag) {
  const limpa = limparTag(tag);
  return limpa ? limpa[0].toUpperCase() : '•';
}

export const SEM_TAG = { rotulo: 'Sem tag', chave: '', cor: '#6b7280', glifo: '•' };

// Como um ponto se apresenta: a primeira tag manda na cor e na letra do marcador.
export function faceDe(ponto) {
  const primeira = ponto?.tags?.[0];
  if (!primeira) return SEM_TAG;
  return { rotulo: primeira, chave: chaveDaTag(primeira), cor: corDaTag(primeira), glifo: glifoDaTag(primeira) };
}

// Todas as tags em uso, em ordem alfabética (pt-BR), com quantos pontos cada uma tem.
export function catalogo(pontos) {
  const porChave = new Map();
  for (const p of pontos) {
    for (const tag of p.tags ?? []) {
      const chave = chaveDaTag(tag);
      if (!chave) continue;
      const atual = porChave.get(chave);
      if (atual) atual.quantos += 1;
      else porChave.set(chave, { chave, rotulo: tag, cor: corDaTag(tag), quantos: 1 });
    }
  }
  return [...porChave.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR', { sensitivity: 'base' }));
}
