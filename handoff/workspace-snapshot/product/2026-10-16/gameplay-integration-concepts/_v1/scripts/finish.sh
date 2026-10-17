#!/bin/bash
D=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts
while [ ! -f $D/scripts/run_status.txt ]; do sleep 30; done
python3 $D/scripts/overview.py > $D/scripts/overview.log 2>&1
grep -h -E "CELL_PX|TRIS|Error" $D/scripts/log_*.txt > $D/scripts/qa_summary.txt
touch $D/DONE
