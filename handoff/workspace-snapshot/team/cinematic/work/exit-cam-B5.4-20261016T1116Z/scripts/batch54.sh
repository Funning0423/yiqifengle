#!/bin/bash
# resumable: renders missing 10 fps frames in batches of 20, one blender at a time
cd /tmp/b52
for n in B54; do
  while true; do
    python3 - $n <<'PY' || break
import json,os,sys
n=sys.argv[1];j=json.load(open(f'job53_{n}.json'));F=json.load(open(j['frames']))['frames'];N=int(round(F[-1]['t']*10))+1
miss=[k for k in range(N) if not os.path.exists(f'/tmp/b53v10/{n}_046_{k:04d}.png')]
if not miss: sys.exit(1)
j.update(fps=10,outdir='/tmp/b53v10',indices=miss[:20]);json.dump(j,open(f'/tmp/b52/batch_{n}.json','w'))
PY
    nice -n 19 blender -b -t 4 -P render52.py -- batch_$n.json >> /tmp/b53v10/$n.log 2>&1
  done
done
echo ALLDONE > /tmp/b53v10/done54
