node tools/region-walkable/bake-region-walkable.cjs >/dev/null 2>&1 || echo WALKFAIL
python3 tools/scratch-i4/vtx.py tools/region-nodes/region-nodes.json
node tools/scratch-i4/gate.cjs tools/region-nodes/region-nodes.json > /workspace/tmp-exp/dec/gate_try.json; python3 -c "
import json
for k,v in json.load(open('/workspace/tmp-exp/dec/gate_try.json')).items():print(k,v['polyM'],v['pinS'],'av',v['avoidMargin']['d'],'y',v['yOverTerrainMax']['d'],'trunk',v['trunkMin'],{a:b for a,b in v['vegHits'].items() if 'r10' not in a})"; python3 -c "
import json
for e in json.load(open('tools/region-nodes/region-nodes.json'))['island']['edges']:print(e['a'],e['b'],e['lengthM'],e['path'])"
