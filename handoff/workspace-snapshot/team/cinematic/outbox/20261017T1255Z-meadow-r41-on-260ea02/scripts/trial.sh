#!/bin/bash
# usage: trial.sh '<V json>'
cd /workspace/tmp-lkcam/rh2 && echo "$1" > V.json && python3 mkline.py 2>/dev/null && python3 - <<'PY'
import json,re
pts=json.load(open('line_try.json'))
p='/workspace/tmp-lkcam/wt-r4/creator-build-project/assets/scripts/region/RegionJourneyLayout.ts';s=open(p).read()
s=re.sub(r"export const MEADOW_STAND_LOCAL:ReadonlyArray<Vec>=\[.*?\];","export const MEADOW_STAND_LOCAL:ReadonlyArray<Vec>="+json.dumps(pts).replace(' ','')+";",s,flags=re.S)
open(p,'w').write(s)
PY
source /workspace/tmp-lkcam/env.sh; node stops8.cjs | head -7 | awk '{print $1,$3,$7}' | tr '\n' ';'; echo
cd /workspace/tmp-lkcam/wt-r4/tools/journey-integration
for t in journey-framing journey-occlusion; do node test-$t.cjs > /tmp/tr_$t.log 2>&1; echo "$t $? $(rg -o '"error": "[^"]{0,120}' /tmp/tr_$t.log | head -2 | tr '\n' ' ')"; done
