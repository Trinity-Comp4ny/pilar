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

Dois formatos, para variar o feed:

- **Só música** (texto cinético, trilha a 120 BPM, efeitos no tempo de cada animação): peças curtas
  de gancho, que a maioria assiste sem som.
- **Narrado** (voz, legenda palavra a palavra, trilha de fundo que abaixa quando a voz entra):
  peças que explicam como algo funciona.

O tema padrão é o **claro**, igual à landing e ao app: papel, céu claro e a paisagem de morros
verdes da hero (`HeroBackdrop`), logotipo em tinta. O **escuro** entra como variação, num vídeo
inteiro ou num momento de marca dentro de um vídeo claro (`scene(..., { theme: "dark" })`).

| Vídeo | Formato | Tema | Áudio | Arquivo |
| --- | --- | --- | --- | --- |
| Comece aqui | 9:16, 49 s | claro | música | `renders/comece-aqui-light.mp4` |
| Comece aqui (variação) | 9:16, 49 s | escuro | música | `renders/comece-aqui-dark.mp4` |
| Agentes de IA, explicado | 9:16, ~56 s | claro com a marca no escuro | narração | `renders/agentes-explicado-light.mp4` |

Roteiro do "Comece aqui": gancho (o mesmo número digitado em 4 arquivos), depois o prejuízo que
aparece no fim, a marca, o caminho do primeiro contato ao dinheiro na conta, os módulos 01 Comercial,
02 Projetos, 03 Agentes de IA, 04 Obras, 05 Diário de obra, 06 Financeiro e 07 Início, o mapa
"tudo num sistema só" e o CTA.

Roteiro do "Agentes de IA, explicado" (`src/agentes-explicado.script.json`): o trabalho que não
é engenharia, a marca, os três passos no chat do agente (a mesma cena da landing: "Recebi 128
mil do centro cirúrgico..."), o selo de conferência em cada campo, o clique em Confirmar, o
aditivo, o resumo da semana e a assinatura "A IA prepara. O sistema confere. Você aprova." Cada
afirmação segue a tabela "O que os agentes fazem hoje" de `brand/messaging.md`.

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
| `src/<id>.script.json` | Roteiro narrado: uma fala por linha (`text` vai na legenda, `say` é o que a voz lê) |
| `narrate.py` | Gera a voz e `narration/<id>/timing.json`; a composição posiciona tudo por esses tempos |
| `make.sh` | Tudo de uma vez: `./make.sh comece-aqui light` → `renders/comece-aqui-light.mp4` (-14 LUFS) |

Requisitos: Node 20+, Playwright com Chromium, ffmpeg, Python 3 com numpy. O `make.sh` instala
GSAP e lucide em `vendor/` (fora do workspace do app) na primeira vez. Render de 49 s leva ~8 min.

Para revisar sem renderizar tudo: `node render.cjs comece-aqui --still 9.6,24.6` grava quadros
soltos em `renders/`.

## Voz

`narrate.py` usa a primeira voz disponível e trata todas igual (corte de silêncio, presença,
compressão). Como a composição lê os tempos da fala, trocar a voz e rodar `make.sh` de novo
reposiciona o vídeo inteiro sozinho.

1. **Sua voz** (recomendado para venda founder-led): grave uma fala por arquivo em
   `narration/<id>/manual/l01.wav`, `l02.wav`... (celular, ambiente quieto, 30 cm do microfone).
2. **Google Cloud TTS, Chirp 3 HD** (voz humana, pt-BR): variável `GOOGLE_TTS_API_KEY`. O host
   `texttospeech.googleapis.com` já é acessível no ambiente de nuvem. Voz padrão
   `pt-BR-Chirp3-HD-Charon`; troque com `VOICE_GOOGLE` (ex.: `pt-BR-Chirp3-HD-Kore`, feminina).
3. **ElevenLabs** (multilingual v2): `ELEVENLABS_API_KEY` e `ELEVENLABS_VOICE_ID`; pede liberar
   `api.elevenlabs.io` na rede do ambiente.
4. **Kokoro local** (`KOKORO_DIR`): só como **voz-guia** para acertar tempo e roteiro. Tem sotaque;
   não publicar com ela.

O render atual do vídeo narrado usa a voz-guia (Kokoro): serve para aprovar roteiro, ritmo e
animação, e precisa ser regerado com uma das vozes 1 a 3 antes de publicar.

## Desvio consciente do guia de movimento

`brand/motion.md` pede trilha ausente por padrão e movimento calmo. Aqui o CEO pediu mais
animação e mais energia: a trilha é instrumental e abaixo de onde a voz ficaria, e o movimento
continua sem bounce, sem giro e sem transição de efeito (só ease-out, máscara e corte seco).
