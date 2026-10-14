"""Validate the shipped derivative's physical wind domain and root/tip colours."""
import json, math, struct
from pathlib import Path
p=Path(__file__).resolve().parents[2]/'creator-build-project/assets/bundles/region_meadow/env_meadow.glb'
b=p.read_bytes();size=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+size]);blob=b[28+size:]
def values(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n=int(a['type'][-1]);assert a['componentType']==5126
 offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*4)
 return [struct.unpack_from('<'+'f'*n,blob,offset+j*stride)for j in range(a['count'])]
rows=[]
for m in g['meshes']:
 if 'grass_instances' not in m['name']:continue
 for p in m['primitives']:
  uv=values(p['attributes']['TEXCOORD_1']);colors=values(p['attributes']['COLOR_0'])
  assert all(all(math.isfinite(v)for v in row)for row in uv+colors)
  assert min(x[0]for x in uv)==0 and max(x[0]for x in uv)==1
  assert all(0<=c[3]<=1 for c in colors), 'wind amplitude must be a unit value'
  assert max(abs(x[1])for x in uv)<64, 'phase must be in radians, not UNORM16 codes'
  displacement=max(c[3]*1.5*u[0]**2*.62 for c,u in zip(colors,uv));assert displacement<.7
  roots=[c[:3]for c,u in zip(colors,uv)if u[0]==0];tips=[c[:3]for c,u in zip(colors,uv)if u[0]==1]
  assert roots and tips and sum(sum(c)for c in roots)/len(roots)<sum(sum(c)for c in tips)/len(tips)
  rows.append({'mesh':m['name'],'vertices':len(uv),'maxWindMetres':displacement})
assert len(rows)==5
print(json.dumps({'status':'PASS','meshes':rows},indent=2))
