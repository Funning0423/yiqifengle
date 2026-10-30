#!/bin/sh
# v4 'old' artefacts for the gate negative check: S1 arc 2.0 s (S1V=1), S3 unchanged. QF_COAST_OUT=out_v4/old node test_coast_board_lens.cjs must FAIL.
cd "$(dirname "$0")"
for s in 390x844 414x896 360x780 375x667 320x568 390x520 768x1024; do FIT=r5d SCREEN=$s S1V=1 S3D=${S3D_OLD:-0,0,0} python3 reanchor.py --shot-at=0.62 > /dev/null || exit 1; mkdir -p out_v4/old/$s; mv out_v4/$s/frames.csv out_v4/$s/gates.json out_v4/$s/end_pose.json out_v4/$s/shot_0.62.png out_v4/old/$s/; done
