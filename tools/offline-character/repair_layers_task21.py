from pathlib import Path
import sys,json,numpy as np,subprocess
from common import *
base=ROOT/'evidence/offline-character/task21-baseline.glb'
base.parent.mkdir(parents=True,exist_ok=True)
base.write_bytes(subprocess.check_output(['git','-C',str(ROOT),'show','92e3a6edfb30e9e0cc73330c23b76ac77a7ad2ea:'+str(ASSET.relative_to(ROOT))]))
assert sha(base.read_bytes())=='baa3e97a0519b14fa7b44ca5af931bb48bf9f9fda038ca736c9ce3d030d814bf'
base.with_suffix('.json').write_bytes(subprocess.check_output(['git','-C',str(ROOT),'show','92e3a6edfb30e9e0cc73330c23b76ac77a7ad2ea:'+str(META.relative_to(ROOT))]))
assert sha(base.with_suffix('.json').read_bytes())=='b7b7f9b7d2d36dc9fe8a06e92cd5e18461f7e450b203838818670fc1615ee031'
g,r,ds=load(base);meta=json.load(open(base.with_suffix('.json')));fields=np.load(Path(__file__).with_name('task21-layer-fields.npz'));knots=json.load(open(Path(__file__).with_name('task21-field-knots.json')))
src=(ROOT/'tools/offline-character/repair_lower_task16.py').read_text();exec(src[src.index('def sparse('):src.index('for md in [ds[0],ds[-1]]:')])
installed=[]
for md in [ds[0],ds[-1]]:
 mesh=next(m for m in g.j['meshes'] if m['name']==md['name']);entry=meta['morph']['meshes'][md['name']]['targets'];_,rep=np.unique(np.round(md['P'],6),axis=0,return_inverse=True)
 def add(name,D,clip,curve):
  if not np.any(abs(D)>1e-8):return
  affected=np.unique(md['F'][np.any((np.linalg.norm(D,axis=1)>1e-8)[md['F']],axis=1)]);N=np.zeros_like(md['N']);N[affected]=(normals(md['P']+D,md['F'],rep)-normals(md['P'],md['F'],rep))[affected];entry[name]=len(md['pr']['targets']);md['pr']['targets'].append(dict(POSITION=sparse(None,D),NORMAL=sparse(None,N)));mesh['extras']['targetNames'].append(name);mesh['weights'].append(0.)
  for node in g.j['nodes']:
   if node.get('mesh')==g.j['meshes'].index(mesh) and 'weights' in node:node['weights'].append(0.)
  meta['clips'][clip].setdefault('morph',{}).setdefault('curves',{})[name]=curve;installed.append(dict(mesh=md['name'],name=name,maxM=float(np.linalg.norm(D,axis=1).max())))
 for clip in ['sit_down','stand_up']:
  rows=[x for x in knots if x['clip']==clip]
  for k,x in enumerate(rows):
   # Keep all early stand-up cloth and hand pair identities unchanged.
   if clip=='stand_up' and x['time']<.15:continue
   t=x['time'];alpha=min(1,t/.2);D=fields[x['name']+'_'+md['name']]/alpha
   prev=rows[k-1]['time'] if k else 0
   if clip=='stand_up' and prev<.14:prev=.14
   nxt=rows[k+1]['time'] if k+1<len(rows) else t+.04
   add(x['name'],D,clip,[[0,0],[prev,0],[t,1],[nxt,0],[max(nxt,meta['clips'][clip]['duration_s']),0]])
 if md['name']=='LOD0_G2_APRON':
  P=md['P'];fac=np.clip((.92-P[:,1])/.2,0,1)*np.clip((P[:,2]-.04)/.08,0,1);name='task21_walk_layer_gap';D=np.c_[fac*0,fac*0,fac*.01]
  add(name,D,'walk_loop',[[0,1],[meta['clips']['walk_loop']['duration_s'],1]])
  for c in meta['clips']:
   if c.startswith('walk_'):meta['clips'][c].setdefault('morph',{}).setdefault('curves',{})[name]=[[0,1],[meta['clips'][c]['duration_s'],1]]
exec(src[src.index('# Repack only referenced bufferViews;'):src.index('META.write_text(')])
META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');(ROOT/'evidence/offline-character/task21-install-report.json').write_text(json.dumps(installed,indent=2));print('installed',len(installed),'asset',sha(ASSET.read_bytes()))
