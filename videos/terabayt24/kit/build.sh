#!/bin/bash
# usage: build.sh vN  -> renders, mixes, muxes to vN/final.mp4
set -e
cd "$(dirname "$0")"
v=$1
node render.js http://127.0.0.1:8766/$v/index.html $v/silent.mp4 $v/sfx.json 60
python3 mix.py $v $v/mix.wav
ffmpeg -v error -y -i $v/silent.mp4 -i $v/mix.wav -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-14:TP=-1:LRA=11,aresample=48000" -c:a aac -b:a 256k -movflags +faststart -shortest $v/final.mp4
ffmpeg -v error -y -i $v/final.mp4 -vf "fps=1,scale=216:-1,tile=10x2" snaps/${v}final.png
echo "$v built"
