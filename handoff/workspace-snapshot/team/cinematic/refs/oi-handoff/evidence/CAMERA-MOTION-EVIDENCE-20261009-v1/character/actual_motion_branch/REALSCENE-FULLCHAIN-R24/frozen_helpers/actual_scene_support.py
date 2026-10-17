"""Preparation-only actual room/exterior support triangles, excluding the moving door and sea. Plane heights are clipped to true shoe footprint. Not yet integrated or contact accepted."""
import bpy,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
C=np.array([[1,0,0],[0,0,-1],[0,1,0]])
def hull(points):
 p=sorted(set(tuple(map(float,q)) for q in points));cross=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);lo=[];up=[]
 for q in p:
  while len(lo)>=2 and cross(lo[-2],lo[-1],q)<=0:lo.pop()
  lo.append(q)
 for q in reversed(p):
  while len(up)>=2 and cross(up[-2],up[-1],q)<=0:up.pop()
  up.append(q)
 return np.array(lo[:-1]+up[:-1])
def clip(poly,outline):
 out=[np.asarray(p) for p in poly]
 for j,a in enumerate(outline):
  b=outline[(j+1)%len(outline)];edge=b-a;cross=lambda p:edge[0]*(p[1]-a[1])-edge[1]*(p[0]-a[0]);old=out;out=[]
  if not old:break
  prev=old[-1];dp=cross(prev)
  for cur in old:
   dc=cross(cur)
   if (dc>=0)!=(dp>=0):out.append(prev+(cur-prev)*dp/(dp-dc))
   if dc>=0:out.append(cur)
   prev=cur;dp=dc
 return out
class ActualFloor:
 def __init__(self):
  self.tris=[];self.provenance=[]
  for name in sorted(ob.name for ob in bpy.data.objects if ob.type=='MESH' and ob.name.startswith('env_') and ob.name not in ['env_lighthouse_door','env_sea_surface','env_sea_foam','env_sky_dome','env_cloud_layer']):
   o=bpy.data.objects[name];me=o.data;me.calc_loop_triangles();world=np.array([C.T@(o.matrix_world@q.co) for q in me.vertices])
   for ti,tri in enumerate(me.loop_triangles):
    p=world[list(tri.vertices)];normal=np.cross(p[1]-p[0],p[2]-p[0]);n=np.linalg.norm(normal)
    if n<1e-12 or normal[1]/n<.90 or p[:,1].min()>.06 or p[:,1].max()<-.25:continue
    self.tris.append(p);self.provenance.append({'object':name,'triangle_index':ti,'game_vertices':p.tolist()})
  self.tris=np.array(self.tris);points=self.tris.reshape(-1,3);self.bvh=BVHTree.FromPolygons([Vector(q) for q in points],np.arange(len(points)).reshape(-1,3).tolist(),all_triangles=True)
 def point_height(self,p):
  q,n,i,d=self.bvh.ray_cast(Vector((p[0],.06,p[2])),Vector((0,-1,0)),.4);return float(q.y) if q is not None else None
 def footprint_height(self,footprint):
  poly=hull(np.asarray(footprint)[:,[0,2]]);result=None;used=[]
  lo=poly.min(0);hi=poly.max(0)
  for i,tri in enumerate(self.tris):
   q=tri[:,[0,2]]
   if np.any(q.max(0)<lo) or np.any(q.min(0)>hi):continue
   intersection=clip(q,poly)
   if intersection:
    # Plane interpolation on the clipped footprint, avoiding distant terrain vertices.
    normal=np.cross(tri[1]-tri[0],tri[2]-tri[0]);values=[tri[0,1]-(normal[0]*(v[0]-tri[0,0])+normal[2]*(v[1]-tri[0,2]))/normal[1] for v in intersection];h=float(max(values))
    if result is None or h>result:result=h
    used.append(i)
  return result,used
