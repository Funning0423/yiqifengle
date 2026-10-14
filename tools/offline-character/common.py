from pathlib import Path
import sys,json,numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'art-src/animation/mocap/scripts'));import rig as R
sys.path.insert(0,str(ROOT/'tools/static-seat'));from glb_local import Glb,sha
sys.path.insert(0,str(ROOT/'handoff-inputs/character-test-20261015/posture-work'));from triangle_cross import cross_chunk
BASE_COMMIT='5a5cc5f071eba2c46c5c4af310be274e0690e09b'
ASSET=ROOT/'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'
META=ASSET.with_name('anim_meta.json')
def load(path):
 g=Glb(path);r=R.Rig(str(path));data=[]
 for m in g.j['meshes']:
  for pi,p in enumerate(m['primitives']):
   a=p['attributes'];data.append(dict(name=m['name'],pi=pi,pr=p,P=g.accessor(a['POSITION']).astype(float),N=g.accessor(a['NORMAL']).astype(float),J=g.accessor(a['JOINTS_0']).astype(int),W=g.accessor(a['WEIGHTS_0']).astype(float),F=g.accessor(p['indices']).astype(int).reshape(-1,3),D=[g.accessor(t['POSITION']).astype(float) for t in p.get('targets',[])],names=m.get('extras',{}).get('targetNames',[])))
 return g,r,data

def posed(md,r,world,weights):
 p=md['P'].copy()
 for n,d in zip(md['names'],md['D']):p+=d*weights.get(n,0)
 return r.skin(dict(P=p,J=md['J'],W=md['W']),world)
def sample(r,clip,t,meta=None):
 T,Q,S=r.sample_clip(clip,[t]);weights={}
 if meta:
  curves=meta['clips'][clip].get('morph',{}).get('curves',{})
  weights={n:float(np.interp(t,np.array(c)[:,0],np.array(c)[:,1])) for n,c in curves.items()}
 return r.fk(T,Q,S)[0],weights

def actual(r):
 f=json.load(open(ROOT/'evidence/offline-character/actual-sit.json'))['frames'][0];nd={n['name']:n for n in f['nodes']}
 world=r.fk(*[np.array([nd[n][k] for n in r.names])[None] for k in ['translation','rotation','scale']])[0]
 return world,f['morphWeights']
def collision(data,r,world,weights,detail=False):
 vs={(m['name'],m['pi']):posed(m,r,world,weights) for m in data};body=next(m for m in data if m['name']=='LOD0_G2_BODY' and m['pi']==0);bv=vs[(body['name'],0)];F=body['F'];sf=F[np.any(np.isin(F,np.arange(1503,2543)),1)];hf=F[np.all(np.isin(F,np.r_[2758:3231,4136:4176,4449:4779]),1)]
 legbones=[r.idx[n] for n in ['thigh.L','thigh.R','shin.L','shin.R']];legvert=(body['W']*np.isin(body['J'],legbones)).sum(1)>.5;lf=F[np.all(legvert[F],1)];leg=next(m for m in data if m['name']=='LOD0_G2_BODY' and m['pi']==4);lt=np.concatenate([bv[lf],vs[(leg['name'],4)][leg['F']]])
 rows={};details={}
 for name in ['LOD0_G2_APRON','LOD0_G2_DRESS']:
  cloth=next(m for m in data if m['name']==name);v=vs[(name,0)];cf=cloth['F']
  for region,tri in [('sleeve',bv[sf]),('hand',bv[hf]),('legs',lt)]:
   ii,jj=cross_chunk(tri,v[cf]);rows[region+name]=len(ii);details[region+name]=(ii,jj,tri,v,cf)
 a=next(m for m in data if m['name']=='LOD0_G2_APRON');b=next(m for m in data if m['name']=='LOD0_G2_DRESS');ii,jj=cross_chunk(vs[(a['name'],0)][a['F']],vs[(b['name'],0)][b['F']]);rows['apronDress']=len(ii)
 return (rows,details) if detail else rows

def baseline():
 import subprocess
 p=ROOT/'evidence/offline-character/baseline.glb'
 if not p.exists():
  p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(subprocess.check_output(['git','-C',str(ROOT),'show',BASE_COMMIT+':'+str(ASSET.relative_to(ROOT))]))
 assert sha(p.read_bytes())=='2f98cf0e1ee1a1213008397e2fd369868576317cd53e718333f7158d2c4de19f'
 return p

def replay(key):
 import gzip
 p=ROOT/'evidence/offline-character'/('short-'+key+'.json')
 return json.loads(p.read_text() if p.exists() else gzip.decompress(p.with_suffix('.json.gz').read_bytes()))
