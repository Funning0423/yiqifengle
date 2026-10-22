# 从 v3b GLB 取 BODY 的 lantern_hold_R 形变（支持 sparse accessor），存成 prim%d 格式 npz
import sys,numpy as np
sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import load,acc
def sacc(J,B,i):
    a=J['accessors'][i]
    if 'bufferView' in a:return acc(J,B,i)
    out=np.zeros((a['count'],3),np.float32);s=a['sparse'];I=s['indices'];V=s['values']
    def raw(bvi,off,dt,n):
        bv=J['bufferViews'][bvi];return np.frombuffer(B,dt,count=n,offset=bv.get('byteOffset',0)+off)
    dt={5121:np.uint8,5123:np.uint16,5125:np.uint32}[I['componentType']]
    idx=raw(I['bufferView'],I.get('byteOffset',0),dt,s['count']);val=raw(V['bufferView'],V.get('byteOffset',0),np.float32,s['count']*3).reshape(-1,3)
    out[idx]=val;return out
J,B=load(sys.argv[1]);m=[x for x in J['meshes'] if x['name']=='LOD0_G2_BODY'][0];ti=m['extras']['targetNames'].index('lantern_hold_R')
out={'prim%d'%i:sacc(J,B,p['targets'][ti]['POSITION']) for i,p in enumerate(m['primitives'])}
for k,v in out.items():print(k,v.shape,'nz',int((np.abs(v).sum(1)>0).sum()),'max',float(np.abs(v).max()))
np.savez(sys.argv[2],**out)
J2,B2=load(sys.argv[3]);m2=[x for x in J2['meshes'] if x['name']=='LOD0_G2_BODY'][0]
for p,q in zip(m['primitives'],m2['primitives']):
    a=acc(J,B,p['attributes']['POSITION']);b=acc(J2,B2,q['attributes']['POSITION']);print('base',a.shape,b.shape,float(np.abs(a-b).max()) if a.shape==b.shape else 'diff')
