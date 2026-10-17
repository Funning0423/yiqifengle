import sys; sys.path.insert(0,'/workspace/wechat-game/team/voice-bot/m5-island/scripts')
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from m5_common import *
from m5_bl import *
bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else V22A_BLEND)
o=bpy.data.objects['env_island_props_merged']; V,F=world_mesh(o)
comps=components_vf(V,F)
fence=[];other=[]
for vi,fi in comps:
    xs=[V[i].x for i in vi]; ys=[V[i].y for i in vi]
    if min(xs)>-1.72 and max(xs)<-1.60 and min(ys)>-2.40 and max(ys)<-0.20: fence.append((vi,fi))
    else: other.append((vi,fi))
print('fence comps',len(fence),[len(v) for v,f in fence])
lo=Vector((-2.4,-3.0,-0.5)); hi=Vector((-0.9,0.5,1.5))
def inbox(p): return all(lo[i]<=p[i]<=hi[i] for i in range(3))
# others: props comps near + other meshes near
groups=[]
for k,(vi,fi) in enumerate(other):
    if any(inbox(V[i]) for i in vi): groups.append(('props_merged#%d'%k,[F[j] for j in fi],V))
for ob in bpy.data.objects:
    if ob.type!='MESH' or ob is o or ob.hide_render: continue
    if ob.name.startswith('col_'): continue
    VV,FF=world_mesh(ob); sel=[f for f in FF if any(inbox(VV[i]) for i in f)]
    if sel: groups.append((ob.name,sel,VV))
print('neighbour groups',len(groups))
for n,(vi,fi) in enumerate(fence):
    bf=BVHTree.FromPolygons(V,[F[j] for j in fi])
    for gname,gf,gv in groups:
        bg=BVHTree.FromPolygons(gv,gf)
        ov=bf.overlap(bg)
        if ov: 
            ys=[V[i].y for i in vi]; zs=[V[i].z for i in vi]
            print('fence comp',n,'y',round(min(ys),3),round(max(ys),3),'z',round(min(zs),3),round(max(zs),3),'x-overlaps',gname,len(ov))
