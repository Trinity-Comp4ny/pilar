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
| Comece aqui | 9:16, 48 s | claro, marca no escuro | música | `renders/comece-aqui-light.mp4` (capa `comece-aqui-light-capa.jpg`) |
| Comece aqui (variação, versão anterior) | 9:16, 49 s | escuro | música | `renders/comece-aqui-dark.mp4` |
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
reposiciona o vídeo inteiro sozinho. Custos verificados em 2026-11-09:

| Voz | Custo | Observação |
| --- | --- | --- |
| **Sua voz** (`narration/<id>/manual/l01.wav`...) | grátis | Mais autêntica para venda feita pelo fundador. Celular, ambiente quieto, 30 cm |
| **Gemini TTS** (`GEMINI_API_KEY`, do Google AI Studio) | grátis, sem cartão | Cota pequena (dezenas de falas por dia); as falas ficam em cache e só a que mudou é pedida de novo. Aceita direção de tom (`GEMINI_STYLE`) |
| **Google Cloud TTS, Chirp 3 HD** (`GOOGLE_TTS_API_KEY`) | 1 milhão de caracteres grátis por mês | Pede conta de faturamento (cartão) no Google Cloud. Um roteiro de 1 min tem ~1.000 caracteres |
| **ElevenLabs** (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`) | plano grátis **não permite uso comercial** | Comercial a partir do Starter (~US$ 5 a 6/mês); pede liberar `api.elevenlabs.io` na rede |
| **Kokoro local** (`KOKORO_DIR`) | grátis | Só voz-guia: sotaque estrangeiro, não publicar |

Os hosts do Gemini e do Google Cloud TTS já são acessíveis no ambiente de nuvem; basta a chave.

### ElevenLabs, passo a passo

1. Conta em elevenlabs.io. Em **Developers → API Keys**, crie uma chave com permissão de
   *Text to Speech* e *Voices (read)*.
2. Escolha a voz. Na conta grátis, use uma das vozes padrão (a Voice Library não sai pela API no
   plano grátis). Para sotaque brasileiro de verdade, uma voz brasileira da Voice Library, que
   pede plano pago.
3. No ambiente de nuvem (menu do ambiente → Edit): variáveis `ELEVENLABS_API_KEY` e
   `ELEVENLABS_VOICE_ID`, e `api.elevenlabs.io` em Network access → Allowed domains. Abra uma
   sessão nova.
4. `python3 check_elevenlabs.py` confere a conexão e lista as vozes (não gasta crédito).
5. `./make.sh agentes-explicado light` gera a voz e o vídeo. Ajustes finos: `ELEVENLABS_SPEED`,
   `ELEVENLABS_STABILITY`, `ELEVENLABS_STYLE`, `ELEVENLABS_MODEL`.

Custo: o roteiro do vídeo dos agentes tem ~1.000 caracteres (1 crédito por caractere). O plano
grátis dá 10.000 por mês, mas **não permite uso comercial** e exige crédito ao ElevenLabs;
para publicar, o Starter (~US$ 5 a 6/mês). As falas geradas ficam em cache: refazer o vídeo
sem mudar o texto não gasta crédito.

## Música

Sem arquivo, `audio.py` sintetiza a trilha (original, sem licença de terceiros). Para usar uma
música de biblioteca grátis com uso comercial liberado (YouTube Audio Library, Pixabay Music),
salve como `music/<nome do vídeo>.mp3` (ex.: `music/comece-aqui-light.mp3`) e rode o `make.sh`:
ela entra no lugar da sintetizada, com os efeitos por cima. Os cortes do vídeo caem a cada 0,5 s
(120 BPM): música entre 115 e 125 BPM casa melhor.

## Formatos da série (para não ficar tudo igual)

| Formato | Para quê | Tema | Áudio | Duração |
| --- | --- | --- | --- | --- |
| Tour (Comece aqui) | Mostrar o sistema inteiro, destaque fixo | claro, marca no escuro | música | 45 a 50 s |
| Funcionalidade em foco (agentes, clima, diário) | Explicar uma coisa a fundo | claro | narração | 30 a 60 s |
| Texto cinético / opinião ("3 sinais de que...") | Parar o dedo, gerar conversa | escuro | música | 12 a 20 s |
| Conta rápida (quanto custa o retrabalho) | Prova com número, linha a linha | claro | música ou voz | 20 a 40 s |
| Antes e depois (planilha x Pilar), tela dividida | Contraste direto | claro | música | 15 a 25 s |
| Chamada para ação (demonstração, planos) | Converter, em loop | escuro ou verde | música | 8 a 15 s |
| Fundador falando (câmera do celular + telas por cima) | Confiança, venda founder-led | real | sua voz | 30 a 60 s |
| Horizontal 16:9 (YouTube, landing, venda) | Apresentação completa | claro | narração | 90 s |

## Desvio consciente do guia de movimento

`brand/motion.md` pede trilha ausente por padrão e movimento calmo. Aqui o CEO pediu mais
animação e mais energia: a trilha é instrumental e abaixo de onde a voz ficaria, e o movimento
continua sem bounce, sem giro e sem transição de efeito (só ease-out, máscara e corte seco).
