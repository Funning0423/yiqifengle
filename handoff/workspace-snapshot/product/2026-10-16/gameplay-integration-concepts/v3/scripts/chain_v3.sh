#!/bin/bash
cd /workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/v3/scripts
./run4.sh B_snow_starmap D_hill_picnic E_sky_kite
python3 overview3.py > overview.log 2>&1
grep -h -E "CELL_PX|TRIS|Error" log_[ABCDE]_*.txt > qa_summary.txt
echo "V3_RENDERED $(date +%T)" >> status.txt
