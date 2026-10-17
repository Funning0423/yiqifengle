"""Non-mutating scene gate for non-simulating frozen blends. No cache evaluation.
CLI: -- first_frame last_frame subframes_per_frame
Fixture BVHs are reused only when their evaluated world vertices are unchanged.
"""
import bpy,json,gzip,sys,hashlib,time
from pathlib import Path
from collections import Counter
import numpy as np
from mathutils.bvhtree import BVHTree
R=Path(bpy.data.filepath).parent;BASE=Path('/workspace/shared/grok-takeover/character')
SRC=json.load(gzip.open(BASE/'base/runtime-editable-source.json.gz'));MP=json.load(open(BASE/'split_mapping.json'));scene=bpy.context.scene
for o in bpy.data.objects:
 assert not any(m.type=='CLOTH' and m.show_viewport for m in o.modifiers),'Use verified snapshots instead of evaluating active native Cloth: '+o.name
args=sys.argv[sys.argv.index('--')+1:];start,end,sub=int(args[0]),int(args[1]),int(args[2]);EPS=1e-5
names=['B_BODY_AND_ACCESSORIES']
fixtures=[o.name for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('env_') and not o.hide_render]
assert names and fixtures

def mesh(o,dg):
 e=o.evaluated_get(dg);me=e.to_mesh();me.calc_loop_triangles();p=np.empty(len(me.vertices)*3);me.vertices.foreach_get('co',p);p=p.reshape(-1,3);f=np.array([t.vertices[:] for t in me.loop_triangles]);M=np.array(e.matrix_world);a=me.attributes.get('game_face_id');ids=None
 if a and a.domain=='FACE':ids=np.array([a.data[t.polygon_index].value for t in me.loop_triangles])
 elif o.name in MP and len(f)==len(MP[o.name]['source_face_ids']):ids=np.array(MP[o.name]['source_face_ids'])
 e.to_mesh_clear();p=p@M[:3,:3].T+M[:3,3]
 if o.name=='B_BODY_AND_ACCESSORIES':
  keep=np.array([SRC['origins'][int(i)]['semanticPart'] in ['shoeL','shoeR','leg-completion.thigh.L','leg-completion.thigh.R','leg-completion.shin.L','leg-completion.shin.R','shin.L','shin.R'] for i in ids]);f=f[keep];ids=ids[keep]
 return p,f,ids

def bvh(g):return BVHTree.FromPolygons(g[0].tolist(),g[1].tolist(),all_triangles=True)
def seg(a,b):
 n=np.cross(b[1]-b[0],b[2]-b[0]);n/=max(np.linalg.norm(n),1e-20);v0=b[1]-b[0];v1=b[2]-b[0];aa=v0@v0;ab=v0@v1;bb=v1@v1;det=aa*bb-ab*ab
 if abs(det)<1e-20:return False
 for k in range(3):
  p=a[k];d=a[(k+1)%3]-p;den=n@d
  if abs(den)<1e-12:continue
  t=n@(b[0]-p)/den
  if t< -1e-8 or t>1+1e-8:continue
  v=p+t*d-b[0];u=(bb*(v@v0)-ab*(v@v1))/det;w=(aa*(v@v1)-ab*(v@v0))/det
  if u>=-1e-7 and w>=-1e-7 and u+w<=1+1e-7:return True
 return False

def hit(ga,ba,gb,bb):
 pa,fa,_=ga;pb,fb,_=gb;out=[]
 if np.any(pa.max(0)<pb.min(0)) or np.any(pb.max(0)<pa.min(0)):return out
 for ia,ib in ba.overlap(bb):
  a=pa[fa[ia]];b=pb[fb[ib]];na=np.cross(a[1]-a[0],a[2]-a[0]);nb=np.cross(b[1]-b[0],b[2]-b[0]);na/=max(np.linalg.norm(na),1e-20);nb/=max(np.linalg.norm(nb),1e-20);da=(a-b[0])@nb;db=(b-a[0])@na
  if da.min()<-EPS and da.max()>EPS and db.min()<-EPS and db.max()>EPS and (seg(a,b) or seg(b,a)):out.append((int(ia),int(ib)))
 return out
fixture_cache={};rows=[];summary={};started=time.monotonic();filehash=hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest()
for si in range((end-start)*sub+1):
 fr=start+si/sub;scene.frame_set(int(fr),subframe=fr-int(fr));dg=bpy.context.evaluated_depsgraph_get();geo={n:mesh(bpy.data.objects[n],dg) for n in names};gb={n:bvh(g) for n,g in geo.items()};fg={}
 for n in fixtures:
  g=mesh(bpy.data.objects[n],dg);old=fixture_cache.get(n)
  if old is None or not np.array_equal(g[0],old[0][0]) or not np.array_equal(g[1],old[0][1]):fixture_cache[n]=(g,bvh(g))
  fg[n]=fixture_cache[n]
 row={'frame_float':fr,'time_seconds':(fr-1)/scene.render.fps,'hits':[]}
 for n,g in geo.items():
  for fn,(q,bb) in fg.items():
   hits=hit(g,gb[n],q,bb)
   if not hits:continue
   ids=g[2];sem=Counter(SRC['origins'][int(ids[i])]['semanticPart'] if ids is not None else n for i,j in hits);h={'mesh':n,'fixture':fn,'strict_surface_crossing_pairs':len(hits),'semantics':dict(sem),'fixture_triangle_ids':sorted({j for i,j in hits}),'actor_triangle_ids':sorted({i for i,j in hits})};row['hits'].append(h)
   for sema,num in sem.items():
    key=n+' / '+sema+' vs '+fn;v=summary.setdefault(key,{'samples':0,'first_time_seconds':row['time_seconds'],'last_time_seconds':row['time_seconds'],'max_triangle_pairs':0});v['samples']+=1;v['last_time_seconds']=row['time_seconds'];v['max_triangle_pairs']=max(v['max_triangle_pairs'],num)
 rows.append(row)
 if si%60==0 or row['hits']:print('FRAME',fr,[(q['mesh'],q['fixture'],q['strict_surface_crossing_pairs']) for q in row['hits']],flush=True)
 if si%120==0 or si==(end-start)*sub:
  out=R/(Path(bpy.data.filepath).stem+'_cached_actual_scene_gate.json');out.write_text(json.dumps({'blend':bpy.data.filepath,'sha256':filehash,'threshold_metres':EPS,'sample_fps':scene.render.fps*sub,'frame_range':[start,end],'actor_meshes':names,'actual_fixture_meshes':fixtures,'scope':'LOWER BODY ONLY: thighs, shins, shoes. Actual evaluated mesh triangles, cached BVHs only when vertices/faces exactly unchanged; no physics evaluation, no proxies, no body self/cloth convergence acceptance. Noncoplanar crossings only; shallow/coplanar/touch and complete containment are not certified clear.','elapsed_seconds':time.monotonic()-started,'summary':summary,'rows':rows},indent=2))
print('SUMMARY',summary,'SECONDS',time.monotonic()-started,flush=True);print('SAVED',out,flush=True)
