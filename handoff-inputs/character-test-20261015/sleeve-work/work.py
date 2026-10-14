import sys,json,collections,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent;SRC=ROOT.parent/'source'
sys.path.insert(0,str(SRC/'character-fix/art-src/animation/mocap/scripts'));import rig as R
INPUT=SRC/'character-fix/creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'
r=R.Rig(str(INPUT));a=next(m for m in r.J['meshes'] if m['name']=='LOD0_G2_BODY')['primitives'][0];attrs=a['attributes'];P=R.acc(r.J,r.BIN,attrs['POSITION']);F=R.acc(r.J,r.BIN,a['indices']).astype(int).reshape(-1,3);J=R.acc(r.J,r.BIN,attrs['JOINTS_0']).astype(int);W=R.acc(r.J,r.BIN,attrs['WEIGHTS_0']);N=R.acc(r.J,r.BIN,attrs['NORMAL'])
rep=json.load(open(SRC/'poses/door-pose-camera-samples.json'));world=[]
for fr in rep['frames']:
 nd={n['name']:n for n in fr['nodes']};world.append(r.fk(*[np.array([nd[n][k] for n in r.names])[None] for k in ['translation','rotation','scale']])[0])
world=np.array(world)
def layers(lo,side):
 ids=np.arange(lo,lo+520);adj={int(i):set() for i in ids};ec=collections.Counter()
 for tri in F[np.all(np.isin(F,ids),1)]:
  for x,y in zip(tri,np.roll(tri,-1)):adj[x].add(y);adj[y].add(x);ec[tuple(sorted((x,y)))]+=1
 boundary=set(v for e,c in ec.items() if c==1 for v in e);hw=np.linalg.inv(r.ibm[r.idx['hand.'+side]])[:3,3];start=min(boundary,key=lambda i:np.linalg.norm(P[i]-hw));ring={start};q=[start]
 while q:
  x=q.pop()
  for y in adj[x]&boundary-ring:ring.add(y);q.append(y)
 ls=[sorted(ring)];seen=set(ring)
 while len(seen)<len(ids):
  nxt=set(y for x in ls[-1] for y in adj[x])-seen;ls.append(sorted(nxt));seen.update(nxt)
 return ls
LS={s:layers(lo,s) for s,lo in [('L',1503),('R',2023)]}
tris=F[np.all(np.isin(F,np.arange(1503,2023)),1)]
adjacent=np.any(tris[:,None,:,None]==tris[None,:,None,:],axis=(2,3));allowed=np.triu(~adjacent,1)
def hits(v):
 A=v[tris];low=A.min(1);high=A.max(1);ii,kk=np.where(np.all((low[:,None]<=high[None])&(high[:,None]>=low[None]),axis=2)&allowed)
 hit=np.zeros(len(ii),bool)
 for t1,t2 in [(A[ii],A[kk]),(A[kk],A[ii])]:
  e1=t2[:,1]-t2[:,0];e2=t2[:,2]-t2[:,0]
  for n in range(3):
   orig=t1[:,n];d=t1[:,(n+1)%3]-orig;h=np.cross(d,e2);det=np.einsum('ij,ij->i',e1,h);valid=abs(det)>=1e-10;inv=np.divide(1,det,out=np.zeros_like(det),where=valid);s=orig-t2[:,0];u=inv*np.einsum('ij,ij->i',s,h);q=np.cross(s,e1);vv=inv*np.einsum('ij,ij->i',d,q);tt=inv*np.einsum('ij,ij->i',e2,q);hit|=valid&(tt>1e-6)&(tt<1-1e-6)&(u>1e-6)&(vv>1e-6)&(u+vv<1-1e-6)
 return np.stack([ii[hit],kk[hit]],axis=1)
def evaluate(pp,ww=W,detail=False):
 rows=[]
 for fr,w in zip(rep['frames'],world):
  v=r.skin({'P':pp,'J':J,'W':ww},w);pairs=hits(v);y=P[tris[pairs]].mean(axis=(1,2))[:,1] if len(pairs) else np.array([]);rows.append({'frame':fr['frame'],'elbow':int((y<1.19).sum()),'shoulder':int((y>=1.19).sum()),'pairs':pairs.tolist()})
 return rows
if __name__=='__main__':
 rows=evaluate(P);(ROOT/'baseline.json').write_text(json.dumps(rows,indent=2));print('elbow',sum(x['elbow']>0 for x in rows),max(x['elbow'] for x in rows),sum(x['elbow'] for x in rows),'shoulder',max(x['shoulder'] for x in rows));print([(x['frame'],x['elbow'],x['shoulder']) for x in rows])
