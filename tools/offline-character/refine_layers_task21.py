from pathlib import Path
import sys,json,numpy as np,shutil
from common import *
g,r,ds=load(ASSET);meta=json.load(open(META));src=(ROOT/'tools/offline-character/repair_lower_task16.py').read_text();exec(src[src.index('def sparse('):src.index('for md in [ds[0],ds[-1]]:')]);fields=np.load(Path(__file__).with_name('task21-refinement-fields.npz'));knots=json.load(open(Path(__file__).with_name('task21-refinement-knots.json')));changes=[]
for md in [ds[0],ds[-1]]:
 mesh=next(m for m in g.j['meshes'] if m['name']==md['name']);entry=meta['morph']['meshes'][md['name']]['targets'];_,rep=np.unique(np.round(md['P'],6),axis=0,return_inverse=True)
 def put(target,D):
  affected=np.unique(md['F'][np.any((np.linalg.norm(D,axis=1)>1e-8)[md['F']],axis=1)]);N=np.zeros_like(md['N']);N[affected]=(normals(md['P']+D,md['F'],rep)-normals(md['P'],md['F'],rep))[affected];target['POSITION']=sparse(target.get('POSITION'),D);target['NORMAL']=sparse(target.get('NORMAL'),N)
 if md['name']=='LOD0_G2_APRON':
  P=md['P'];smooth=lambda x:np.clip(x,0,1)**2*(3-2*np.clip(x,0,1));mask=1-smooth((abs(P[:,0])-.065)/.02)*smooth((P[:,1]-.68)/.05);fac=np.clip((.92-P[:,1])/.2,0,1)*np.clip((P[:,2]-.04)/.08,0,1)*mask;D=np.c_[fac*0,fac*0,fac*.02];put(md['pr']['targets'][md['names'].index('task21_walk_layer_gap')],D)
  # All gait clips share clearance so native joins do not ramp through the skirt.
  for clip in meta['clips']:
   if clip.startswith('walk_'):meta['clips'][clip].setdefault('morph',{}).setdefault('curves',{})['task21_walk_layer_gap']=[[0,0 if clip.startswith('walk_turn_') else 1],[meta['clips'][clip]['duration_s'],0 if clip.startswith('walk_turn_') else 1]]
 for x in knots:
  name=x['name'];D=fields[name+'_'+md['name']]
  if not np.any(abs(D)>1e-8):continue
  assert name not in entry;entry[name]=len(md['pr']['targets']);target={};put(target,D);md['pr']['targets'].append(target);mesh['extras']['targetNames'].append(name);mesh['weights'].append(0.)
  for n in g.j['nodes']:
   if n.get('mesh')==g.j['meshes'].index(mesh) and 'weights' in n:n['weights'].append(0.)
  meta['clips'][x['clip']]['morph']['curves'][name]=[[0,0],[x['lo'],0],[x['time'],1],[x['hi'],0],[meta['clips'][x['clip']]['duration_s'],0]];changes.append(dict(mesh=md['name'],name=name,maxM=float(np.linalg.norm(D,axis=1).max())))
exec(src[src.index('# Repack only referenced bufferViews;'):src.index('META.write_text(')])
META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');(ROOT/'evidence/offline-character/task21-refinement-install.json').write_text(json.dumps(changes,indent=2));print('refined',len(changes),sha(ASSET.read_bytes()),sha(META.read_bytes()))
