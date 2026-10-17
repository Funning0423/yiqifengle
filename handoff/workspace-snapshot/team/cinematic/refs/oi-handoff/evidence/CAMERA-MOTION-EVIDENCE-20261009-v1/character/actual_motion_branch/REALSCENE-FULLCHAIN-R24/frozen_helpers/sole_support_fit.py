"""Fit a rigid sole support plane to true clipped environment top triangles.
The real full shoe mesh is still audited separately. No geometry is edited.
"""
import numpy as np,itertools,math
from mathutils import Vector
from actual_scene_support import hull,clip

def plane_fit(points,center,max_slope=.12):
 p=np.array(points);xz=p[:,[0,2]]-center;y=p[:,1];p=np.unique(np.round(np.c_[xz,y],8),axis=0);xz=p[:,:2];y=p[:,2];candidates=[(0.,0.)]
 # A supporting plane optimum occurs at three contacts or at the bounded-tilt edge.
 for i,j,k in itertools.combinations(range(len(p)),3):
  A=np.array([xz[j]-xz[i],xz[k]-xz[i]]);det=np.linalg.det(A)
  if abs(det)<1e-9:continue
  s=np.linalg.solve(A,[y[j]-y[i],y[k]-y[i]])
  if np.linalg.norm(s)<=max_slope:candidates.append(s)
 for a in np.linspace(0,2*math.pi,48,endpoint=False):candidates.append(np.array([math.cos(a),math.sin(a)])*max_slope)
 ss=np.array(candidates);cc=np.max(y[None,:]-ss@xz.T,axis=1);score=cc+.0002*np.linalg.norm(ss,axis=1);i=int(np.argmin(score));return ss[i],float(cc[i])

def fit_sole(floor,pos,yaw,sole_relative,K,foot_source_y):
 pos=np.array(pos).copy();cy,sy=math.cos(yaw),math.sin(yaw);Ry=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]]);rotation=Ry.copy();used=[];chosen={}
 for iteration in range(3):
  sole=(np.array(sole_relative)*K)@rotation.T+pos;poly=hull(sole[:,[0,2]]);lo=poly.min(0);hi=poly.max(0);points=[];used=[]
  for i,tri in enumerate(floor.tris):
   q=tri[:,[0,2]]
   if np.any(q.max(0)<lo) or np.any(q.min(0)>hi):continue
   pp=clip(q,poly)
   if not pp:continue
   n=np.cross(tri[1]-tri[0],tri[2]-tri[0]);points.extend([[v[0],tri[0,1]-(n[0]*(v[0]-tri[0,0])+n[2]*(v[1]-tri[0,2]))/n[1],v[1]] for v in pp]);used.append(i)
  if not points:raise RuntimeError('No actual floor under sole')
  center=np.mean(poly,axis=0);slopes,c=plane_fit(points,center);normal=np.array([-slopes[0],1,-slopes[1]]);normal/=np.linalg.norm(normal);rotation=np.array(Vector((0,1,0)).rotation_difference(Vector(normal)).to_matrix())@Ry;plane_at_ankle=c+slopes@(pos[[0,2]]-center);pos[1]=plane_at_ankle+K*foot_source_y/normal[1]+.0005;chosen={'normal_game':normal.tolist(),'slope_xz':slopes.tolist(),'support_plane_center_xz':center.tolist(),'plane_center_y':c,'foot_tilt_degrees':math.degrees(math.acos(normal[1])),'support_triangle_indices':used,'iterations':iteration+1}
 return pos,rotation,chosen
