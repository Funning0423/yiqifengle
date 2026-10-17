import bpy, json, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
V21='/workspace/wechat-game/art/x/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/'
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/art/island/v2.2a/scene/env_scene_island_v2_2a.blend')
dg=bpy.context.evaluated_depsgraph_get()
def bvh(o):
    me=o.evaluated_get(dg).to_mesh(); mw=o.matrix_world
    t=BVHTree.FromPolygons([mw@v.co for v in me.vertices],[list(p.vertices) for p in me.polygons]); o.evaluated_get(dg).to_mesh_clear(); return t
isl=bvh(bpy.data.objects['env_island_main'])
def ground(bx,by):
    h=isl.ray_cast(Vector((bx,by,5)),Vector((0,0,-1)),20); return h[0].z if h[0] else None
# fence posts
o=bpy.data.objects['env_island_props_merged']
for y in (-0.3,-2.3):
    vs=[o.matrix_world@v.co for v in o.data.vertices if abs(v.co.x+1.66)<0.06 and abs(v.co.y-y)<0.06 and v.co.z<0.0]
    print('post',y,'n',len(vs),[ (round(v.x,3),round(v.y,3),round(v.z,3),'g',round(ground(v.x,v.y),4)) for v in vs])
    print('  ground at centre',ground(-1.66,y), 'and at mid', ground(-1.66,-1.3))
# lighthouse radius
L=bpy.data.objects['env_lighthouse_ext']; TC=(0.0,2.646)
rs=[]
for v in L.data.vertices:
    w=L.matrix_world@v.co
    if 0.3<w.z<3.0:
        r=math.hypot(w.x-TC[0],w.y-TC[1]); ang=math.degrees(math.atan2(w.y-TC[1],w.x-TC[0])); rs.append((r,ang,w.z))
rs.sort()
print('tower verts band',len(rs),'median r',rs[len(rs)//2][0],'max',rs[-5:])
# histogram by r
import collections
h=collections.Counter(round(r,2) for r,a,z in rs if r<3.2); print(sorted(h.items())[-40:])
