from common import *
g,r,data=load(ASSET);old,rr,od=load(baseline());report={'scope':'Offline asset/TS adapter tests. No Cocos, GPU, WeChat or phone acceptance.','sha256':sha(ASSET.read_bytes()),'structural':{},'seat':{},'stand':{},'shortStop':{}}
assert g.j['nodes']==old.j['nodes'] and g.j['skins']==old.j['skins'] and g.j['materials']==old.j['materials']
assert g.j['animations']==old.j['animations']
assert all(np.array_equal(g.accessor(m['pr']['indices']),old.accessor(n['pr']['indices'])) for m,n in zip(data,od))
assert all(np.isfinite(m['P']).all() and np.isfinite(m['W']).all() and abs(m['W'].sum(1)-1).max()<2e-7 for m in data)
assert [sha(g.view(i['bufferView'])) for i in g.j['images']]==[sha(old.view(i['bufferView'])) for i in old.j['images']]
report['structural']={'rigInverseBindsMaterialsImagesTopologyUnchanged':True,'finiteNormalizedWeights':True,'TRSCacheFixRetained':True}
m=next(m for m in data if m['name']=='LOD0_G2_BODY' and m['pi']==0);canon={};pairs=[]
for i,p in enumerate(m['P']):
 k=(tuple(p),tuple(m['J'][i]),tuple(m['W'][i]));
 if k in canon:pairs.append((canon[k],i))
 else:canon[k]=i
report['structural']['duplicatedPositionSkinSeams']=len(pairs)
seam=[]
for name,d in zip(m['names'],m['D']):
 bad=[(i,j,float(np.linalg.norm(d[i]-d[j]))) for i,j in pairs if np.linalg.norm(d[i]-d[j])>1e-6]
 if bad:seam.append({'target':name,'mismatches':bad})
report['structural']['morphSeamMismatch']=seam
for key,rg,ds in [('before',rr,od),('after',r,data)]:
 w,wt=actual(rg);report['seat'][key]=collision(ds,rg,w,wt)
T,Q,S=r.sample_clip('stand_up',[0]);Ts,Qs,Ss=rr.sample_clip('stand_up',[0]);report['stand']['entryTRSIdenticalToBaseline']=bool(np.array_equal(T,Ts) and np.array_equal(Q,Qs) and np.array_equal(S,Ss));assert report['stand']['entryTRSIdenticalToBaseline']
for key,rg in [('before',rr),('after',r)]:
 T,Q,S=rg.sample_clip('stand_up',[.601]);w=rg.fk(T,Q,S)[0];report['stand'][key]={n:float(np.degrees(np.arccos(np.clip(w[rg.idx[n],1,1],-1,1)))) for n in ['spine','chest','neck','head']}
dur=max(float(old.accessor(s['input'])[-1,0]) for s in rr.clips['stand_up']['samplers']);ts=np.linspace(0,dur,int(dur*120)+1)
for key,rg in [('before',rr),('after',r)]:
 T,Q,S=rg.sample_clip('stand_up',ts);world=rg.fk(T,Q,S)
 report['stand'][key]['worldAngularSpeedMaxDegS']={}
 for bone in ['spine','chest','neck','head']:
  qs=R.m2q(world[:,rg.idx[bone],:3,:3]);angles=2*np.arccos(np.clip(abs(np.sum(qs[1:]*qs[:-1],axis=1)),0,1));report['stand'][key]['worldAngularSpeedMaxDegS'][bone]=float(np.degrees(angles).max()/(ts[1]-ts[0]))
for key in ['before','after']:
 rep=replay(key);f=next(f for f in rep['frames'] if f['frame']==508);mins={b:min(fr['feet'][b]['minimumM'] for fr in rep['frames']) for b in ['foot.L','foot.R']};nd={n['name']:n for n in f['nodes']};w=r.fk(*[np.array([nd[n][k] for n in r.names])[None] for k in ['translation','rotation','scale']])[0];p=np.array(json.load(open(META))['sole_contact']['points']['foot.L']);i=r.idx['foot.L'];rest=(r.rest_world[i]@np.c_[p,np.ones(len(p))].T).T[:,:3];v=(w[i]@np.c_[p,np.ones(len(p))].T).T[:,:3];axis=v[rest[:,2].argmax()]-v[rest[:,2].argmin()];pitch=float(np.degrees(np.arctan2(axis[1],np.linalg.norm(axis[[0,2]]))))
 report['shortStop'][key]={'frame508':f['feet'],'toeHeelPitchDeg508':pitch,'minimum570Frames':mins}
report['open']=['30 seated leg/dress crossing pairs retained','Full all-angle wrist/heel silhouette and stand transition collision acceptance pending','Expanded distance/timestep gate fails (3m@30Hz), including control without relaxed swing','No game visual acceptance']
(ROOT/'evidence/offline-character/validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
