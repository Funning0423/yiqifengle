#!/bin/bash
# 等 rainbow-bridge/DONE，再等连续 120 s 无 Blender，启动前复查
O=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/D_refine_r3b; B=/home/box/apps/blender-5.2.2-linux-x64/blender
RB=/workspace/wechat-game/product/2026-10-17/rainbow-bridge/DONE
busy(){ pgrep -f 'blender-5.2.2-linux-x64/blender' >/dev/null || pgrep -x blender >/dev/null; }
idle(){ while true; do q=0; while [ $q -lt 120 ]; do if busy; then q=0; else q=$((q+5)); fi; sleep 5; done; sleep 2; busy || break; done; }
while [ ! -f $RB ]; do sleep 15; done; echo "saw rainbow DONE $(date +%T)" >> $O/scripts/status.txt
for M in "$@"; do idle; echo "$M start $(date +%T)" >> $O/scripts/status.txt; $B -b -t 6 -P $O/scripts/d_r3b.py -- $M $O > $O/scripts/log_$M.txt 2>&1; echo "$M $(date +%T)" >> $O/scripts/status.txt; done
