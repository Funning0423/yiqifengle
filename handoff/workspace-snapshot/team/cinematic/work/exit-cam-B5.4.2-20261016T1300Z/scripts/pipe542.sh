#!/bin/bash
# B5.4.2 resumable pipeline: final still -> 10 fps frames B542, B53 -> sequential frame tests. Skip-existing everywhere, one job at a time.
cd /tmp/b52; mkdir -p /tmp/b542v10
[ -f /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.2-20261016T1300Z/stills/B542_final_0.46_471x1024.png ] || nice -n 19 blender -b -t 4 -P pose_still.py -- j542f.json > /tmp/b542v10/still.log 2>&1
for n in B542 B53; do
  while true; do
    python3 - $n <<'PY' || break
import json,os,sys
n=sys.argv[1];j=json.load(open(f'job53_{n}.json'));F=json.load(open(j['frames']))['frames'];N=int(round(F[-1]['t']*10))+1
miss=[k for k in range(N) if not os.path.exists(f'/tmp/b542v10/{n}_046_{k:04d}.png')]
if not miss: sys.exit(1)
j.update(fps=10,outdir='/tmp/b542v10',indices=miss[:20]);json.dump(j,open(f'/tmp/b52/batch_{n}.json','w'))
PY
    nice -n 19 blender -b -t 4 -P render52.py -- batch_$n.json >> /tmp/b542v10/$n.log 2>&1
  done
done
touch /tmp/b542v10/renders.done
nice -n 19 bash /tmp/b5/seqtests.sh
echo ALLDONE > /tmp/b542v10/done542
