"""Minimal offline glTF-binary reader (nodes, world matrices, triangles, animations). No deps beyond numpy."""
import json,struct,numpy as np
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def q2m(q):
    x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
class GLB:
    def __init__(s,path):
        b=open(path,'rb').read();n=struct.unpack_from('<I',b,12)[0]
        s.j=json.loads(b[20:20+n]);o=20+n;s.bin=b[o+8:o+8+struct.unpack_from('<I',b,o)[0]] if o<len(b) else b''
        s.parent={};[s.parent.__setitem__(c,i) for i,nd in enumerate(s.j['nodes']) for c in nd.get('children',[])]
    def acc(s,i):
        a=s.j['accessors'][i];v=s.j['bufferViews'][a['bufferView']];dt=CT[a['componentType']];k=NC[a['type']]
        st=v.get('byteStride',0);off=v.get('byteOffset',0)+a.get('byteOffset',0);cnt=a['count'];isz=np.dtype(dt).itemsize
        if st and st!=k*isz:
            arr=np.array([np.frombuffer(s.bin,dt,k,off+st*e) for e in range(cnt)])
        else: arr=np.frombuffer(s.bin,dt,cnt*k,off).reshape(cnt,k)
        if a.get('normalized'):arr=arr.astype(float)/np.iinfo(dt).max
        return arr.astype(float)
    def local(s,i):
        nd=s.j['nodes'][i];M=np.eye(4)
        if 'matrix' in nd:return np.array(nd['matrix']).reshape(4,4).T
        M[:3,:3]=q2m(nd.get('rotation',[0,0,0,1]))*np.array(nd.get('scale',[1,1,1]));M[:3,3]=nd.get('translation',[0,0,0]);return M
    def world(s,i):
        M=s.local(i)
        while i in s.parent:i=s.parent[i];M=s.local(i)@M
        return M
    def idx(s,name):
        for i,nd in enumerate(s.j['nodes']):
            if nd.get('name')==name:return i
    def names(s):return [nd.get('name') for nd in s.j['nodes']]
    def tris(s,i,M=None):
        nd=s.j['nodes'][i];
        if 'mesh' not in nd:return np.zeros((0,3,3))
        M=s.world(i) if M is None else M;out=[]
        for p in s.j['meshes'][nd['mesh']]['primitives']:
            if p.get('mode',4)!=4 or 'POSITION' not in p['attributes']:continue
            P=s.acc(p['attributes']['POSITION']);P=P@M[:3,:3].T+M[:3,3]
            I=s.acc(p['indices']).astype(int).ravel() if 'indices' in p else np.arange(len(P))
            out.append(P[I.reshape(-1,3)])
        return np.concatenate(out) if out else np.zeros((0,3,3))
    def subtree(s,i):
        r=[i]
        for c in s.j['nodes'][i].get('children',[]):r+=s.subtree(c)
        return r
    def all_tris(s,root=None,Mroot=None):
        ids=range(len(s.j['nodes'])) if root is None else s.subtree(root)
        T=[s.tris(i) for i in ids];T=[t for t in T if len(t)]
        T=np.concatenate(T) if T else np.zeros((0,3,3))
        return T
    def anims(s):
        out={}
        for a in s.j.get('animations',[]):
            mx=0
            for sm in a['samplers']:mx=max(mx,s.j['accessors'][sm['input']].get('max',[0])[0])
            out[a.get('name')]=mx
        return out
