#!/bin/bash
# 自制原创: synth -> 测 LUFS -> 增益到 -21 LUFS -> 64k mono mp3
set -e; D=$(dirname "$0")
python3 $D/synth_sfx_transition.py /tmp/raw.npy
python3 -c "import numpy as n,wave;x=n.load('/tmp/raw.npy');x=x/n.abs(x).max()*0.5;w=wave.open('/tmp/raw.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100);w.writeframes((x*32767).astype('<i2').tobytes())"
I=$(ffmpeg -hide_banner -i /tmp/raw.wav -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
G=$(python3 -c "print(-20.4-($I))")
ffmpeg -y -v error -i /tmp/raw.wav -af "volume=${G}dB,alimiter=limit=0.7:level=false" -ac 1 -ar 44100 -c:a libmp3lame -b:a 64k -write_xing 1 $D/sfx_transition_island_to_meadow.mp3
