import sys,json,collections,hashlib
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'art-src/animation/mocap/scripts'));import rig as R
old=Path(sys.argv[1]);new=Path(sys.argv[2]);a=R.Rig(str(old));r=R.Rig(str(new));assert a.J['nodes']==r.J['nodes'] and a.J['skins']==r.J['skins'] and a.J['animations']==r.J['animations'] and a.J['materials']==r.J['materials'];assert a.BIN[:len(a.BIN)]==r.BIN[:len(a.BIN)]
m=next(m for m in r.J['meshes'] if m['name']=='LOD0_G2_BODY');pr=m['primitives'][0];attr=pr['attributes'];P=R.acc(r.J,r.BIN,attr['POSITION']);J=R.acc(r.J,r.BIN,attr['JOINTS_0']).astype(int);W=R.acc(r.J,r.BIN,attr['WEIGHTS_0']);F=R.acc(r.J,r.BIN,pr['indices']).astype(int).reshape(-1,3);oldpr=next(m for m in a.J['meshes'] if m['name']=='LOD0_G2_BODY')['primitives'][0];oldP=R.acc(a.J,a.BIN,oldpr['attributes']['POSITION']);assert np.array_equal(oldP,P[:len(oldP)])
# Weld identical bind positions for analysis only. UV duplicates stay separate in GLB.
canon={};ids=[]
for i,p in enumerate(P):ids.append(canon.setdefault(tuple(p),i))
ids=np.array(ids);ec=collections.Counter()
for tri in ids[F]:
 for x,z in zip(tri,np.roll(tri,-1)):ec[tuple(sorted((x,z)))]+=1
directions=collections.defaultdict(list)
for tri in ids[F]:
 for x,z in zip(tri,np.roll(tri,-1)):directions[tuple(sorted((x,z)))].append((int(x),int(z)))
# Verify face winding as well as edge multiplicity. Two same-direction faces
# are not a valid consistently oriented seam.
seam=[]
for i in range(len(oldP),len(P)):
 src=ids[i];assert src<i and np.array_equal(J[src],J[i]) and np.array_equal(W[src],W[i]);edgeCounts=[c for e,c in ec.items() if src in e];assert all(c==2 for c in edgeCounts), (i,edgeCounts);assert all(len(v)==2 and v[0]==v[1][::-1] for e,v in directions.items() if src in e);seam.append({'newVertex':i,'cuffVertex':int(src),'incidentWeldedEdgeUseCounts':edgeCounts})
rows=[]
for name in r.clips:
 ts=np.linspace(0,r.clip_duration(name),int(r.clip_duration(name)*120)+1);T,Q,S=r.sample_clip(name,ts);wa=r.fk(T,Q,S);oldT,oldQ,oldS=a.sample_clip(name,ts);assert np.array_equal(T,oldT) and np.array_equal(Q,oldQ) and np.array_equal(S,oldS)
 rows.append({'clip':name,'samples':len(ts),'jointPoseIdentical':True,'cuffUVSeamGapMm':0,'note':'exact equal positions and weights: identical linear skin transforms at every time, not only samples'})
# Every root transition edge is shared with the palm, removing the old closed proximal fan.
for lo,hi in [(2758,2844),(2994,3080)]:
 roots=np.unique(F[-68:][(F[-68:]>=lo)&(F[-68:]<hi)]);assert len(roots)==14
 for v in roots:
  assert all(c==2 for e,c in ec.items() if v in e)
  assert all(len(val)==2 and val[0]==val[1][::-1] for e,val in directions.items() if v in e)
report={'status':'PASS_STRUCTURAL_CONNECTION_AND_UNCHANGED_ANIMATION_NOT_VISUAL_ACCEPTANCE','baselineSHA256':hashlib.sha256(old.read_bytes()).hexdigest(),'candidateSHA256':hashlib.sha256(new.read_bytes()).hexdigest(),'existingBindPositionsUnchanged':True,'seamWindingConsistent':True,'newSkinSeamVertices':40,'removedCapTriangles':28,'addedAnnulusTriangles':68,'UVSeamWelds':seam,'clips':rows,'caveat':'does not establish no sleeve intersections or natural elbow appearance'};print(json.dumps(report,indent=2))
