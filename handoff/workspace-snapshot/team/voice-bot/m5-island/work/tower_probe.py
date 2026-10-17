import sys; sys.path.insert(0,'/workspace/wechat-game/team/voice-bot/m5-island/scripts')
import bpy, math
from mathutils import Vector
from m5_common import *
from m5_bl import *
bpy.ops.wm.open_mainfile(filepath=V22A_BLEND)
L=bpy.data.objects['env_lighthouse_ext']; LV,LF=world_mesh(L)
bpy.ops.import_scene.gltf(filepath=V21_COL)
cols={}
for n in ('col_ext_tower_wall','col_ext_cottage'):
    V,F=world_mesh(bpy.data.objects[n]); cols[n]=[convex_planes(V,F,c[1]) for c in components_vf(V,F)]
for n in ('col_int_door_frame','col_int_walls'):
    V,F=world_mesh(bpy.data.objects[n]); cols[n]=[convex_planes(V,F,c[1]) for c in components_vf(V,F)]
print({k:len(v) for k,v in cols.items()})
TC=TOWER_C
out=[]
for v in LV:
    if not (0.02<v.z<3.25): continue
    r=math.hypot(v.x-TC[0],v.y-TC[1])
    if r<2.47: continue
    ins=[k for k,cs in cols.items() if any(inside_convex(v,pl,2e-3) for pl in cs)]
    if not ins: out.append((r,math.degrees(math.atan2(v.y-TC[1],v.x-TC[0])),v.copy()))
print('uncovered',len(out))
import collections
b=collections.defaultdict(list)
for r,a,v in out: b[int(a//10)*10].append((round(r,3),round(v.x,3),round(v.y,3),round(v.z,3)))
for k in sorted(b): print(k,len(b[k]),max(b[k])[:4], min(b[k]))
