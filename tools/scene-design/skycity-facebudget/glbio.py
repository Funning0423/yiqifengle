"""env_skycity.glb read / face-removal rewrite (DracoPy). Positions in the glb (= Cocos local, Y-up)."""
import json,struct,numpy as np,DracoPy
def load(f):
    b=open(f,'rb').read();jl=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+jl]);s=20+jl
    bl=struct.unpack('<I',b[s:s+4])[0];return j,bytes(b[s+8:s+8+bl])
def trs(n):
    if 'matrix' in n:return np.array(n['matrix'],float).reshape(4,4).T
    x,y,z,w=n.get('rotation',[0,0,0,1]);sx,sy,sz=n.get('scale',[1,1,1]);t=n.get('translation',[0,0,0])
    R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    M=np.eye(4);M[:3,:3]=R*np.array([sx,sy,sz]);M[:3,3]=t;return M
def world(j):
    par={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])}
    def W(i):
        M=trs(j['nodes'][i])
        while i in par:i=par[i];M=trs(j['nodes'][i])@M
        return M
    return W
def prims(j,bin_):
    """yield (node_name, prim_index, material_name, world_matrix, draco_mesh)"""
    W=world(j)
    for i,n in enumerate(j['nodes']):
        if 'mesh' not in n:continue
        for pi,p in enumerate(j['meshes'][n['mesh']]['primitives']):
            ext=p['extensions']['KHR_draco_mesh_compression'];bv=j['bufferViews'][ext['bufferView']]
            d=DracoPy.decode(bin_[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])
            yield n['name'],pi,j['materials'][p.get('material',0)]['name'],W(i),d
