# Vídeos de marketing v2

Segunda geração dos vídeos da Pilar. A primeira (branch `docs/marketing-plan-and-videos`, pasta
`docs/marketing/video/`) foi reprovada pelo CEO em 2026-11-09: lenta, pouca informação, fundo
branco com texto solto, narração sintética fraca e logotipo e tagline antigos.

O que muda na v2:

| Antes (v1) | Agora (v2) |
| --- | --- |
| Fundo branco, uma frase por vez | Fundo Ink com colunata, grão e brilho verde; título com revelação por máscara e pílula |
| Tela inteira pequena, quase parada | Janela do app com câmera (pan e zoom), recortes que saem da tela, cursor que aprova |
| 3 benefícios em 40 s | 7 módulos + o mapa de 12 áreas em 49 s, um texto novo a cada 1,5 a 3 s |
| Logo e tagline antigos | Símbolo de três caneluras se desenhando no anel de leitura (ADR 0049) e a tagline de 2026-11-07 |
| Narração edge-tts | Trilha original a 120 BPM + efeitos sincronizados com cada evento da tela; voz entra depois (ver abaixo) |

Dado fictício da empresa de vídeo (Atrium Engenharia), telas reais do app, sem dado de cliente.

## Vídeos

| Vídeo | Formato | Onde vai | Arquivo |
| --- | --- | --- | --- |
| Comece aqui | 9:16, 49 s | 1º vídeo do destaque "Comece aqui", Reels | `renders/comece-aqui.mp4` (capa `comece-aqui-capa.jpg`) |

Roteiro do "Comece aqui": gancho (o mesmo número digitado em 4 arquivos) → o prejuízo aparece no
fim → a marca → do primeiro contato ao dinheiro na conta → 01 Comercial, 02 Projetos, 03 Agentes
de IA, 04 Obras, 05 Diário de obra, 06 Financeiro, 07 Início → tudo num sistema só → CTA.

## Como funciona

| Arquivo | O que é |
| --- | --- |
| `src/engine.js` | Motor: títulos, janela com câmera, recortes, cursor, contadores, anel de leitura e símbolo (mesma geometria e curvas de `src/components/motion/`), cues de áudio. Tudo é função do tempo |
| `src/<id>.js` | A composição de um vídeo (tempos absolutos em segundos) |
| `src/base.css` | Tokens da marca e estilos; fontes vêm de `apps/marketing/public/fonts/` |
| `stills/` | Quadros 2x das telas reais (extraídos dos takes da v1, 1440x900 CSS) |
| `build.mjs` | Gera `out/<id>.html` com os ícones lucide usados e o logotipo oficial de `brand/assets/logo/` |
| `render.cjs` | Abre a composição no Chromium, faz seek quadro a quadro e codifica com ffmpeg (30 fps) |
| `audio.py` | Trilha original (Ré menor, 120 BPM, sem licença de terceiros) e efeitos a partir dos cues |
| `make.sh` | Tudo de uma vez: `./make.sh comece-aqui` → `renders/comece-aqui.mp4` (-14 LUFS) |

Requisitos: Node 20+, Playwright com Chromium, ffmpeg, Python 3 com numpy. O `make.sh` instala
GSAP e lucide em `vendor/` (fora do workspace do app) na primeira vez. Render de 49 s leva ~8 min.

Para revisar sem renderizar tudo: `node render.cjs comece-aqui --still 9.6,24.6` grava quadros
soltos em `renders/`.

## Voz

A versão atual é sem narração, que é como a maior parte dos Reels é assistida. A composição já
registra os tempos de cada cena, então uma voz entra no `ffmpeg` final sem mexer no vídeo. Opções,
da melhor para a pior:

1. Voz do fundador gravada no celular (mais autêntica para venda founder-led).
2. Voz neural de qualidade (ElevenLabs ou Google Chirp 3 HD), que pede chave de API e liberação
   do host na rede do ambiente.
3. TTS local (Kokoro pt-BR): funciona offline, mas tem sotaque; não recomendado para peça de marca.

## Desvio consciente do guia de movimento

`brand/motion.md` pede trilha ausente por padrão e movimento calmo. Aqui o CEO pediu mais
animação e mais energia: a trilha é instrumental e abaixo de onde a voz ficaria, e o movimento
continua sem bounce, sem giro e sem transição de efeito (só ease-out, máscara e corte seco).
