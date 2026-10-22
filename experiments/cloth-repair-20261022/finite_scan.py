"""Full pair scan of represented world triangles; exact rational narrowphase.
No ideal-skin, topology-order, deformation or continuous-time certificate.
Float broadphase uses outward AABBs and conservative dot-product error bounds.
"""
import sys,time
from fractions import Fraction
from pathlib import Path
import numpy as np

from exact_foundation import finite_triangle_pair

def candidate_pairs(A,B,pad):
 eps=np.finfo(float).eps;pad=np.nextafter(float(pad),np.inf);lo=np.nextafter(B.min(1)-pad,-np.inf);hi=np.nextafter(B.max(1)+pad,np.inf)
 for start in range(0,len(A),48):
  aa=A[start:start+48];ii,jj=np.nonzero(np.all(hi[None]>=aa.min(1)[:,None],2)&np.all(lo[None]<=aa.max(1)[:,None],2));ii+=start
  for k in range(0,len(ii),1024):
   ix,jx=ii[k:k+1024],jj[k:k+1024];x,y=A[ix],B[jx];e=np.roll(x,-1,axis=1)-x;f=np.roll(y,-1,axis=1)-y;nx=np.cross(e[:,0],e[:,1]);ny=np.cross(f[:,0],f[:,1]);ax=np.concatenate([nx[:,None],ny[:,None],np.cross(e[:,:,None],f[:,None]).reshape(-1,9,3),np.cross(nx[:,None],e),np.cross(ny[:,None],f)],1);ln=np.linalg.norm(ax,axis=2);valid=ln>1e-100;ax/=np.maximum(ln[:,:,None],1e-100)
   # Any represented axis is valid: interval-bound its dot projections and norm,
   # rather than assuming the computed normal is mathematically exact/unit.
   px=np.einsum('nvj,nkj->nvk',x,ax);py=np.einsum('nvj,nkj->nvk',y,ax);ex=16*eps*np.einsum('nvj,nkj->nvk',np.abs(x),np.abs(ax))+1e-290;ey=16*eps*np.einsum('nvj,nkj->nvk',np.abs(y),np.abs(ax))+1e-290;nu=np.linalg.norm(ax,axis=2)*(1+16*eps)+1e-290
   gap=np.maximum((px-ex).min(1)-(py+ey).max(1),(py-ey).min(1)-(px+ex).max(1));lower=gap/nu;lower[~valid]=-np.inf
   for u in np.flatnonzero(lower.max(1)<=pad):yield int(ix[u]),int(jx[u])

def scan(A,B,threshold_mm='0.005',a_faces=None,b_labels=None):
 start=time.time();threshold=Fraction(threshold_mm);fails=[];unresolved=[];tested=0;intersections=0
 for i,j in candidate_pairs(A,B,float(threshold)):
  tested+=1;r=finite_triangle_pair(A[i],B[j],threshold)
  if r['status']=='UNRESOLVED':unresolved.append(dict(face_a=i,face_b=j,reason=r['reason']));continue
  d2=Fraction(r['distance_squared_mm2'])
  if r['status']=='FAIL':
   row=dict(face_a=i,face_b=j,distance_mm=float(d2)**.5,distance_squared_exact=str(d2),intersection=d2==0)
   if a_faces is not None:row['source_vertex_ids_a']=a_faces[i].tolist()
   if b_labels is not None:row['feature_b']=b_labels[j]
   fails.append(row);intersections+=d2==0
 return dict(status='FAIL' if fails else 'UNRESOLVED' if unresolved else 'PASS',threshold_mm=str(threshold),failed_pairs=len(fails),intersections=int(intersections),unresolved_pairs=len(unresolved),exact_tested_pairs=tested,pairs=fails,unresolved=unresolved,elapsed_s=time.time()-start,scope='All supplied represented-coordinate finite triangles only; not layer order or CCD')
