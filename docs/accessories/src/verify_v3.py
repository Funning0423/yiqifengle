# 逐字节核对：base 的全部 accessor 数据、节点、skin、动画、材质/贴图在 out 中不变；BODY 只多 1 个目标
import sys,os,json,hashlib,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from glb import G
a=G(sys.argv[1]);b=G(sys.argv[2]);ja,jb=a.j,b.j;bad=[]
def h(g,i): return hashlib.sha256(g.full(i).tobytes()).hexdigest()
def raw(g,bv): v=g.j['bufferViews'][bv];return hashlib.sha256(bytes(g.b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).hexdigest()
for i in range(len(ja['accessors'])):
    if h(a,i)!=h(b,i): bad.append(('acc',i))
for i in range(len(ja['bufferViews'])):
    if raw(a,i)!=raw(b,i): bad.append(('bv',i))
for k in ('nodes','skins','animations','materials','textures','images','samplers','scenes'):
    if json.dumps(ja.get(k),sort_keys=True)!=json.dumps(jb.get(k),sort_keys=True): bad.append(k)
for ma,mb in zip(ja['meshes'],jb['meshes']):
    if ma['name']!='LOD0_G2_BODY':
        if json.dumps(ma,sort_keys=True)!=json.dumps(mb,sort_keys=True): bad.append(ma['name'])
    else:
        for pa,pb in zip(ma['primitives'],mb['primitives']):
            if pa['attributes']!=pb['attributes'] or pa['indices']!=pb['indices'] or pb['targets'][:-1]!=pa['targets'] or len(pb['targets'])!=len(pa['targets'])+1: bad.append('BODYprim')
        if mb['extras']['targetNames'][:-1]!=ma['extras']['targetNames']: bad.append('names')
print('VERIFY',json.dumps(dict(bad=bad,acc_checked=len(ja['accessors']),bv_checked=len(ja['bufferViews']),new_target=mb['extras']['targetNames'][-1] if False else jb['meshes'][[m['name'] for m in jb['meshes']].index('LOD0_G2_BODY')]['extras']['targetNames'][-1])))
