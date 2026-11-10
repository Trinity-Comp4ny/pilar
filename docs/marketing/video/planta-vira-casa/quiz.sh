#!/usr/bin/env bash
# Monta o V-21 (quiz) a partir dos quadros do V-20 já renderizados em frames/.
set -euo pipefail
W="${1:-.}"; cd "$W"
node quiz_seq.mjs
rm -rf qseq qframes; mkdir -p qseq
node -e "const s=require('./quiz_seq.json').seq;const fs=require('fs');s.forEach((x,i)=>fs.symlinkSync(require('path').resolve('frames/f'+String(x.src).padStart(4,'0')+'.jpg'),'qseq/s'+String(i).padStart(4,'0')+'.jpg'))"
node capture_quiz.cjs qframes
python3 -I quiz_sound.py quiz_seq.json quiz.wav
ffmpeg -y -loglevel error -framerate 30 -i qseq/s%04d.jpg -framerate 30 -i qframes/q%04d.png -i quiz.wav -filter_complex "[0][1]overlay" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 192k -shortest -movflags +faststart v21-quiz-nome-das-pecas.mp4
