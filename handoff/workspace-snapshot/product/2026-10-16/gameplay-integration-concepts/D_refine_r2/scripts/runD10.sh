#!/bin/bash
O=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/D_refine_r2; B=/home/box/apps/blender-5.2.2-linux-x64/blender
idle(){ q=0; while [ $q -lt 10 ]; do if pgrep -x blender >/dev/null || pgrep -f "/blender -b" >/dev/null; then q=0; else q=$((q+2)); fi; sleep 2; done; }
for M in "$@"; do idle; $B -b -t 6 -P $O/scripts/d_r2.py -- $M $O > $O/scripts/log_$M.txt 2>&1; echo "$M $(date +%T)" >> $O/scripts/status.txt; done
