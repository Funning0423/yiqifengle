import pathlib,sys,json,numpy as np,hashlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'art-src/animation/mocap/scripts'));import rig as R
old=pathlib.Path('/Users/shineanl/Documents/Codex/2026-10-14/task-10/character-fix/creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb');new=pathlib.Path(__file__).resolve().parents[1]/'creator-build-project/assets/bundles/region_island/character'/old.name;a=R.Rig(str(old));b=R.Rig(str(new));rows=[];meshChanges=[]
for mi,m in enumerate(a.J['meshes']):
 for pi,pr in enumerate(m['primitives']):
  newpr=b.J['meshes'][mi]['primitives'][pi];assert pr['indices']==newpr['indices'] and pr.get('targets')==newpr.get('targets')
  for attr,ai in pr['attributes'].items():
   oldArr=R.acc(a.J,a.BIN,ai);newArr=R.acc(b.J,b.BIN,newpr['attributes'][attr]);ix=np.where(np.any(oldArr!=newArr,axis=1))[0]
   if len(ix):
    assert m['name']=='LOD0_G2_BODY' and attr in ['POSITION','JOINTS_0','WEIGHTS_0'];meshChanges.append({'mesh':m['name'],'primitive':pi,'attribute':attr,'count':len(ix),'vertices':ix.tolist()})
    if attr=='POSITION':
     joints=R.acc(a.J,a.BIN,pr['attributes']['JOINTS_0']);weights=R.acc(a.J,a.BIN,pr['attributes']['WEIGHTS_0']);handIds=[a.idx['hand.L'],a.idx['hand.R']];assert all(any(int(q) in handIds and w>.1 for q,w in zip(joints[v],weights[v])) for v in ix)

assert a.J['nodes']==b.J['nodes'] and a.J['skins']==b.J['skins'] and a.J['materials']==b.J['materials']
assert np.array_equal(a.ibm,b.ibm)
for name in a.clips:
 ts=np.linspace(0,a.clip_duration(name),int(a.clip_duration(name)*120)+1);Ta,Qa,Sa=a.sample_clip(name,ts);Tb,Qb,Sb=b.sample_clip(name,ts);assert np.array_equal(Ta,Tb) and np.array_equal(Sa,Sb)
 changed=[n for k,n in enumerate(a.names) if not np.array_equal(Qa[:,k],Qb[:,k])]
 assert not changed if name!='door_reach' else set(changed)=={'forearm.L','hand.L'}
 wa=a.fk(Ta,Qa,Sa);wb=b.fk(Tb,Qb,Sb);h=a.idx['hand.L'];err=np.max(np.linalg.norm(wa[:,h,:3,3]-wb[:,h,:3,3],axis=1))*1000
 rows.append({'clip':name,'changedRotationBones':changed,'handWorldDeltaMm120Hz':float(err)})
 if name=='door_reach':assert err<.3
report={'status':'PASS_CANDIDATE_SCOPE_AND_CONTACT_CPU','baselineSHA256':hashlib.sha256(old.read_bytes()).hexdigest(),'candidateSHA256':hashlib.sha256(new.read_bytes()).hexdigest(),'nodesSkinMaterialsUnchanged':True,'meshChanges':meshChanges,'normalsUVColorsTopologyMorphUnchanged':True,'clips':rows,'visualAcceptance':'separate; this test does not certify appearance'}
print(json.dumps(report,indent=2))
