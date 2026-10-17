# usage: t541.sh "<nudge json or empty>" settle
R=/tmp/wt-b5/creator-build-project/assets/scripts/world-r1/RegionCameraData.ts
N="$1"; S="$2"
python3 - "$N" "$S" <<'P'
import re,sys;f='/tmp/wt-b5/creator-build-project/assets/scripts/world-r1/RegionCameraData.ts';s=open(f).read()
s=re.sub(r", nudge: \{[^}]*\}","",s)
if sys.argv[1]: s=s.replace("cruiseRampIn: 0.3 }","cruiseRampIn: 0.3, nudge: "+sys.argv[1]+" }",1)
s=re.sub(r"crane: \{ settleSeconds: [\d.]+,","crane: { settleSeconds: "+sys.argv[2]+",",s,1);open(f,'w').write(s)
P
bash chk.sh 2>&1 | tail -4; python3 pk.py
python3 -c "
import csv;R=list(csv.DictReader(open('/tmp/b5/B51.csv')));m=min(R,key=lambda r:float(r['clear']));print('minclr all',m['clear'],m['t'],m['clearMesh'])"
