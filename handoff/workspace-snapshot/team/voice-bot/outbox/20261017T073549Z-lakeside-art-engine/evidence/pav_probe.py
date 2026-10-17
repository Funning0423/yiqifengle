import bpy
from bpy_extras.object_utils import world_to_camera_view
sc=bpy.context.scene
print('frames',sc.frame_start,sc.frame_end,'cam',sc.camera.name if sc.camera else None, sc.render.resolution_x, sc.render.resolution_y)
sc.frame_set(sc.frame_end)
def colls(o): return [c.name for c in o.users_collection]
def lc_hidden(o):
    out=[]
    def walk(lc,path):
        for ch in lc.children:
            walk(ch,path+[ch])
        if any(o.name in c.collection.objects for c in [lc]): out.append([(c.name,c.exclude,c.hide_viewport,c.collection.hide_render) for c in path])
    walk(bpy.context.view_layer.layer_collection,[bpy.context.view_layer.layer_collection])
    return out
for o in bpy.data.objects:
    nm=o.name.lower()
    if 'pavilion' in nm or (o.type=='MESH' and o.data and 'pavilion' in o.data.name.lower()):
        p=o.matrix_world.translation
        v=world_to_camera_view(sc,sc.camera,p)
        bb=[o.matrix_world@__import__('mathutils').Vector(c) for c in o.bound_box]
        vs=[world_to_camera_view(sc,sc.camera,b) for b in bb]
        inside=any(0<=q.x<=1 and 0<=q.y<=1 and q.z>0 for q in vs)
        print('OBJ',o.name,'data',o.data.name if o.data else None,'loc',tuple(round(x,2) for x in p),'hide_render',o.hide_render,'hide_vp',o.hide_get() if bpy.context.view_layer.objects.get(o.name) else 'n/a','colls',colls(o),'cam_uv',tuple(round(x,3) for x in v),'bbox_in_frame',inside, lc_hidden(o))
for c in bpy.data.collections: print('COLL',c.name,'hide_render',c.hide_render,len(c.objects))
cam=sc.camera; print('CAMLOC',tuple(round(x,3) for x in cam.matrix_world.translation), cam.data.angle_y if cam.data.sensor_fit!='AUTO' else cam.data.angle)
