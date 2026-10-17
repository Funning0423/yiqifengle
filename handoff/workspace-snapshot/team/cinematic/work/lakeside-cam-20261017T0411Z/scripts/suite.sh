#!/bin/bash
# usage: suite.sh <worktree> <outlog>   (resumable: skips if <outlog>.done exists)
W=$1; O=$2; [ -f "$O.done" ] && exit 0
. /workspace/tmp-lkcam/env.sh
cd $W && nice -n 19 node tools/journey-integration/run-suite.cjs > $O 2>&1; echo "exit $?" >> $O
cp tools/journey-integration/reports/summary.json $O.summary.json 2>/dev/null
git checkout -- output tools/journey-integration/reports 2>/dev/null; git clean -fdq tools/journey-integration/reports
touch $O.done
