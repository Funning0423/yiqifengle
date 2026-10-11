"""Check actual triangular proxy surfaces; a whole-room AABB falsely fills its interior."""
import json,math,pathlib,numpy as np
P=pathlib.Path('evidence/world-r5/camera-route-audit.json');report=json.loads(P.read_text());proxies=json.load(open('creator-build-project/assets/resources/firstslice/combined_collision_proxies.json'))['proxies']
def distances(points,proxy):
 m=np.array(proxy['world_matrix_column_major']).reshape(4,4).T
 best=np.full(len(points),np.inf)
 for prim in proxy['primitives']:
  verts=np.array(prim['positions_local_m']);verts=verts[:,0,None]*m[:3,0]+verts[:,1,None]*m[:3,1]+verts[:,2,None]*m[:3,2]+m[:3,3];assert np.isfinite(verts).all()
  for ids in np.array(prim['triangle_indices']).reshape(-1,3):
   a,b,c=verts[ids];ab=b-a;ac=c-a;n=np.cross(ab,ac);n2=np.dot(n,n)
   if n2<1e-18:continue
   ap=points-a;h=np.sum(ap*n,axis=1);project=points-h[:,None]*n/n2
   d00=np.dot(ab,ab);d01=np.dot(ab,ac);d11=np.dot(ac,ac);den=d00*d11-d01*d01
   if abs(den)<1e-18:continue
   v=(np.sum((project-a)*ab,axis=1)*d11-np.sum((project-a)*ac,axis=1)*d01)/den;w=(np.sum((project-a)*ac,axis=1)*d00-np.sum((project-a)*ab,axis=1)*d01)/den
   d=np.where((v>=0)&(w>=0)&(v+w<=1),h*h/n2,np.inf)
   for u,z in [(a,b),(b,c),(c,a)]:
    edge=z-u;t=np.clip(np.sum((points-u)*edge,axis=1)/np.dot(edge,edge),0,1);d=np.minimum(d,np.sum((points-u-t[:,None]*edge)**2,axis=1))
   best=np.minimum(best,d)
 return np.sqrt(best)
if __name__ == '__main__':
 for row in report['motionCandidateRows']:
  points=np.array([s['camera'] for s in row['samples']]);fixed=np.tile([-1.1,1.8,-2.9] if row['phase'] in ['stand','turn','walk-to-door','door-open','cross-out','walk-island'] else [-3.4,2.3,6.6],(len(points),1))
  pairs=[(distances(points,p)-.12,p['name']) for p in proxies if p['name']!='col_lighthouse_door_leaf'];fixedpairs=[(distances(fixed,p)-.12,p['name']) for p in proxies if p['name']!='col_lighthouse_door_leaf']
  value,name=min((float(x.min()),name) for x,name in pairs);row['cameraProxySurfaceMarginM']=value;row['nearestProxySurface']=name;row['surfaceSamples']=len(points)
  row.pop('cameraProxyMarginM',None);row.pop('nearestProxy',None);row['activeFixedCameraProxySurfaceMarginM']=min(float(x.min()) for x,_ in fixedpairs)
 report['limits'].append('Proxy surface check uses 21 exact saved time samples per phase, triangle distances, not filled room AABB. Signed volume containment is not certified. Door sweep still samples 501.')
 report['methodCorrection']='Whole merged wall AABB fills the room and is invalid for clearance. Replaced with actual triangle surface proximity.'
 P.write_text(json.dumps(report,indent=2));print(json.dumps([{k:v for k,v in r.items() if k!='samples'} for r in report['motionCandidateRows']],indent=2))
 
