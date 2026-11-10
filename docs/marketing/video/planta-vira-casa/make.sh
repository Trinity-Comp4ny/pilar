#!/usr/bin/env bash
# Gera o Reels "planta vira casa" (V-20): 3D procedural (three.js) + textos da marca + trilha original.
# Uso: bash docs/marketing/video/planta-vira-casa/make.sh [pasta-de-trabalho]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../../../.." && pwd)"
WORK="${1:-/tmp/planta-vira-casa}"; mkdir -p "$WORK/assets"
cd "$WORK"
[ -d node_modules/three ] || { npm init -y >/dev/null; npm i three@0.160.0 >/dev/null; }   # fora do repo (.npmrc do repo trava)
{ cat "$HERE/src/head.html" "$HERE/src/geo_part.js" "$HERE/src/plan_part.js" "$HERE/src/scene_v3.js"; echo '</script></body></html>'; } > obra3.html
cp "$HERE"/overlay.html "$HERE"/capture.cjs "$HERE"/capture_overlay.cjs "$HERE"/sound.py .
cp "$REPO"/apps/marketing/public/fonts/geist-variable*.woff2 assets/
export NODE_PATH="$(npm root -g)"   # playwright global (Chromium do ambiente)
N=378 PAGE=obra3.html node capture.cjs full frames        # ~10 s por quadro em CPU (SwiftShader)
node capture_overlay.cjs oframes 378 30
python3 -I sound.py frames/events.json trilha.wav
ffmpeg -y -loglevel error -framerate 30 -i frames/f%04d.jpg -framerate 30 -i oframes/o%04d.png -i trilha.wav \
  -filter_complex "[0][1]overlay" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -shortest -movflags +faststart v20-planta-vira-casa.mp4
ffmpeg -y -loglevel error -framerate 30 -i frames/f%04d.jpg -i trilha.wav -t 10.2 -af "afade=t=out:st=9.6:d=0.6" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart v20-planta-vira-casa-limpo.mp4
echo "pronto: $WORK/v20-planta-vira-casa.mp4"
