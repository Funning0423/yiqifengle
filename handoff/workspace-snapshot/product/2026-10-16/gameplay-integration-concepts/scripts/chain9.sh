#!/bin/bash
cd /workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/scripts
./run3.sh D_hill_picnic E_sky_kite
python3 overview2.py > overview.log 2>&1
grep -h -E "CELL_PX|TRIS|Error" log_[ABCDE]_*.txt > qa_summary.txt
echo "ALL_V2b_DONE $(date +%T)" >> run2_status.txt
