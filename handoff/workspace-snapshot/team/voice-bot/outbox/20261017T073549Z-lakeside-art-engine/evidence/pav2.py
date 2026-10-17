import bpy,mathutils
from bpy_extras.object_utils import world_to_camera_view as w2c
sc=bpy.context.scene;sc.frame_set(sc.frame_end)
o=bpy.data.objects['LK_pavilion_i']
pts=[o.matrix_world@v.co for v in o.data.vertices]
uv=[w2c(sc,sc.camera,p) for p in pts]
ins=[q for q in uv if 0<=q.x<=1 and 0<=q.y<=1]
print('PAV verts',len(uv),'inframe',len(ins),'umin',round(min(q.x for q in uv),3),'vrange',round(min(q.y for q in uv),3),round(max(q.y for q in uv),3))
if ins: print('PAV inframe px x>=',round(min(q.x for q in ins)*720),'y',round((1-max(q.y for q in ins))*1280),round((1-min(q.y for q in ins))*1280))
