from pathlib import Path
import sys,json,numpy as np,hashlib,time
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0,'integrated-source/tools/offline-character');from common import *
g,r,ds=load(ASSET);og,orr,ods=load(ROOT/'evidence/offline-character/task21-baseline.glb');meta=json.load(open(META));curves={c:{n:np.array(a) for n,a in m.get('morph',{}).get('curves',{}).items() if n.startswith('task21_')} for c,m in meta['clips'].items()}
def extra(f):
 wt=dict(f['morphWeights']);t=f['time'];alpha=1-f.get('plan',{}).get('out',{}).get('weight',max(0,1-t/.2) if f['clip'] in ['stand_up','sit_down'] else 0) if f.get('plan',{}).get('out') else min(1,t/.2) if f['clip'] in ['stand_up','sit_down'] else 1
 for n,a in curves.get(f['clip'],{}).items():wt[n]=float(np.interp(t,a[:,0],a[:,1]))*alpha
 out=f.get('plan',{}).get('out')
 if out:
  for n,a in curves.get(out['clip'],{}).items():wt[n]=wt.get(n,0)+float(np.interp(out['time'],a[:,0],a[:,1]))*out['weight']
 return wt

def work(f):
 nd={n['name']:n for n in f['nodes']};w=r.fk(*[np.array([nd[n][k] for n in r.names])[None] for k in ['translation','rotation','scale']])[0];b,bd=collision(ods,orr,w,f['morphWeights'],True);a,ad=collision(ds,r,w,extra(f),True);return dict(engineFrame=f['engineFrame'],clip=f['clip'],time=f['time'],before=b,after=a)
if __name__=='__main__':
 frames=json.load(open('../task-20/evidence/native-all-observed-frames.json'))['frames'];frames=[f for f in frames if f['clip'] in ['stand_up','sit_down'] or f['clip'].startswith('walk_') and f['engineFrame']%15==0]
 with ProcessPoolExecutor(max_workers=3) as p:rows=list(p.map(work,frames,chunksize=3))
 Path('evidence/offline-check.json').write_text(json.dumps(rows,indent=2));print('failed',sum(any(x['before'].values()) for x in rows),sum(any(x['after'].values()) for x in rows));print('sitstand residual',[(x['clip'],round(x['time'],3),x['after']) for x in rows if x['clip'] in ['stand_up','sit_down'] and any(x['after'].values())])
