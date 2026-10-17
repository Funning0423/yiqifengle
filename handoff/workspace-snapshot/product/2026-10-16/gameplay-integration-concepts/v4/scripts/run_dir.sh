#!/bin/bash
# 用法：nohup run_dir.sh <SCENE> <script.py> <title> [wait_file] &
S=$1; PY=$2; TITLE=$3; WAITF=$4
V=/workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/v4; B=/home/box/apps/blender-5.2.2-linux-x64/blender
O=$V/$S; mkdir -p $O; LOG=$V/scripts/status.txt
idle(){ q=0; while [ $q -lt 120 ]; do if pgrep -x blender >/dev/null || pgrep -f "/blender -b" >/dev/null || pgrep -f "^(/[^ ]*/)?blender " >/dev/null; then q=0; else q=$((q+10)); fi; sleep 10; done; }
echo "$S queued $(date +%T)" >> $LOG
if [ -n "$WAITF" ]; then while [ ! -f "$WAITF" ]; do sleep 30; done; echo "$S saw $WAITF $(date +%T)" >> $LOG; fi
idle; echo "$S blender start $(date +%T)" >> $LOG
$B -b -t 6 -P $V/scripts/$PY -- $S $O > $O/log_blender.txt 2>&1
grep -q DONE_SCENE $O/log_blender.txt || { echo "$S BLENDER_FAIL $(date +%T)" >> $LOG; exit 1; }
cd $V/scripts
python3 post2.py $O/raw_main.png $O/${S}_concept_720x1280.png
python3 post2.py $O/raw_mask.png $O/${S}_mask_720x1280.png
python3 annotate.py $O/${S}_concept_720x1280.png $O/cells.json $O/${S}_cells_720x1280.png "$TITLE" >> $O/log_post.txt 2>&1
python3 closesheet.py $O/${S}_closeups.jpg "$TITLE 近景验收" $O/raw_close_*.png >> $O/log_post.txt 2>&1
/workspace/tools/gltfpack/node_modules/.bin/gltfpack -i $O/_pkg_estimate.glb -o $O/_pkg_estimate_cc.glb -cc -noq >> $O/log_post.txt 2>&1
/workspace/tools/gltfpack/node_modules/.bin/gltfpack -i $O/_pkg_estimate.glb -o $O/_pkg_estimate_ccq.glb -cc >> $O/log_post.txt 2>&1
ls -l $O/_pkg_estimate*.glb >> $O/log_post.txt
echo "$S RENDERED $(date +%T)" >> $LOG
