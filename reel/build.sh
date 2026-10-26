#!/usr/bin/env bash
# Build one reel end to end: voice -> timing -> soundtrack -> frames -> final mix.
# usage: ./build.sh videos/v2-limit [--keep-voice]     (needs AISHA_API_KEY or GEMINI_API_KEY per lines.json)
set -euo pipefail
cd "$1"; R=../..; NAME=$(basename "$PWD")
mkdir -p out
[ "${2:-}" = --keep-voice ] || python3 $R/gen_voice.py raw
python3 $R/plan.py raw
python3 $R/audio.py out/soundtrack.wav
node $R/render.js out/video-music.mp4 60 out/soundtrack.wav
python3 $R/mix.py voice out/video-music.mp4 "out/orzu-$NAME.mp4" out/soundtrack.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 "out/orzu-$NAME.mp4" | xargs printf "%s -> %.2fs\n" "out/orzu-$NAME.mp4"
