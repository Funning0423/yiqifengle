"""Strict triangle crossing; conservative cKDTree sphere broad phase only.
Same1e-10 determinant,1e-6 barycentric/edge thresholds as prior tests.
"""
import numpy as np
from scipy.spatial import cKDTree
def cross_chunk(A,B):
 if not len(A) or not len(B):return np.array([],int),np.array([],int)
 ca=A.mean(1);cb=B.mean(1);ra=np.linalg.norm(A-ca[:,None],axis=2).max(1);rb=np.linalg.norm(B-cb[:,None],axis=2).max(1);neighbors=cKDTree(cb).query_ball_point(ca,ra+rb.max()+1e-10);lens=np.array([len(x) for x in neighbors]);ii=np.repeat(np.arange(len(A)),lens);jj=np.concatenate(neighbors).astype(int)
 if not len(ii):return ii,jj
 ok=np.all((A[ii].min(1)<=B[jj].max(1))&(A[ii].max(1)>=B[jj].min(1)),axis=1);ii,jj=ii[ok],jj[ok];hit=np.zeros(len(ii),bool)
 for t1,t2 in [(A[ii],B[jj]),(B[jj],A[ii])]:
  e1=t2[:,1]-t2[:,0];e2=t2[:,2]-t2[:,0]
  for n in range(3):
   orig=t1[:,n];d=t1[:,(n+1)%3]-orig;h=np.cross(d,e2);det=np.einsum('ij,ij->i',e1,h);valid=abs(det)>=1e-10;iv=np.divide(1,det,out=np.zeros_like(det),where=valid);s=orig-t2[:,0];u=iv*np.einsum('ij,ij->i',s,h);q=np.cross(s,e1);v=iv*np.einsum('ij,ij->i',d,q);t=iv*np.einsum('ij,ij->i',e2,q);hit|=valid&(t>1e-6)&(t<1-1e-6)&(u>1e-6)&(v>1e-6)&(u+v<1-1e-6)
 return ii[hit],jj[hit]
