---
id: MAPA-PROTO
titulo: "Mapa Interativo — aplicação estática"
status: em desenvolvimento
versao: 0.3
revisado_em: 2026-10-09
dependencia_de_stack: não
relacionados: [MAPA, LEV-01, REQ, STACK, RF02, RF07]
---

# Mapa Interativo

Mapa do Vale do Ivaí em que **cada ponto do acervo é uma coordenada**, organizado por **tags
livres**. Quem cadastra marca o lugar no mapa, escreve as tags que quiser, anexa fotos, vídeos e
áudios, e **salva tudo numa pasta do próprio computador** — nada é enviado para a internet.

HTML, CSS e módulos ES **sem etapa de build**; conteúdo em JSON; o Leaflet vem do repositório.

> Nada aqui pressupõe o stack final ([STACK](../documentation/decisoes/pesquisa-tech-stack.md),
> [D-0007](../documentation/decisoes/decisoes.md)): se amanhã o acervo vier de um banco ou de uma
> plataforma de acervo, o que muda é **de onde vem o `pontos.json`** — a interface continua a mesma.

## Ver funcionando

Precisa ser servido por HTTP — módulos ES não carregam por `file://`:

```bash
cd mapa && python3 -m http.server 8799
# depois: http://127.0.0.1:8799/
```

Abre vazio: o conteúdo é o que cada pessoa cadastrar.

## O fluxo de quem cadastra

1. **Adicionar ponto** — abre a ficha já na primeira tela.
2. Preenche título, **tags**, município, resumo, fonte.
3. **Marcar no mapa** (o botão em destaque) — a ficha sai da frente, a pessoa clica no lugar e a
   ficha volta com a coordenada, **sem perder nada do que já tinha digitado**. Depois dá para
   arrastar o marcador. Quem já tem a coordenada usa *Ou digitar a coordenada*, que aceita colar o
   par do Google Maps ou do OpenStreetMap.
4. **Arrasta imagens, vídeos ou áudios** para a área de anexos (ou clica para escolher).
5. **Guardar ponto** — e repete quantas vezes precisar.
6. **Salvar** — abre a guia de registro: nome do autor (obrigatório), e-mail acadêmico (opcional)
   e **quantos campos a mais a pessoa quiser**, com os nomes que ela escolher. Aí escolhe a pasta e
   o material é gravado lá.

Enquanto não salva, o trabalho fica guardado no navegador. **Os arquivos de mídia não** — eles
ficam só na aba aberta, e a ficha avisa isso: um vídeo estouraria a cota do navegador e derrubaria
o rascunho inteiro.

## Tags

Não há categorias fixas: quem cadastra escreve as suas, separadas por vírgula. Os cinco eixos do
roteiro curatorial ([LEV-01](../documentation/levantamento/LEV-01-roteiro-curatorial.md) §2)
continuam podendo existir — como tags quaisquer, sem privilégio nenhum no código.

- A **barra do topo** lista todas as tags em uso, **em ordem alfabética**, com quantos pontos cada
  uma tem. Rola para o lado e vai carregando o resto em lotes de 40 conforme chega ao fim.
- Clicar numa tag **filtra**. Nenhuma marcada = tudo aparece; uma ou mais = os pontos que tiverem
  alguma delas.
- O **📌 de cada tag a fixa** na frente da barra, antes das outras. A escolha fica guardada no
  navegador.
- **Acento e maiúscula não criam tag repetida:** "Rio Ivaí" e "rio ivai" são a mesma. Vale o rótulo
  como foi escrito da primeira vez.
- A **cor** de cada tag sai do próprio nome, sempre a mesma em qualquer máquina. A primeira tag de
  um ponto dá a cor e a letra do marcador no mapa.

## O arquivo de conteúdo

`dados/pontos.json` é a única coisa que precisa mudar para o mapa mudar.

```json
{
  "versao": 1,
  "atualizadoEm": "2026-10-09",
  "registro": {
    "autor": "Maria da Silva",
    "email": "ra000000@uem.br",
    "salvoEm": "2026-10-09T22:10:00.000Z",
    "Instituição": "UEM — Vale do Ivaí"
  },
  "pontos": [
    {
      "id": "vila-rica-do-espirito-santo",
      "titulo": "Vila Rica do Espírito Santo",
      "tags": ["arqueologia", "sítio", "colonial"],
      "lat": -23.9167, "lng": -51.95,
      "municipio": "Fênix",
      "ano": 1589,
      "ladoDoRio": "antes",
      "resumo": "…",
      "midias": [
        { "tipo": "imagem", "arquivo": "midia/foto-do-sitio.jpg", "credito": "…" },
        { "tipo": "video", "url": "https://…", "credito": "…" }
      ],
      "fonte": "De onde vem a informação",
      "revisado": false
    }
  ]
}
```

| Campo | Obrigatório | Observação |
|---|---|---|
| `id` | gerado | Slug do título; colisões ganham `-2`, `-3`… |
| `titulo` | **sim** | |
| `lat`, `lng` | **sim** | Arredondados para 6 casas (≈ 11 cm) |
| `tags[]` | não | Texto livre. A primeira dá a cor do ponto no mapa |
| `municipio`, `ano`, `resumo`, `fonte` | não | |
| `ladoDoRio` | não | `antes` ou `depois` — a divisão que o roteiro usa (e que o protótipo em Next guarda no enum `RiverSide`) |
| `midias[]` | não | `tipo` em `imagem`, `video`, `audio`, `modelo3d`; **`arquivo`** (caminho dentro da pasta salva) ou **`url`** (endereço na internet), mais `credito` |
| `revisado` | não | `true` só depois da conferência |
| `registro` | não | Quem cadastrou. Os campos livres entram como chaves próprias |

O arquivo sai **ordenado por título** e **sem campo vazio**, para o `git diff` de cada publicação
mostrar só o que mudou. Arquivos antigos com o campo `eixo` continuam abrindo: o eixo vira uma tag.

## O que é gravado ao salvar

Dentro da pasta escolhida, uma pasta `mapa-interativo-<autor>-<data>/` com:

```
pontos.json     os pontos e o registro de quem cadastrou
midia/          as imagens, vídeos e áudios anexados, com nomes normalizados
LEIA-ME.txt     quem cadastrou, quando, quantos pontos, e o e-mail para contribuir
```

Em navegador que não deixa escolher pasta (Firefox, Safari), vem tudo num **`.zip`** com essa mesma
estrutura — que já é a *pasta compactada* pronta para enviar por e-mail.

## O que tem dentro

```
mapa/
  index.html            página inteira (estrutura e textos)
  assets/css/mapa.css   um arquivo de estilo, sem framework
  assets/js/tags.js     tags livres: chave, cor estável, catálogo alfabético
  assets/js/listas.js   as escolhas fechadas que sobraram (lado do rio)
  assets/js/dados.js    carregar, normalizar, validar, rascunho e saída em JSON
  assets/js/ficha.js    a ficha do ponto, o "marcar no mapa" e os anexos
  assets/js/anexos.js   os arquivos largados na ficha, até a hora de salvar
  assets/js/salvar.js   a guia de registro e a gravação na pasta escolhida
  assets/js/zip.js      empacotador .zip, para quem não tem a API de pastas
  assets/js/mapa.js     estado, mapa, lista, barra de tags e filtros
  assets/js/hidrografia.js  traçado do rio e a troca de conjunto de dados
  dados/pontos.json     ← o conteúdo
  dados/hidrografia/    traçados dos rios + catalogo.json (de tools/baixar-hidrografia.py)
  vendor/leaflet/       Leaflet 1.9.4 (BSD-2), servido daqui
  tests/                teste de fluxo num Chromium de verdade
```

**Leaflet vem do repositório, não de CDN.** São 196 KB e isso resolve três coisas que o projeto já
decidiu querer: funciona **sem internet**, funciona igual nas **três réplicas do acervo**
([D-0006](../documentation/decisoes/decisoes.md)) e não depende de terceiro para o site abrir.
O mapa-base, esse sim, vem do OpenStreetMap pela rede — se não vier, a página avisa e **a lista
continua servindo** (o *fallback* que [MAPA](../documentation/interatividade-mapa.md) pede).

**Gravar na pasta** usa a File System Access API, que existe em Chromium e Edge. Onde não existe,
cai no `.zip` — mesmo conteúdo, mesma estrutura.

## Acessibilidade

A lista ao lado do mapa **não é um plano B escondido**: é por ela que se navega com teclado e é o
que sobra quando o mapa-base não carrega. Além dela: link *pular para a lista*, filtros de tag que
são checkboxes de verdade (a etiqueta colorida é só aparência), botão de fixar com `aria-pressed`,
área de anexo que responde a Enter além de arrastar, foco visível, `Esc` fecha as janelas, o foco
não escapa delas, avisos em `aria-live` e `prefers-reduced-motion` respeitado. **Ainda não
auditado** com leitor de tela nem contra WCAG 2.1 AA/eMAG — ver
[`../documentation/acessibilidade.md`](../documentation/acessibilidade.md).

## Testes

```bash
node mapa/tests/fluxos.test.mjs
```

54 verificações num Chromium de verdade: a página abrindo vazia, o fluxo de adicionar (ficha antes
do mapa, coordenada conferida contra a do clique, o que estava digitado sobrevive à marcação), as
tags (ordem alfabética, contagem, filtro, fixar com persistência, rolagem em lotes com 90 tags,
acento e caixa não duplicando), anexo por arrastar e soltar, a guia de registro, o material
gravado — conferindo que o `.zip` é válido e que autor e campos livres chegaram aos metadados — e o
traçado do rio: qual conjunto abre, o que o seletor oferece, e que trocar de conjunto **redesenha**
(o desenho carrega no próprio `<path>` de qual conjunto veio, quantas linhas e quantos pontos).
Sem `chromium` na máquina (ou em `CHROMIUM`), o teste avisa e sai com código 0.

## O traçado do rio

O rio desenhado no mapa vem de fonte declarada, e dá para trocar de fonte no seletor **Traçado do
rio**, no canto do mapa. Cada conjunto é um arquivo em `dados/hidrografia/`, indexado por
`catalogo.json`, e o desenho muda junto com a escolha — inclusive a linha que diz a escala, o
comprimento e quantos pontos o traçado tem.

| conjunto | de onde vem | escala | resultado |
|---|---|---|---|
| **OpenStreetMap** — padrão | relação [7718660](https://www.openstreetmap.org/relation/7718660) | variável | 3 linhas, 3.284 pontos, 703,3 km (76 KB) |
| **IBGE BC250 (2025)** | Base Cartográfica Contínua 1:250.000, camada de trechos de drenagem, pelo WFS do IBGE | 1:250.000 | 1 linha, 4.263 pontos, 690,0 km (99 KB) |
| **esquemático (à mão)** | a linha de 13 pontos que o mapa usava antes, sem base cartográfica | nenhuma | fica só para comparação |

**Por que o padrão é o OSM, e não a fonte oficial.** O mapa-base também é OpenStreetMap, então o
traçado cai no eixo do canal desenhado embaixo, em qualquer zoom. A BC250 é generalizada em
1:250.000 e fica, na mediana, 46 m ao lado — o que não se vê até o zoom 13 (46 m dá pouco mais de
um pixel no zoom 12), mas no zoom 15 já coloca a linha **na margem** do rio em vez do meio dele, e
no zoom 18 ela sai do corpo d'água. Como o mapa vai até o 18, o padrão é o traçado que casa com o
que está embaixo. O IBGE fica a um clique no seletor, que é onde ele serve: **conferir e citar**.
Trocar o padrão é uma linha em `tools/baixar-hidrografia.py` (`'padrao': 'osm'`).
A licença do OSM (ODbL) pede crédito visível: o rodapé do mapa diz de qual conjunto é a linha, e o
crédito muda junto com a escolha.

Para refazer os arquivos:

```bash
python3 tools/baixar-hidrografia.py                  # todos os rios, todas as fontes
python3 tools/baixar-hidrografia.py --tolerancia 10  # simplificando 10 m, se o peso incomodar
```

O script baixa, recorta pela caixa do rio, costura os trechos soltos em linhas contínuas e grava a
procedência dentro do próprio arquivo: fonte, licença, URL, data do download e o que deu cada
etapa. **Não simplifica por padrão** — o Ivaí inteiro dá 99 KB, e o mapa vai até o zoom 18, onde um
corte de 25 m já viraria canto reto no meandro.

### O que foi conferido neste traçado

- **A BC250 é a melhor base do IBGE para cá.** As camadas BC100 e BC25 não cobrem o Ivaí
  (devolvem zero trechos); a BCIM é 1:1.000.000, mais grossa.
- **Existe outro "Rio Ivaí" no Rio Grande do Sul.** Filtrar só pelo nome traz 28 trechos em
  latitude −29 que não são o nosso — por isso cada rio declara sua caixa no script.
- **As duas fontes desenham o mesmo rio**: amostrados 406 pontos do eixo, a distância entre os
  traçados é 46 m na mediana e 95% fica abaixo de 150 m.
- **Os 232 trechos da BC250 costuram numa linha só**, sem lacuna, no sentido da formação para a foz.
- **As duas fontes terminam em lugares diferentes.** O nó final da BC250 é o mesmo nó de um trecho
  chamado "Rio Paraná", mas fica na borda da planície — no mapa, o traço para antes do canal. O OSM
  segue 8 km mais, até dentro do canal do Paraná.
- **A ponta de montante é a formação do Ivaí**, onde encostam o **Rio São João** e o **Rio Água
  Parada**. Vale a curadoria conferir: o Roteiro Curatorial e o acervo falam em "rios dos Patos e
  São João", e o Rio dos Patos na BC250 termina alguns quilômetros antes desse nó.

## Limites conhecidos

- **Mídia não sobrevive a fechar a aba.** Os pontos sim, os arquivos não (cota do navegador). Quem
  anexou precisa salvar antes de fechar; a ficha avisa.
- **Abrir um arquivo salvo não traz as mídias de volta** — elas ficam na pasta original e aqui
  aparecem só pelo nome.
- **Sem agrupamento de marcadores.** Com muitos pontos próximos o mapa vai poluir;
  [MAPA](../documentation/interatividade-mapa.md) prevê `Leaflet.markercluster`.
- **Sem panorama 360º.** O Marzipano não foi integrado.
- **Sem o recorte "antes/depois da ponte" desenhado.** O campo existe em cada ponto, mas o mapa
  ainda não mostra a divisão como área.
- **Só o Ivaí tem traçado.** Os afluentes e os outros rios do Vale ainda não foram baixados;
  `tools/baixar-hidrografia.py` já aceita rio novo, falta decidir quais entram.
- **Tag não se renomeia nem se funde.** Corrigir uma tag escrita errada hoje significa editar ponto
  por ponto.
- **Nenhum controle de acesso.** Qualquer pessoa que abra a página cadastra o que quiser no próprio
  computador; o que protege o conteúdo publicado é a revisão de quem recebe.
