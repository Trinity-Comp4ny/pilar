#!/usr/bin/env bash
# Uso: bash make_kit.sh <pagina-em-kit/> <saida.mp4> [bpm] [cues-extra.json]
set -euo pipefail
P="$1"; OUT="$2"; BPM="${3:-100}"; EXTRA="${4:-}"; D="pg_$(basename "$P" .html)"
rm -rf "$D"; NODE_PATH="$(npm root -g)" node capture_page.cjs "kit/$P" "$D"
python3 -I kit_sound.py "$D/cues.json" "$D/trilha.wav" "$BPM" $EXTRA
ffmpeg -y -loglevel error -framerate 30 -i "$D/p%04d.jpg" -i "$D/trilha.wav" -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
echo "pronto $OUT"
