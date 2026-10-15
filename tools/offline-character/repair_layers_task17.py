import sys,json,numpy as np
from pathlib import Path
from common import *
import subprocess
BASE='6160801354a9e2a9cd98c393cdb312840bc05d7e'
raw=subprocess.check_output(['git','-C',str(ROOT),'show',BASE+':'+str(ASSET.relative_to(ROOT))]);assert sha(raw)=='2f01c3f2b3bc06f8c9afe999e17b9958331d2c184f59dd6c6ed5f3314e07d97f'
p=ROOT/'evidence/offline-character/task17-baseline.glb';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw);g,r,ds=load(p)
src=(ROOT/'tools/offline-character/repair_lower_task16.py').read_text();exec(src[src.index('def sparse('):src.index('for md in [ds[0],ds[-1]]:')])
changes=[]
for md,file,start in [(ds[0],'task17-layer-correction.npy',5),(ds[-1],'task17-dress-correction.npy',6)]:
 D=np.load(ROOT/'tools/offline-character'/file);_,rep=np.unique(np.round(md['P'],6),axis=0,return_inverse=True);rep=rep.ravel()
 for k in range(len(D)):
  n='cloth_envelope_sit_down_'+str(k+start);i=md['names'].index(n);v=md['D'][i]+D[k];affected=np.unique(md['F'][np.any((np.linalg.norm(v,axis=1)>1e-8)[md['F']],axis=1)]);N=np.zeros_like(md['N']);N[affected]=(normals(md['P']+v,md['F'],rep)-normals(md['P'],md['F'],rep))[affected];target=md['pr']['targets'][i];sparse(target['POSITION'],v);sparse(target['NORMAL'],N);changes.append(dict(mesh=md['name'],name=n,correctionMaxM=float(np.linalg.norm(D[k],axis=1).max()),vertices=int(np.any(abs(D[k])>1e-8,axis=1).sum())))
exec(src[src.index('# Repack only referenced bufferViews;'):src.index('META.write_text(')])
(ROOT/'evidence/offline-character/task17-install-report.json').write_text(json.dumps(dict(changes=changes,assetSHA256=sha(ASSET.read_bytes()),metadataSHA256=sha(META.read_bytes())),indent=2))
