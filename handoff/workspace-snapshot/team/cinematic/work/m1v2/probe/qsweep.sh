#!/bin/bash
cd /workspace/wechat-game/team/cinematic/work/m1v2
for w in 0.05; do STEP_WIDTH=$w ./probe/quick.sh sw${w}e; done
echo SWEEPDONE > probe/qsweep.done
