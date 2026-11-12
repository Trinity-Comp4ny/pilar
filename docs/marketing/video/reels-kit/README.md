# Kit de Reels (motion da marca, quadro a quadro)

Vídeos curtos verticais (1080 × 1920, 30 fps) montados em HTML com as curvas, tipografia e cores da marca,
capturados quadro a quadro pelo Chromium headless e com trilha original sincronizada (`kit_sound.py`).
Roteiros, legendas e calendário: [../../05-conteudo-viral.md](../../05-conteudo-viral.md).

| Página (`kit/`) | Vídeo | Fonte das imagens |
|---|---|---|
| `mudancinha.html` | V-28 · "Cliente: só uma mudancinha." (humor + aditivo real) | tela de aditivo |
| `lucro.html` | V-27 · "O projeto acabou. E o lucro?" (conta rápida + margem real) | telas de projeto e aditivo |
| `acheerro.html` | V-24 · "Tem um erro nesta planta." (5 s para achar) | planta desenhada por código |
| `split.html` | V-33 · "Na obra e no cronograma." (3D em cima, cronograma real embaixo) | quadros do V-20 + tela de cronograma |
| `chuva.html` | V-30 · "Concretagem marcada. Olha o céu." (alerta de clima) | quadros do V-20 + chuva 3D + tela da obra |
| `laje.html` | V-34 · "Mesma casa. Telhado ou laje?" | quadros do V-20 + variante laje |
| `xray.html` | V-26 · "Uma casa. Cinco projetos." (raio-X das disciplinas) | variante 3D raio-X |
| `h169.html` | V-20 em 16:9 (YouTube, LinkedIn) | variante 3D 1920 × 1080 |
| `carousel.html` | Carrossel "Glossário da obra" (7 slides 1080 × 1350) | quadros do quiz |
| `capas.html` | Capas dos Reels (essencial no centro 3:4) | quadros de cada vídeo |

## Como gerar

1. Telas reais: `bash shots.sh <pasta>/assets/shots` (sai das gravações em `../takes`, dado fictício).
2. Quadros 3D: a cena vem de `../planta-vira-casa/src` (`head_v4.html` + `geo_part.js` + `plan_part.js` +
   `scene_v4.js`, montados em `obra4.html`). Parâmetros: `?laje=1`, `?w=1920&h=1080&rs=0.62`; chuva e raio-X
   vão por opção no `grab(t, q, {rain, xt, cam, camT})`. Os `job_*.json` descrevem cada lote:
   `node capture_jobs.cjs job_laje.json fr_laje`.
3. Vídeo: `bash make_kit.sh mudancinha.html v28-so-uma-mudancinha.mp4 104` (captura, trilha, H.264 + AAC).

Tudo roda na mesma pasta de trabalho (fora do repo, com `three@0.160.0` instalado), com `assets/` contendo as fontes
Geist, o logotipo branco e as telas. Render 3D em CPU: cerca de 5 a 12 s por quadro.

## Regras que valem para todo vídeo do kit

- Primeiro quadro já traz o gancho (sem logo de abertura). Uma pílula verde por frase.
- Entradas ease-out, sem quique. Sem quadro final de marca (DECISOES 12/11): o fim emenda no começo (a obra
  rebobina até a planta ou o vídeo volta ao gancho) e o CTA vai na legenda do post.
- Telas do produto só da empresa fictícia (Atrium / Residência Toledo / Hotel Serra Verde). Números de exemplo levam
  "dados de exemplo".
- O 3D é exceção à regra de imagem da marca (ver seção 0 do doc 05): precisa de decisão registrada no `DECISOES.md`.
