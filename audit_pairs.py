from offline_check import *
from concurrent.futures import ProcessPoolExecutor
import argparse

def triangles(dd,w,wt):
 vs={(m['name'],m['pi']):posed(m,r,w,wt) for m in dd};body=dd[1];bv=vs[(body['name'],0)];F=body['F'];sf=F[np.any(np.isin(F,np.arange(1503,2543)),1)];hf=F[np.all(np.isin(F,np.r_[2758:3231,4136:4176,4449:4779]),1)];lb=[r.idx[n] for n in ['thigh.L','thigh.R','shin.L','shin.R']];lv=(body['W']*np.isin(body['J'],lb)).sum(1)>.5;lf=F[np.all(lv[F],1)];leg=dd[5];leg=next(m for m in dd if m['name']=='LOD0_G2_BODY' and m['pi']==4);lt=np.concatenate([bv[lf],vs[(leg['name'],4)][leg['F']]]);out={}
 for cloth in [dd[0],dd[-1]]:
  ct=vs[(cloth['name'],0)][cloth['F']]
  for region,bt in [('sleeve',bv[sf]),('hand',bv[hf]),('legs',lt)]:out[region+cloth['name']]=(bt,ct)
 a,b=dd[0],dd[-1];out['apronDress']=(vs[(a['name'],0)][a['F']],vs[(b['name'],0)][b['F']]);return out

def pairset(a):
 ii,jj=cross_chunk(*a);p=np.array(sorted(zip(map(int,ii),map(int,jj))),dtype='<u4').reshape(-1,2);return p,set(map(tuple,p)),hashlib.sha256(p.tobytes()).hexdigest()

def audit(job):
 f,mode=job;nd={n['name']:n for n in f['nodes']};w=r.fk(*[np.array([nd[n][k] for n in r.names])[None] for k in ['translation','rotation','scale']])[0];oldwt={k:v for k,v in f['morphWeights'].items() if not k.startswith('task21_')};newwt=extra(f) if mode=='historical' else f['morphWeights'];aa=triangles(ods,w,oldwt);bb=triangles(ds,w,newwt);before={};after={};ids={};gained={};lost={};proof={}
 for k,a in aa.items():
  b=bb[k];equal=all(np.array_equal(x,y) for x,y in zip(a,b));ap,aset,ah=pairset(a)
  if equal:bp,bset,bh=ap,aset,ah
  else:bp,bset,bh=pairset(b)
  before[k]=len(ap);after[k]=len(bp);ids[k]=dict(old=ah,new=bh);gained[k]=[list(map(int,p)) for p in sorted(bset-aset)];lost[k]=[list(map(int,p)) for p in sorted(aset-bset)];proof[k]='identical triangle coordinates' if equal else 'independent strict triangle pairs'
 err=0;boneerr=0
 if mode=='actual' and f['clip']=='stand_up' and f['time']<.71:
  _,bq,_=r.sample_clip('stand_up',[f['time']]);out=f.get('plan',{}).get('out');alpha=1-out['weight'] if out else 1
  if out:_,oq,_=r.sample_clip(out['clip'],[out['time']])
  for n in ['forearm.L','forearm.R','hand.L','hand.R']:
   i=r.idx[n];q=R.slerp(oq[0,i],bq[0,i],alpha) if out else bq[0,i];actualq=np.array(nd[n]['rotation']);boneerr=max(boneerr,float(min(np.max(abs(q-actualq)),np.max(abs(q+actualq)))))
 if mode=='actual':
  expected=extra(dict(f,morphWeights=oldwt))
  for n in expected:
   if n.startswith('task21_'):err=max(err,abs(expected[n]-newwt.get(n,0)))
 return dict(engineFrame=f['engineFrame'],clip=f['clip'],time=f['time'],before=before,after=after,identities=ids,gained=gained,lost=lost,proof=proof,newMorphWeightError=err,handBlendReconstructionError=boneerr)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['historical','actual']);p.add_argument('--workers',type=int,default=2);args=p.parse_args();path='../task-20/evidence/native-all-observed-frames.json' if args.mode=='historical' else 'evidence/native-all-observed-frames.json';capture=json.load(open(path));frames=[f for f in capture['frames'] if f['clip'] in ['stand_up','sit_down','door_reach'] or f['clip'].startswith('walk_')];rows=[];start=time.monotonic()
 with ProcessPoolExecutor(max_workers=args.workers) as pool:
  for row in pool.map(audit,((f,args.mode) for f in frames),chunksize=4):
   rows.append(row)
   if len(rows)%50==0:print(len(rows),'/',len(frames),'seconds',round(time.monotonic()-start),flush=True);Path('evidence/'+args.mode+'-partial.json').write_text(json.dumps(rows,separators=(',',':')))
 prefix='evidence/'+args.mode+'-pairs';Path(prefix+'-rows.json').write_text(json.dumps(rows,indent=2));summary=dict(samples=len(rows),beforeFailed=sum(any(x['before'].values()) for x in rows),afterFailed=sum(any(x['after'].values()) for x in rows),gainedPairs=sum(len(v) for x in rows for v in x['gained'].values()),lostPairs=sum(len(v) for x in rows for v in x['lost'].values()),increasedPoses=sum(any(x['after'][k]>x['before'][k] for k in x['before']) for x in rows),maxNewMorphWeightError=max(x['newMorphWeightError'] for x in rows),maxHandBlendReconstructionError=max(x.get('handBlendReconstructionError',0) for x in rows),clips={c:dict(samples=sum(x['clip']==c for x in rows),before=sum(x['clip']==c and any(x['before'].values()) for x in rows),after=sum(x['clip']==c and any(x['after'].values()) for x in rows)) for c in sorted(set(x['clip'] for x in rows))});Path(prefix+'-summary.json').write_text(json.dumps(summary,indent=2));print(summary,flush=True)
