#!/usr/bin/env bash
# Vídeo completo: composição -> quadros -> trilha e efeitos -> mp4 final (-14 LUFS).
# Uso: ./make.sh comece-aqui
set -euo pipefail
cd "$(dirname "$0")"
id="${1:?informe o id do vídeo (src/<id>.js)}"
[ -d vendor/node_modules/gsap ] || npm install --prefix vendor gsap@3.12.5 lucide-static@0.460.0 --no-audit --no-fund
node build.mjs "$id"
node render.cjs "$id"
python3 audio.py "renders/$id.cues.json" "renders/$id.wav"
ffmpeg -v error -y -i "renders/$id.video.mp4" -i "renders/$id.wav" -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=9" -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "renders/$id.mp4"
echo "pronto: renders/$id.mp4"
