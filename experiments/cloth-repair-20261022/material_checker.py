"""New raw-source static material diagnostic; NOT recovered Oct21 formula or CCD.
Units cancel in ratios; signed bends use radians. Float64 numerical evidence only.
"""
import numpy as np
import hashlib

def _status(fail,unresolved):return 'FAIL' if len(fail) else ('UNRESOLVED' if len(unresolved) else 'NUMERICAL_PASS')
def check_material(P0,P1,faces,canonical_ids=None,interior=1e-10):
 p0=np.asarray(P0,float);p1=np.asarray(P1,float);f=np.asarray(faces,int)
 if p0.shape!=p1.shape or p0.ndim!=2 or p0.shape[1]!=3 or f.ndim!=2 or f.shape[1]!=3:raise ValueError('Expected matching Nx3 positions and Mx3 faces')
 if not np.isfinite(p0).all() or not np.isfinite(p1).all():raise ValueError('Nonfinite positions')
 if not np.isfinite(interior) or interior<1e-10:raise ValueError('Interior may not be relaxed below 1e-10')
 if f.min()<0 or f.max()>=len(p0):raise ValueError('Invalid face index')
 c=np.arange(len(p0)) if canonical_ids is None else np.asarray(canonical_ids,int)
 if c.shape!=(len(p0),) or c.min()<0 or c.max()>=len(p0) or not np.array_equal(c[c],c):raise ValueError('Invalid canonical IDs')
 seam_bad=np.flatnonzero(np.any(p0!=p0[c],axis=1)|np.any(p1!=p1[c],axis=1));fc=c[f]
 edge_rows={};neigh=[set() for _ in f]
 for i,face in enumerate(fc):
  for a,b in zip(face,np.roll(face,-1)):edge_rows.setdefault(tuple(sorted((int(a),int(b)))),[]).append((i,int(a),int(b)))
 edges=np.array(list(edge_rows));e0=p0[edges[:,1]]-p0[edges[:,0]];e1=p1[edges[:,1]]-p1[edges[:,0]];l0=np.linalg.norm(e0,axis=1);l1=np.linalg.norm(e1,axis=1);valid_e=l0>0;er=np.full(len(edges),np.nan);er[valid_e]=l1[valid_e]/l0[valid_e]
 ev=np.minimum(er-.92,1.08-er)-interior;ef=np.flatnonzero(valid_e&(ev<0));eu=np.flatnonzero(~valid_e)
 v0=np.cross(p0[f[:,1]]-p0[f[:,0]],p0[f[:,2]]-p0[f[:,0]]);v1=np.cross(p1[f[:,1]]-p1[f[:,0]],p1[f[:,2]]-p1[f[:,0]]);a0=np.linalg.norm(v0,axis=1);a1=np.linalg.norm(v1,axis=1);valid_f=(a0>0)&(a1>0);ar=np.full(len(f),np.nan);ar[a0>0]=a1[a0>0]/a0[a0>0];av=np.minimum(ar-.8,1.25-ar)-interior;af=np.flatnonzero((a0>0)&(av<0));au=np.flatnonzero(a0==0)
 pairs=[];badedge=[]
 for ei,(edge,rr) in enumerate(edge_rows.items()):
  if len(rr)==2:
   (i,a,b),(j,x,y)=rr
   if (a,b)!=(y,x):badedge.append(ei);continue
   neigh[i].update(fc[j]);neigh[j].update(fc[i]);pairs.append((ei,i,j,a,b))
  elif len(rr)>2:badedge.append(ei)
 # Fixed one-edge-ring outer vertices: no query-point normal sign or target-face fit.
 rings=[np.array(sorted(ns-set(fc[i])),int) for i,ns in enumerate(neigh)];H=np.zeros((len(f),3,3));rankok=np.zeros(len(f),bool)
 for i,ids in enumerate(rings):
  if len(ids)<3:continue
  x=p0[ids]-p0[ids].mean(0);y=p1[ids]-p1[ids].mean(0);sx=np.linalg.svd(x,compute_uv=False);sy=np.linalg.svd(y,compute_uv=False)
  if sx[1]<=1e-12*sx[0] or sy[1]<=1e-12*sy[0]:continue
  H[i]=x.T@y;rankok[i]=True
 U,S,Vh=np.linalg.svd(H);V=Vh.transpose(0,2,1);R=V@U.transpose(0,2,1);neg=np.linalg.det(R)<0;V[neg,:,2]*=-1;R=V@U.transpose(0,2,1)
 # Proper-rotation optimum is ambiguous for rank<2 or reflection with tied small singular values.
 rankok &= (S[:,1]>1e-12*np.maximum(S[:,0],1e-300))
 rankok &= ~(neg & (abs(S[:,1]-S[:,2])<=1e-12*np.maximum(S[:,0],1e-300)))
 # Exact unchanged whole edge-connected components have known identity transport.
 adj=[[] for _ in f]
 for _,i,j,_,_ in pairs:adj[i].append(j);adj[j].append(i)
 seen=set();identity_faces=[]
 for seed in range(len(f)):
  if seed in seen:continue
  stack=[seed];seen.add(seed);component=[]
  while stack:
   i=stack.pop();component.append(i)
   for j in adj[i]:
    if j not in seen:seen.add(j);stack.append(j)
  ids=np.unique(fc[component])
  if np.array_equal(p0[ids],p1[ids]):identity_faces.extend(component)
 # Local unchanged geometry gives exactly known identity even if its outer
 # frame is rank deficient. Include the target face and all fixed neighboring
 # patch vertices. Never use this branch for a moved target or moved patch.
 local_identity_faces=[]
 for i,ns in enumerate(neigh):
  ids=np.array(sorted(ns|set(fc[i])|set(f[i])),int)
  if np.array_equal(p0[ids],p1[ids]):local_identity_faces.append(i)
 identity_faces=sorted(set(identity_faces)|set(local_identity_faces))
 if identity_faces:R[identity_faces]=np.eye(3);rankok[identity_faces]=True
 bad_representatives=np.unique(c[seam_bad]);seam_affected=np.isin(fc,bad_representatives).any(1)
 rankok[seam_affected]=False
 transported=np.einsum('nij,nj->ni',R,v0);ori=np.full(len(f),np.nan);good=rankok&valid_f;ori[good]=np.sum(transported[good]*v1[good],axis=1)/(a0[good]**2);of=np.flatnonzero(good&(ori<=interior));ou=np.flatnonzero(~good)
 oreasons=[dict(face_id=int(i),outer_vertex_count=len(rings[i]),reason='degenerate_source_or_current_face' if not valid_f[i] else ('seam_coordinate_mismatch' if seam_affected[i] else ('fewer_than_three_outer_reference_vertices' if len(rings[i])<3 else 'rank_deficient_or_nonunique_outer_transport'))) for i in ou]
 bends=[];bf=[];bu=[]
 if pairs:
  pp=np.array(pairs);ei,i,j,a,b=pp.T;good_b=valid_f[i]&valid_f[j]&(l0[ei]>0)&(l1[ei]>0);theta=[]
  for p,v,aa in [(p0,v0,a0),(p1,v1,a1)]:
   n=v/np.maximum(aa[:,None],1e-300);t=p[b]-p[a];t/=np.maximum(np.linalg.norm(t,axis=1)[:,None],1e-300);theta.append(np.arctan2(np.sum(t*np.cross(n[i],n[j]),axis=1),np.sum(n[i]*n[j],axis=1)))
  delta=np.arctan2(np.sin(theta[1]-theta[0]),np.cos(theta[1]-theta[0]));margin=np.deg2rad(25)-abs(delta)-interior
  for k in range(len(pp)):
   bends.append(dict(edge_id=int(ei[k]),vertices=edges[ei[k]].tolist(),faces=[int(i[k]),int(j[k])],source_angle_rad=float(theta[0][k]),current_angle_rad=float(theta[1][k]),signed_change_rad=float(delta[k]),margin_rad=float(margin[k])))
  bf=ei[good_b&(margin<0)].tolist();bu=ei[~good_b].tolist()
 def extrema(v):
  w=v[np.isfinite(v)];return [float(w.min()),float(w.max())] if len(w) else None
 badface=np.flatnonzero(seam_affected);all_fail=len(ef)+len(af)+len(of)+len(bf);all_unresolved=len(eu)+len(au)+len(ou)+len(bu)+len(badedge)+len(seam_bad)
 return dict(status='FAIL' if all_fail else ('UNRESOLVED' if all_unresolved else 'NUMERICAL_PASS'),scope='New static raw-source diagnostic only; not old-formula equivalence, full topology, exact proof or CCD',source_positions_float64_sha256=hashlib.sha256(p0.tobytes()).hexdigest(),interior=interior,edge=dict(worst_margin_edge_id=int(np.nanargmin(ev)) if np.isfinite(ev).any() else None,ratio_range=extrema(er),failed_edge_ids=ef.tolist(),failed_edges=edges[ef].tolist(),unresolved_edge_ids=eu.tolist(),min_margin=(extrema(ev) or [None])[0]),area=dict(worst_margin_face_id=int(np.nanargmin(av)) if np.isfinite(av).any() else None,ratio_range=extrema(ar),failed_face_ids=af.tolist(),unresolved_face_ids=au.tolist(),min_margin=(extrema(av) or [None])[0]),orientation=dict(worst_face_id=int(np.nanargmin(ori)) if np.isfinite(ori).any() else None,formula='dot(R_outer_ring * cross0, cross1) / ||cross0||^2 > interior',ratio_range=extrema(ori),failed_face_ids=of.tolist(),unresolved_face_ids=ou.tolist(),unresolved_reasons=oreasons,reference='Fixed edge-one-ring vertices excluding target triangle; proper Kabsch, no sign reset; exact unchanged component uses identity',identity_transport_faces=identity_faces,local_identity_transport_faces=local_identity_faces),bend=dict(worst_edge_id=min(bends,key=lambda x:x['margin_rad'])['edge_id'] if bends else None,max_abs_change_deg=max((abs(r['signed_change_rad'])*180/np.pi for r in bends),default=None),failed_edge_ids=bf,unresolved_edge_ids=bu,rows=bends),topology=dict(nonmanifold_or_inconsistent_edge_ids=badedge,seam_mismatch_vertex_ids=seam_bad.tolist(),seam_affected_face_ids=badface.tolist()),protected='NOT_CHECKED: caller must supply independently bound protected IDs and verify exact zero total source offset')
