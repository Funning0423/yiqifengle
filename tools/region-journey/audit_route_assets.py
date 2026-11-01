"""Read-only sampled geometry audit. Requires numpy; does not prove rendered contact or shader correctness."""
import json,struct,pathlib,hashlib,numpy as np
f=pathlib.Path('creator-build-project/assets/bundles/region_meadow/env_meadow.glb');b=f.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);o=20+n;nb=struct.unpack_from('<I',b,o)[0];blob=b[o+8:o+8+nb]
def read(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];size={'VEC3':3,'SCALAR':1}[a['type']];stride=v.get('byteStride',np.dtype(dt).itemsize*size);return np.ndarray((a['count'],size),dtype=dt,buffer=blob,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,np.dtype(dt).itemsize)).copy()
triangles=[]
for name in ['meadow_terrain','meadow_river','meadow_river_bank']:
 node=next(x for x in g['nodes'] if x.get('name')==name)
 for p in g['meshes'][node['mesh']]['primitives']:
  pos=read(p['attributes']['POSITION']);idx=read(p['indices']).flatten();triangles.append(pos[idx].reshape(-1,3,3))
tri=np.concatenate(triangles)
A=tri[:,0];B=tri[:,1];C=tri[:,2];den=(B[:,2]-C[:,2])*(A[:,0]-C[:,0])+(C[:,0]-B[:,0])*(A[:,2]-C[:,2]);valid=abs(den)>1e-10
A=A[valid];B=B[valid];C=C[valid];den=den[valid]
def height(x,z):
 u=((B[:,2]-C[:,2])*(x-C[:,0])+(C[:,0]-B[:,0])*(z-C[:,2]))/den;v=((C[:,2]-A[:,2])*(x-C[:,0])+(A[:,0]-C[:,0])*(z-C[:,2]))/den;good=(u>=-1e-6)&(v>=-1e-6)&(u+v<=1+1e-6)
 return float(np.max((u*A[:,1]+v*B[:,1]+(1-u-v)*C[:,1])[good])) if np.any(good) else None
start=[-2.1135,0,5.2814];edgez=start[2]+3.2
dz=24;dy=0;tz=edgez+dz+20;ty=dy-1.16349411;vals=[]
for x in np.linspace(-6,10,65):
 for z in np.linspace(-8.2,12,83):
  h=height(-(x-start[0]),tz-z)
  if h is not None:vals.append(h+ty)
clear=[]
for t in np.linspace(0,1,513):
 wz=edgez+dz*t;wy=dy*t+np.sin(np.pi*t)*2;h=height(0,tz-wz)
 if h is not None:clear.append(wy-h-ty)
# Authored anchors already use metre-space with identity scene_root in the current GLB.
anchors={x.get('name'):x.get('translation',[0,0,0]) for x in g['nodes']}
def length(points):return sum(float(np.linalg.norm(np.array(b)-np.array(a))) for a,b in zip(points,points[1:]))
bridge=[[0,2*np.sin(np.pi*i/32),24*i/32] for i in range(33)]
meadow_approach=[anchors['walk_path_%02d'%i] for i in range(2,9)]
sky_bridge=[[0,12*i/32+2*np.sin(np.pi*i/32),24*i/32] for i in range(33)]
report={'status':'SAMPLED_SOURCE_GEOMETRY_NOT_VISUAL_ACCEPTANCE','meadowSHA256':hashlib.sha256(b).hexdigest(),
 'sampledMeshes':['meadow_terrain','meadow_river','meadow_river_bank'],
 'islandFootprintSamples':65*83,'maximumTargetGroundYUnderIslandFootprintM':max(vals),'islandSeaY':-.918544590473175,
 'bridgeSamples':513,'minimumBridgeCentrelineClearanceM':min(clear),'bridgeEndToleranceM':1e-5,
 'sourceAndTargetScale':1,'meadowRigidOffsetFromBridgeStart':[0,0,24],
 'candidateSeconds':{'islandToMeadow':(3.2+length(bridge)+length([anchors['walk_path_%02d'%i] for i in range(3)]))/1.2,
 'meadowToSkyEntry':(length(meadow_approach)+length(sky_bridge)+2.4)/1.2},
 'limitations':['Sampled original GLB positions; no Cocos imported-mesh test','Not continuous triangle proof','No sky-city rock/terrain overlap audit','No camera occlusion or visual approval','No final character contact/foot sliding approval']}
assert max(vals)<report['islandSeaY']
assert min(clear)>-1e-5
out=pathlib.Path('evidence/region-journey-20261015/source-geometry-samples.json');out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
