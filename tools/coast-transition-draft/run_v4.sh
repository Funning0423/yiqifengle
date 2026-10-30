#!/bin/sh
# v4: official coast board lens; one trajectory per screen (per-aspect board distance). Before = same scene with the v3 end pose.
cd "$(dirname "$0")"
for s in 390x844 414x896 360x780 375x667 320x568 390x520 768x1024; do
  FIT=r5d SCREEN=$s python3 reanchor.py --end-shot > /dev/null || exit 1
  FIT=r5d SCREEN=$s BOARD_OLD=1 T_S7=5.0 python3 reanchor.py --end-shot > /dev/null || exit 1
done
FIT=r5d SCREEN=390x844 python3 reanchor.py --render > /dev/null
