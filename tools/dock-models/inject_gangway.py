"""Inject sail_gangway into transport_sail/sailboat.glb (plain glb, keeps external textures/format).
Nodes: transport_sailboat > sail_gangway_hinge (port rail outer top, boat-local (0.80,0.585,0.15)) > sail_gangway (mesh, material 0 M_sailboat_hull,
transit palette UVs). The plank lies along hinge-local +x; hinge rotates about local z: +95 deg = stowed upright (default),
meadow deploy -16 deg (plank end underside at boat-local (1.38,0.35)); island deploy: hinge at (-0.80,0.585,0.15) yaw 180, +23 deg (end underside at (-1.40,0.77) = dock top -0.14 world with the boat at y -0.91).
python3 inject_gangway.py parts_sail_gangway.json sailboat.glb out.glb"""
import json,struct,sys,math
import numpy as np
parts,src,dst=sys.argv[1:4]
P=json.load(open(parts))['nodes']['sail_gangway']
b=open(src,'rb').read();jl=struct.unpack('<I',b[12:16])[0];g=json.loads(b[20:20+jl]);o=20+jl;bl=struct.unpack('<I',b[o:o+4])[0];bin_=bytearray(b[o+8:o+8+bl])
assert not any(n.get('name')=='sail_gangway' for n in g['nodes']),'already injected'
V=np.array(P['V'],np.float32);UV=np.array(P['UV'],np.float32);F=np.array(P['F'],np.int64)
# flat normals; vertices are already unshared per face
N=np.zeros_like(V)
for f in F:
    n=np.cross(V[f[1]]-V[f[0]],V[f[2]]-V[f[0]]);l=np.linalg.norm(n);N[f]=n/l if l>0 else [0,1,0]
# weld identical (pos,normal,uv) to shrink
key={};idx=[];W=[]
for i in range(len(V)):
    k=tuple(np.round(np.r_[V[i],N[i],UV[i]],5))
    if k not in key:key[k]=len(W);W.append(i)
    idx.append(key[k])
W=np.array(W);Vw,Nw,Uw=V[W],N[W],UV[W];I=np.array(idx,np.uint16)[F.reshape(-1)]
def add(arr,target=None):
    global bin_
    while len(bin_)%4:bin_.append(0)
    off=len(bin_);data=arr.tobytes();bin_+=data;bv={'buffer':0,'byteOffset':off,'byteLength':len(data)}
    if target:bv['target']=target
    g['bufferViews'].append(bv);return len(g['bufferViews'])-1
def acc(arr,typ,ct,target,mm=False):
    a={'bufferView':add(arr,target),'componentType':ct,'count':len(arr),'type':typ}
    if mm:a['min']=arr.min(0).tolist();a['max']=arr.max(0).tolist()
    g['accessors'].append(a);return len(g['accessors'])-1
pa=acc(Vw,'VEC3',5126,34962,True);na=acc(Nw,'VEC3',5126,34962);ta=acc(Uw,'VEC2',5126,34962);ia=acc(I,'SCALAR',5123,34963)
g['meshes'].append({'name':'sail_gangway','primitives':[{'attributes':{'POSITION':pa,'NORMAL':na,'TEXCOORD_0':ta},'indices':ia,'material':0}]})
mi=len(g['meshes'])-1
q=lambda deg:[0,0,math.sin(math.radians(deg)/2),math.cos(math.radians(deg)/2)]
g['nodes'].append({'name':'sail_gangway','mesh':mi});gi=len(g['nodes'])-1
g['nodes'].append({'name':'sail_gangway_hinge','translation':[0.80,0.585,0.15],'rotation':q(95),'children':[gi],
  'extras':{'stowedDeg':95,'meadowDeployDeg':-16,'islandHinge':[-0.80,0.585,0.15],'islandYawDeg':180,'islandDeployDeg':23,'lengthM':0.625,'widthM':0.5}})
hi=len(g['nodes'])-1
root=[i for i,n in enumerate(g['nodes']) if n.get('name')=='transport_sailboat'][0];g['nodes'][root]['children'].append(hi)
while len(bin_)%4:bin_.append(0)
g['buffers'][0]['byteLength']=len(bin_)
js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((4-len(js)%4)%4)
out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(bin_),0x004E4942)+bytes(bin_)
open(dst,'wb').write(out);print('verts',len(W),'tris',len(F),'bytes',len(b),'->',len(out))
