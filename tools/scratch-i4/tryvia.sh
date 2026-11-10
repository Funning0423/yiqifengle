#!/bin/bash
# $1 = replacement tail json e.g. [4.7,5.3],[5.0,4.9],[4.55,4.3]
f=tools/region-nodes/bake-region-nodes.cjs
python3 - "$1" <<'P'
import re,sys
p='tools/region-nodes/bake-region-nodes.cjs';s=open(p).read()
s=re.sub(r"\[3\.0,6\.3\],\[[^/]*?\]\]/\*", "[3.0,6.3],"+sys.argv[1]+"]/*",s,count=1)
open(p,'w').write(s)
P
grep -o "'I3-I4':[^/]*" $f
node $f >/dev/null 2>&1 && node tools/region-walkable/bake-region-walkable.cjs >/dev/null 2>&1
python3 tools/scratch-i4/vtx.py tools/region-nodes/region-nodes.json | grep "I3-I4"
node tools/scratch-i4/gate.cjs tools/region-nodes/region-nodes.json > /workspace/tmp-exp/dec/gate_try.json; python3 -c "
import json;v=json.load(open('/workspace/tmp-exp/dec/gate_try.json'))['I3-I4'];print({k:v[k] for k in v if k!='vegHits'},{k:x for k,x in v['vegHits'].items() if 'r10' not in k})"
python3 -c "
import json;e=[e for e in json.load(open('tools/region-nodes/region-nodes.json'))['island']['edges'] if e['a']=='I3'][0];print(e['path'])"
