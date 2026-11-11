#!/usr/bin/env bash
# Extrai das gravações reais (../takes) as telas usadas nos Reels, em 2880x1800, sem cursor por cima do essencial.
set -euo pipefail; T="$(cd "$(dirname "$0")/../takes" && pwd)"; O="${1:-assets/shots}"; mkdir -p "$O"
ffmpeg -loglevel error -y -ss 2.5 -i "$T/aditivo.mp4"    -frames:v 1 "$O/aditivo.png"
ffmpeg -loglevel error -y -ss 8   -i "$T/projetos.mp4"   -frames:v 1 "$O/projeto.png"
ffmpeg -loglevel error -y -ss 1   -i "$T/obra.mp4"       -frames:v 1 "$O/obra.png"
ffmpeg -loglevel error -y -ss 5   -i "$T/cronograma.mp4" -frames:v 1 "$O/cronograma.png"
