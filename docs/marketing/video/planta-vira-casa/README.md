# Planta vira casa (V-20) e quiz das peças (V-21)

Reels 1080 × 1920, 30 fps, feitos 100% por código: a obra sobe a partir dos traços de uma planta impressa
(three.js renderizado no Chromium headless), os textos seguem a marca (Geist, Ink, pílula verde) e a trilha é
original (`sound.py`, `quiz_sound.py`), sincronizada com os eventos da obra. Roteiros e calendário:
[../../05-conteudo-viral.md](../../05-conteudo-viral.md).

| Arquivo | O que é |
|---|---|
| `src/` | cena 3D: planta (textura), paredes, baldrame, armaduras, pilares, blocos, vergas, vigas, reboco, esquadrias, tesouras, telhado, grua, andaimes, poeira, paisagismo, câmera |
| `capture.cjs` | renderiza os quadros 3D (`N=378 PAGE=obra3.html node capture.cjs full frames`) e grava `events.json` |
| `overlay.html` + `capture_overlay.cjs` | camada de texto do V-20 (gancho, etapas, fechamento) |
| `sound.py` | trilha + efeitos do V-20 a partir de `events.json` |
| `quiz*.{html,mjs,cjs,py,sh}`, `project.mjs`, `quiz_items.jsonl` | V-21: pausas, anel de destaque, perguntas e respostas sobre os mesmos quadros |
| `make.sh` | gera o V-20 do zero; `FR=frames bash quiz.sh <pasta>` gera o V-21 a partir dos quadros |

Render em CPU (SwiftShader): cerca de 12 s por quadro, ou 75 min para o V-20. O V-21 reaproveita os quadros.
Revisar a ordem técnica das etapas antes de publicar (doc 05, seção 0).
