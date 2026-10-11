import json,math,pathlib,numpy as np
from audit_camera_proxy_surfaces import distances,proxies
x=json.load(open('evidence/world-r5/camera-runtime-telemetry.json'));out=[]
bounds=[[-1.4404406547546387,0],[0,2.4023473262786865],[-.005699999630451202,.08500000089406967]]
def doorDistance(q,s):
 h=s['doorHinge'];a=math.radians(s['doorAngleDeg']);c,z=math.cos(a),math.sin(a);v=[q[i]-h[i] for i in range(3)];p=[c*v[0]-z*v[2],v[1],z*v[0]+c*v[2]]
 return math.sqrt(sum(max(lo-v,0,v-hi)**2 for v,(lo,hi) in zip(p,bounds)))
for run in x['runs']:
 points=np.array([s['camera'] for s in run['samples']]);prox=[(distances(points,p)-.12,p['name']) for p in proxies if p['name']!='col_lighthouse_door_leaf'];assert all(np.isfinite(d).all() for d,_ in prox)
 states=[]
 for state in dict.fromkeys(s['state'] for s in run['samples']):
  ids=[i for i,s in enumerate(run['samples']) if s['state']==state];samples=[run['samples'][i] for i in ids]
  side=[sum((s['camera'][j]-s['root'][j])*[-math.cos(s['rootYawRad']),0,math.sin(s['rootYawRad'])][j] for j in range(3)) for s in samples];margin,name=min((float(d[ids].min()),name) for d,name in prox)
  states.append({'state':state,'samples':len(samples),'rightProjectionMinM':min(side),'rightProjectionMaxM':max(side),'cameraDoorSphereMarginMinM':min(doorDistance(s['camera'],s)-.12 for s in samples),'cameraProxySurfaceMarginMinM':margin,'nearestProxy':name,'rootDoorCapsuleXZMarginMinM':min(doorDistance([s['root'][0],1,s['root'][2]],s)-.15 for s in samples),'doorAnglesDeg':[min(s['doorAngleDeg'] for s in samples),max(s['doorAngleDeg'] for s in samples)]})
 assert all(abs(s['doorHinge'][i]-[.7202203273773193,0,0][i])<1e-4 for s in run['samples'] for i in range(3));out.append({'mode':run['mode'],'hingeStableAndContractEqual':True,'states':states})
r={'status':'AUDIT_ONLY actual telemetry checked','runs':out,'cameraSphereRadiusM':.12,'rootDoorRadiusM':.15,'homeStatement':'Home is anatomical LEFT. Fixed mode is active default; its stationary home camera does not prove whole exit right-side safety.','doorStatement':'Hinge +X .720220327m, closed leaf extends -X, +Y rotation 0 to86.4 degrees swings free edge toward +Z; closes only after crossing-in.','scope':'Actual20Hz samples official final UI build, exact triangular proxy surface proximity + rotated door box. Positive sample margins do not certify swept intervals, signed containment, final B geometry/clothes/hand contacts, collider integration or phone safety.'}
pathlib.Path('evidence/world-r5/camera-runtime-envelope.json').write_text(json.dumps(r,indent=2))
print(json.dumps({'status':r['status'],'runs':[{'mode':i['mode'],'minCameraProxySurfaceMarginM':min(s['cameraProxySurfaceMarginMinM'] for s in i['states'])} for i in out]}))

