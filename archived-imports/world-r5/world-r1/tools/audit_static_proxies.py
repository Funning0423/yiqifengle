"""Distance to individual source triangles, never a convex hull of disconnected proxies."""
import json,pathlib,numpy as np
R=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((R/'evidence/geometry.json').read_text());cfg=data['routes']
source=json.loads(pathlib.Path('/workspace/shared/grok-takeover/assets/portable-firstslice-v0.1/combined_collision_proxies.json').read_text())
def segment_distance(p,a,b):
 ab=b-a;t=np.sum((p-a)*ab,axis=1)/np.maximum(np.sum(ab*ab,axis=1),1e-30);q=a+np.clip(t,0,1)[:,None]*ab
 return np.linalg.norm(p-q,axis=1)
def point_triangles(p,tris):
 a,b,c=tris[:,0],tris[:,1],tris[:,2];ab=b-a;ac=c-a;normal=np.cross(ab,ac);nn=np.maximum(np.sum(normal*normal,axis=1),1e-30)
 d=np.sum((p-a)*normal,axis=1)/nn;q=p-d[:,None]*normal
 v=q-a;d00=np.sum(ab*ab,axis=1);d01=np.sum(ab*ac,axis=1);d11=np.sum(ac*ac,axis=1);d20=np.sum(v*ab,axis=1);d21=np.sum(v*ac,axis=1);den=d00*d11-d01*d01
 safe=np.where(abs(den)>1e-20,den,1)
 u=(d11*d20-d01*d21)/safe;w=(d00*d21-d01*d20)/safe
 inside=(abs(den)>1e-20)&(u>=0)&(w>=0)&(u+w<=1)
 edge=np.minimum.reduce([segment_distance(p,a,b),segment_distance(p,b,c),segment_distance(p,c,a)])
 return np.where(inside,abs(d)*np.sqrt(nn),edge)
proxies=[]
for proxy in source['proxies']:
 if proxy['name'] in ['col_lighthouse_door_leaf','col_int_floor_walkable']:continue
 m=np.array(proxy['world_matrix_column_major']).reshape(4,4,order='F');tris=[]
 for prim in proxy['primitives']:
  vs=np.array(prim['positions_local_m']);vs=np.c_[vs,np.ones(len(vs))]@m.T;idx=np.array(prim['triangle_indices']).reshape(-1,3);tris.extend(vs[idx,:3])
 proxies.append((proxy['name'],np.array(tris)))
def sample(path,step=.01):
 for a,b in zip(path,path[1:]):
  a,b=np.array(a),np.array(b);n=max(1,int(np.ceil(np.linalg.norm(b-a)/step)))
  for t in np.linspace(0,1,n+1):yield a+(b-a)*t
results=[]
for name,path in [('camera-pre-turn',[cfg['cameraHome']['position'],cfg['cameraToDoor'][0]['position']]),('camera-stand-to-door',[x['position'] for x in cfg['cameraToDoor']]),('camera-door-to-outside',[cfg['cameraInside']['position'],cfg['cameraOutside']['position']]),('camera-return-to-seat',[cfg['cameraInside']['position'],cfg['cameraHome']['position']]),('camera-outside-to-island',[cfg['cameraOutside']['position'],cfg['cameraIsland']['position']])]:
 minimum=(float('inf'),None,None)
 for p in sample(path):
  for proxy,tris in proxies:
   dist=float(np.min(point_triangles(p,tris)))-.12
   if dist<minimum[0]:minimum=(dist,proxy,p.tolist())
 # Lipschitz distance bound, max nearest sample along rail is <= .005m.
 results.append({'track':name,'sampledSphereClearanceM':minimum[0],'conservativeContinuousClearanceM':minimum[0]-.005,'nearestProxy':minimum[1],'position':minimum[2]})
report={'scope':'Candidate camera sphere vs actual 12 static interior proxy triangle meshes; ground surface and moving door handled separately. Exterior collision GLBs and visual occlusion NOT validated.','sphereRadiusM':.12,'sampleSpacingMaxM':.01,'results':results}
(R/'evidence/static-proxy-geometry.json').write_text(json.dumps(report,indent=2)+'\n')
for x in results:print(x)
assert all(x['conservativeContinuousClearanceM']>.03 for x in results),'Camera static-proxy clearance failed'
