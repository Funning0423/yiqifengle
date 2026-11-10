cd /workspace/tmp-exp/wt-rb
node tools/scratch-i4/dEval.cjs "$1" > /tmp/d.json 2>/tmp/d.err; git checkout -q creator-build-project tools/region-nodes tools/region-walkable 2>/dev/null
python3 - <<'P'
import json,sys
t=open('/tmp/d.json').read().strip()
if not t: print(open('/tmp/d.err').read()[-600:]);sys.exit()
r=json.loads(t)
if 'err' in r: print(r);sys.exit()
tr={k[:10]:v for k,v in r['trunk'].items() if v<1.6}
print('inAv',r['inAvoid'],r['avoidMarginM'],'SP',r['SP'],'I3',r['I3'],'curve',r['curveM'],r['curveS'],'legs',r['legs'],'unw',r['unwalkable'],r['unwSample'],'trunk',tr,'clip',list(r['clip']),'head',r['headroom'],[h[1] for h in r['headSample']][:1],
 'stand',round(r['stand']['push']['hf']),round(r['stand']['board']['hf']),'lean',[e['peak'] for e in r['leanPush']],'fol',r['follow'][:8],'headAt',[h[0] for h in r['headSample']],'23',r['I2I3']['len'],r['I2I3']['clip'],{k[:10]:v for k,v in r['I2I3']['trunk'].items() if v<1})
P
