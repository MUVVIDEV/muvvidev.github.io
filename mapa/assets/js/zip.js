// Monta um .zip no navegador, sem biblioteca. Guarda os arquivos sem compressão (método "store"):
// o conteúdo pesado aqui é foto e vídeo, que já vêm comprimidos — espremer de novo não ganharia nada
// e custaria código. Serve de alternativa quando o navegador não deixa escolher uma pasta.

const tabelaCrc = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = tabelaCrc[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Data/hora no formato do MS-DOS, que é o que o cabeçalho do zip guarda.
function dataDos(d = new Date()) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, dia };
}

/**
 * @param {{nome: string, dados: Uint8Array}[]} entradas  caminhos com "/" para criar subpastas
 * @returns {Blob}
 */
export function montarZip(entradas) {
  const cod = new TextEncoder();
  const { hora, dia } = dataDos();
  const pedacos = [];
  const central = [];
  let deslocamento = 0;

  for (const { nome, dados } of entradas) {
    const nomeBytes = cod.encode(nome);
    const crc = crc32(dados);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);   // assinatura do cabeçalho local
    local.setUint16(4, 20, true);           // versão necessária
    local.setUint16(6, 0x0800, true);       // bit 11: nome em UTF-8
    local.setUint16(8, 0, true);            // método 0 = store
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nomeBytes.length, true);
    local.setUint16(28, 0, true);           // sem campo extra

    pedacos.push(new Uint8Array(local.buffer), nomeBytes, dados);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);      // assinatura do diretório central
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, hora, true);
    cd.setUint16(14, dia, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, dados.length, true);
    cd.setUint32(24, dados.length, true);
    cd.setUint16(28, nomeBytes.length, true);
    cd.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(cd.buffer), nomeBytes);

    deslocamento += 30 + nomeBytes.length + dados.length;
  }

  const tamanhoCentral = central.reduce((t, p) => t + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);       // fim do diretório central
  fim.setUint16(8, entradas.length, true);
  fim.setUint16(10, entradas.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, deslocamento, true);

  return new Blob([...pedacos, ...central, new Uint8Array(fim.buffer)], { type: 'application/zip' });
}
