cd /workspace/tmp-exp/wt-rb
sed -i "33s#routeAvoid:\[.*\],#routeAvoid:$1,#" tools/region-nodes/bake-region-nodes.cjs
node tools/region-nodes/bake-region-nodes.cjs >/dev/null 2>/tmp/bk.err || { cat /tmp/bk.err|tail -1; }
node tools/scratch-i4/rv.cjs > /tmp/rv.json 2>&1
git checkout -q tools/region-nodes creator-build-project
python3 -c "
import json;a=json.load(open('/tmp/rv.json'))
for k in a['legs']: L=a['legs'][k];print(k,L['len'],L['s'],{n[:16]:v for n,v in L['trunk'].items() if v<1.5},{n[:16]:(c['minHorizM'],c['vertexHeightAboveFeet'],c['clip']) for n,c in L['clips'].items() if c['clip']})
print('stand',a['stand']['push']['hf'],a['stand']['board']['hf'],'lean',[e['peak'] for e in a['lean34']['ep']])"
