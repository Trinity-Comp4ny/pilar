#!/usr/bin/env bash
# Vídeo completo: (narração) -> composição -> quadros -> trilha e efeitos -> mp4 final (-14 LUFS).
# Uso: ./make.sh <id> [light|dark]
#   ./make.sh comece-aqui light
#   ./make.sh agentes-explicado light     (narrado: gera a voz antes, ver narrate.py)
set -euo pipefail
cd "$(dirname "$0")"
id="${1:?informe o id do vídeo (src/<id>.js)}"
theme="${2:-}"
name="$id${theme:+-$theme}"
[ -d vendor/node_modules/gsap ] || npm install --prefix vendor gsap@3.12.5 lucide-static@0.460.0 --no-audit --no-fund
if ls footage/"$id".* >/dev/null 2>&1; then
  python3 footage.py "$id"          # gravação real: quadros, voz e legenda alinhada
elif [ -f "src/$id.script.json" ] && [ "${SKIP_NARRATION:-}" != "1" ] && grep -q '"narrated": *true' "src/$id.script.json"; then
  python3 narrate.py "$id"
elif [ -f "src/$id.voz.json" ]; then
  python3 narrate.py "$id"          # voz por cima de um vídeo já montado (ver narrar_sobre)
fi
node build.mjs "$id" ${theme:+--theme "$theme"}
node render.cjs "$name"
python3 audio.py "renders/$name.cues.json" "renders/$name.wav"
voice="narration/$id/voice.wav"
if { [ -f "src/$id.script.json" ] || [ -f "src/$id.voz.json" ]; } && [ -f "$voice" ]; then
  # a voz comanda: a trilha abaixa quando alguém fala (sidechain) e fica ~12 dB abaixo
  ffmpeg -v error -y -i "renders/$name.video.mp4" -i "renders/$name.wav" -i "$voice" -filter_complex \
    "[2:a]aresample=48000,pan=stereo|c0=c0|c1=c0,asplit=2[v][sc];\
     [1:a]aresample=48000,volume=-11dB[m];\
     [m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[duck];\
     [duck][v]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=9[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "renders/$name.mp4"
else
  ffmpeg -v error -y -i "renders/$name.video.mp4" -i "renders/$name.wav" -c:v copy \
    -af "loudnorm=I=-14:TP=-1.5:LRA=9" -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "renders/$name.mp4"
fi
echo "pronto: renders/$name.mp4"
