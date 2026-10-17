#!/bin/bash
cd /workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/scripts
while pgrep -f "chain4.sh|chain5.sh|run3.sh" >/dev/null; do sleep 10; done
./run3.sh A_rail_crates B_snow_starmap C_cloud_terrace
python3 overview2.py > overview.log 2>&1
grep -h -E "CELL_PX|TRIS|Error" log_[ABCDE]_*.txt > qa_summary.txt
echo "ALL_V2_DONE $(date +%T)" >> run2_status.txt
