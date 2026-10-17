#!/bin/bash
O=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/D_refine_r3; B=/home/box/apps/blender-5.2.2-linux-x64/blender
busy(){ pgrep -x blender >/dev/null || pgrep -f "/blender -b" >/dev/null || pgrep -f "^(/[^ ]*/)?blender " >/dev/null; }
idle(){ while true; do q=0; while [ $q -lt 20 ]; do if busy; then q=0; else q=$((q+2)); fi; sleep 2; done; sleep 1; busy || break; done; }
for M in "$@"; do idle; echo "$M start $(date +%T)" >> $O/scripts/status.txt; $B -b -t 6 -P $O/scripts/d_r3.py -- $M $O > $O/scripts/log_$M.txt 2>&1; echo "$M $(date +%T)" >> $O/scripts/status.txt; done
