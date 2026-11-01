import sys,json,pathlib,numpy as np,hashlib
ROOT=pathlib.Path(__file__).resolve().parent;BASE=next(p for p in ROOT.parents if (p/'source').is_dir())
sys.path.insert(0,str(BASE/'sleeve-work'));import work as m
from work import R
sys.path.insert(0,str(BASE/'boot-work'));from glb_local import Glb
INPUT=pathlib.Path(sys.argv[1]).resolve();g=Glb(INPUT/'candidate.glb');r=R.Rig(str(INPUT/'candidate.glb'));rep=json.load(open(sys.argv[2]));data={};keyids={f['frame'] for f in rep['frames'] if int(sys.argv[4])<=f['frame']<=int(sys.argv[5])};rep['frames']=[f for f in rep['frames'] if f['frame'] in keyids]
for mesh in g.j['meshes']:
 name=mesh['name'];pr=mesh['primitives'][0];a=pr['attributes'];data[name]={'P':g.accessor(a['POSITION']).astype(float),'J':g.accessor(a['JOINTS_0']).astype(int),'W':g.accessor(a['WEIGHTS_0']).astype(float),'F':g.accessor(pr['indices']).astype(int).reshape(-1,3),'D':[g.accessor(t['POSITION']).astype(float) for t in pr.get('targets',[])]}
body=data['LOD0_G2_BODY'];handids=np.r_[np.arange(2758,3231),np.arange(4136,4176),np.arange(4449,4779)];hf=body['F'][np.all(np.isin(body['F'],handids),axis=1)]
cuffids=np.concatenate([np.concatenate(m.LS[side][:7]) for side in ['L','R']]);cuffF=body['F'][np.any(np.isin(body['F'],cuffids),axis=1)];sleeveF=body['F'][np.any(np.isin(body['F'],np.arange(1503,2543)),axis=1)]
region=np.r_[np.arange(1055,2543),np.arange(4176,4449)];m.tris=body['F'][np.all(np.isin(body['F'],region),axis=1)];canon=np.arange(len(body['P']));seen={}
for i,p in enumerate(body['P']):
 k=(tuple(p),tuple(zip(body['J'][i],body['W'][i])));canon[i]=seen.setdefault(k,i)
cf=canon[m.tris];m.allowed=np.triu(~np.any(cf[:,None,:,None]==cf[None,:,None,:],axis=(2,3)),1)
def cross_chunk(A,B):
 ii,jj=np.where(np.all((A.min(1)[:,None]<=B.max(1)[None])&(A.max(1)[:,None]>=B.min(1)[None]),axis=2));hit=np.zeros(len(ii),bool)
 for t1,t2 in [(A[ii],B[jj]),(B[jj],A[ii])]:
  e1=t2[:,1]-t2[:,0];e2=t2[:,2]-t2[:,0]
  for n in range(3):
   orig=t1[:,n];d=t1[:,(n+1)%3]-orig;h=np.cross(d,e2);det=np.einsum('ij,ij->i',e1,h);valid=abs(det)>=1e-10;iv=np.divide(1,det,out=np.zeros_like(det),where=valid);s=orig-t2[:,0];u=iv*np.einsum('ij,ij->i',s,h);q=np.cross(s,e1);v=iv*np.einsum('ij,ij->i',d,q);t=iv*np.einsum('ij,ij->i',e2,q);hit|=valid&(t>1e-6)&(t<1-1e-6)&(u>1e-6)&(v>1e-6)&(u+v<1-1e-6)
 return ii[hit],jj[hit]

sys.path.insert(0,str(BASE/'posture-work'));from triangle_cross import cross_chunk
def stats(A,B,amask=None,bmask=None):
 total=local=0
 if amask is None:amask=np.zeros(len(A),bool)
 if bmask is None:bmask=np.zeros(len(B),bool)
 for off in range(0,len(A),512):
  ii,jj=cross_chunk(A[off:off+512],B);total+=len(ii);local+=int((amask[ii+off]|bmask[jj]).sum())
 return {'totalPairs':total,'localSupportPairs':local}
report=json.load(open(BASE/'posture-work/posture21/support-report.json'));changed={name:np.isin(np.arange(len(data[name]['P'])),report[name]['ids']) for name in ['LOD0_G2_APRON','LOD0_G2_DRESS']};fm={name:np.any(changed[name][data[name]['F']],axis=1) for name in changed}
mesh=next(x for x in g.j['meshes'] if x['name']=='LOD0_G2_BODY');pr=mesh['primitives'][4];a=pr['attributes'];leg={'P':g.accessor(a['POSITION']).astype(float),'J':g.accessor(a['JOINTS_0']).astype(int),'W':g.accessor(a['WEIGHTS_0']).astype(float),'F':g.accessor(pr['indices']).astype(int).reshape(-1,3)};legbones=[r.idx[n] for n in ['thigh.L','thigh.R','shin.L','shin.R']];legvert=(body['W']*np.isin(body['J'],legbones)).sum(1)>.5;legmain=body['F'][np.all(legvert[body['F']],axis=1)];df=data['LOD0_G2_DRESS']['F'];front=data['LOD0_G2_DRESS']['P'][df].mean(1)[:,2]>=0
rows=[]
for fr in rep['frames']:
 nd={n['name']:n for n in fr['nodes']};wm=r.fk(*[np.array([nd[n][k] for n in r.names])[None] for k in ['translation','rotation','scale']])[0];vv={};basev={};support=0
 for name,md in data.items():
  binding=next((x for x in fr.get('morphMeshes',[]) if x['mesh']==name),None);p=md['P'].copy();p0=p.copy()
  names=next(x for x in g.j['meshes'] if x['name']==name).get('extras',{}).get('targetNames',[])
  if binding:
   for i,d in enumerate(md['D']):
    coeff=binding['weights'].get('0:'+str(i),0);p+=d*coeff
    if names[i]!='hand_rest_support':p0+=d*coeff
    else:support=max(support,coeff)
  vv[name]=r.skin({'P':p,'J':md['J'],'W':md['W']},wm);basev[name]=r.skin({'P':p0,'J':md['J'],'W':md['W']},wm)
 hands=vv['LOD0_G2_BODY'][hf];lv=r.skin(leg,wm);legtri=np.concatenate([lv[leg['F']],vv['LOD0_G2_BODY'][legmain]])
 def measure(v):
  ap=v['LOD0_G2_APRON'][data['LOD0_G2_APRON']['F']];dr=v['LOD0_G2_DRESS'][df];am=fm['LOD0_G2_APRON'];dm=fm['LOD0_G2_DRESS']
  return {'cuffApron':stats(v['LOD0_G2_BODY'][cuffF],ap),'cuffDress':stats(v['LOD0_G2_BODY'][cuffF],dr),'sleeveApron':stats(v['LOD0_G2_BODY'][sleeveF],ap),'sleeveDress':stats(v['LOD0_G2_BODY'][sleeveF],dr),'handApron':stats(hands,ap,bmask=am),'handDress':stats(hands,dr,bmask=dm),'apronDress':stats(ap,dr,am,dm),'legsApron':stats(legtri,ap,bmask=am),'legsDress':stats(legtri,dr,bmask=dm),'dressFrontBack':stats(dr[front],dr[~front],dm[front],dm[~front])}
 cand=measure(vv);baseline=measure(basev) if support else cand;row={'frame':fr['frame'],'time':fr['t'],'clip':fr['clip'],'clipTime':fr['clipTime'],'action':fr['action'],'supportWeight':support,'upperGarmentPairs':len(m.hits(vv['LOD0_G2_BODY'])),'baseline':baseline,'candidate':cand};rows.append(row);print(fr['frame'],fr['t'],row,flush=True)
pathlib.Path(sys.argv[3]).write_text(json.dumps({'candidateSHA256':hashlib.sha256((INPUT/'candidate.glb').read_bytes()).hexdigest(),'baseline':'Same supplied candidate GLB and exact replay pose, hand_rest_support target set to zero. This isolates only the existing support morph; it is not an independent previous GLB replay.','scope':'Actual TS roundtrip replay397; specified consecutive shard of the full sit-action/transition/settled-hold frames. All397 rows required; cuff region includes all triangles touching original sleeve rings0..6, sleeve region all triangles touching sleeve IDs1503..2542. Shared torso/shoulder union root may include neighboring torso faces. Hands vs apron/dress; apron vs dress; thigh/pelvis BODY primitive4 plus main shin/thigh-weighted faces vs cloth; dress bind-centroidZ front/back halves. Does not cover all within-half dress self folds or scene/seat/foot support. localSupportPairs includes either face touching a changed cloth vertex.','rows':rows},indent=2))
