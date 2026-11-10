cd /workspace/tmp-exp/wt-rb; node tools/scratch-i4/nodeEval.cjs > /tmp/n.json 2>/tmp/n.err; git checkout -q tools/region-nodes creator-build-project
python3 -c "
import json;t=open('/tmp/n.json').read().strip()
if not t: print(open('/tmp/n.err').read()[-400:]);raise SystemExit
r=json.loads(t)
if 'err' in r: print(r);raise SystemExit
print(r['node'],r['at'])
for k,l in r['legs'].items(): print(' ',k,l['len'],l['s'],'min',l['minTrunk'],'tall01',l['tall01'],'bt',l['beachTall'],'clip',l['clip'],'head',l['head'],'unw',l['unw'],'inAv',l['inAvoid'],l['avoidMargin'],'fol',max([f[1] for f in l['follow']]+[0]),len(l['follow']))"
