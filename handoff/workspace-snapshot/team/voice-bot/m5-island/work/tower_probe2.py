import sys; sys.path.insert(0,'/workspace/wechat-game/team/voice-bot/m5-island/scripts')
import bpy, math, numpy as np
from m5_common import *
from m5_bl import *
bpy.ops.wm.open_mainfile(filepath=V22A_BLEND)
L=bpy.data.objects['env_lighthouse_ext']; LV,LF=world_mesh(L)
bpy.ops.import_scene.gltf(filepath=V21_COL)
TS={}
for n in ('col_ext_tower_wall','col_ext_cottage','col_int_door_frame','col_int_walls'):
    V,F=world_mesh(bpy.data.objects[n]); TS[n]=tri_array(V,F)
TC=TOWER_C
pts=[];meta=[]
for v in LV:
    if not (0.02<v.z<3.25): continue
    r=math.hypot(v.x-TC[0],v.y-TC[1])
    if r<2.47 or r>3.2: continue
    if 1.419<=v.x<=4.763 and -0.989<=v.y<=2.997: continue   # cottage footprint (col_ext_cottage domain)
    pts.append(tuple(v)); meta.append((r,math.degrees(math.atan2(v.y-TC[1],v.x-TC[0]))))
W={k:np.abs(winding(pts,T)) for k,T in TS.items()}
cov=np.zeros(len(pts),bool)
for k,w in W.items(): cov|=w>0.5
print('tower-body verts',len(pts),'uncovered',(~cov).sum())
unc=[(meta[i][0],meta[i][1],pts[i]) for i in np.where(~cov)[0]]
unc.sort(reverse=True)
for u in unc[:15]: print([round(x,3) for x in u[:2]],[round(x,3) for x in u[2]])
import collections
b=collections.defaultdict(list)
for r,a,p in unc: b[int(a//10)*10].append(r)
print({k:(len(v),round(max(v),3)) for k,v in sorted(b.items())})
print('--- door sector + lamp detail')
for r,a,p in sorted(unc,key=lambda u:u[1]):
    if -115<a<-60: print(round(r,3),round(a,1),[round(x,3) for x in p])
