# Reproducible heroine render (v2). Usage: blender -b -P render_char.py -- <abs in.glb> <abs outdir>
# - vertex-colour multiply removed (Cocos builtin-standard ignores COLOR_0; Blender importer multiplies it in)
# - material-less helper meshes hidden; framing from measured bbox per pose
# - hands: hand_front / hand_side / hand_34 (fixed camera at rest-pose left hand)
# - seated_game_*: sit_hold + game morph weights when GAME_MORPH=<anim_meta.json> is set
# - render: Workbench STUDIO light, texture colour, fixed light dir + bg
# - shots: front / side / back34 / face_close / face_34 (rest pose) + seated_front / seated_side (sit_hold, mid frame)
import bpy,sys,math,json
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:]; glb,out=a[0],a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc=bpy.context.scene
for m in bpy.data.materials:
    if not m.node_tree: continue
    nt=m.node_tree; tex=[n for n in nt.nodes if n.type=='TEX_IMAGE']; bs=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED']
    if tex and bs: nt.links.new(tex[0].outputs['Color'],bs[0].inputs['Base Color'])
    elif bs and not bs[0].inputs['Base Color'].is_linked:  # flat-colour mats (boots): Workbench TEXTURE mode needs an image
        col=tuple(bs[0].inputs['Base Color'].default_value); im=bpy.data.images.new(m.name+'_flat',4,4); im.pixels=list(col)*16
        tn=nt.nodes.new('ShaderNodeTexImage'); tn.image=im; nt.links.new(tn.outputs['Color'],bs[0].inputs['Base Color']); nt.nodes.active=tn
arm=[o for o in sc.objects if o.type=='ARMATURE'][0]
meshes=[o for o in sc.objects if o.type=='MESH']
info=[]
for ob in meshes:
    if not ob.material_slots: ob.hide_render=True; info.append(dict(name=ob.name,excluded=True))
meshes=[o for o in meshes if not o.hide_render]
def bbox():
    bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get(); pts=[]
    for ob in meshes:
        e=ob.evaluated_get(dg); m=e.to_mesh(); pts+=[ob.matrix_world@v.co for v in m.vertices]; e.to_mesh_clear()
    mn=Vector([min(p[i] for p in pts) for i in range(3)]); mx=Vector([max(p[i] for p in pts) for i in range(3)]); return mn,mx
arm.data.pose_position='REST'
mn,mx=bbox()
# FIXED framing (from e976a733 rest bbox) so before/after cameras are identical regardless of mesh edits
H=1.7565; c=Vector((0.0,-0.0204,0.8782)); mn=Vector((-0.268,-0.21,0.0)); mx=Vector((0.268,0.169,1.7565))
mn_m,mx_m=bbox()
dg=bpy.context.evaluated_depsgraph_get()
for ob in meshes:
    e=ob.evaluated_get(dg); m=e.to_mesh()
    info.append(dict(name=ob.name,verts=len(m.vertices),tris=sum(len(p.vertices)-2 for p in m.polygons),mats=[s.material.name for s in ob.material_slots if s.material],groups=len(ob.vertex_groups))); e.to_mesh_clear()
json.dump(dict(bbox_min=list(mn_m),bbox_max=list(mx_m),height=mx_m.z-mn_m.z,meshes=info,armatures=[dict(name=arm.name,bones=len(arm.data.bones))]),open(out+'/stats.json','w'),indent=1)
# Workbench (texture colour, studio light): EEVEE renders several glTF materials black on this asset, Workbench matches in-game albedo
sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading; sh.light='STUDIO'; sh.color_type='TEXTURE'
sh.show_cavity=False; sh.show_shadows=True; sh.shadow_intensity=0.35; sc.display.light_direction=(0.45,-0.55,0.7)
sh.background_type='VIEWPORT'; sh.background_color=(0.82,0.86,0.9)
sc.render.film_transparent=False; sc.display.render_aa='8'
sc.render.resolution_x=768; sc.render.resolution_y=1024; sc.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
cd.type='ORTHO'; cd.sensor_fit='VERTICAL'
def shot(name,yaw,tgt,scale):
    d=Vector((math.sin(math.radians(yaw)),-math.cos(math.radians(yaw)),0))*H*4
    cam.location=tgt+d; cam.rotation_euler=(Vector(tgt)-cam.location).to_track_quat('-Z','Y').to_euler()
    cd.ortho_scale=scale; cd.clip_end=H*20; sc.render.filepath=f'{out}/{name}.png'; bpy.ops.render.render(write_still=True)
shot('front',0,c,H*1.05); shot('side',90,c,H*1.05); shot('back34',150,c,H*1.05)
head=Vector((c.x,c.y,mx.z-H*0.10)); shot('face_close',0,head,H*0.24); shot('face_34',35,head,H*0.24)
hand=Vector((-0.27,-0.12,0.84)); shot('hand_front',0,hand,0.26); shot('hand_side',-90,hand,0.26); shot('hand_34',-40,hand,0.26)
# seated: sit_hold, middle frame, fixed camera relative to rest-pose bbox (not re-framed, so before/after are identical)
act=[x for x in bpy.data.actions if x.name.split('_R5G2')[0].split('.')[0]=='sit_hold' or x.name.startswith('sit_hold')]
if act:
    act=act[0]; arm.data.pose_position='POSE'
    for ob in [arm]+meshes:
        if ob.animation_data: ob.animation_data.action=None
    arm.animation_data_create(); arm.animation_data.action=act
    if hasattr(arm.animation_data,'action_slot') and act.slots: arm.animation_data.action_slot=act.slots[0]
    for t in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(t)
    f0,f1=act.frame_range; sc.frame_set(int((f0+f1)/2))
    sm,sx=bbox(); print('SEATED bbox',list(sm),list(sx))
    sc_c=Vector((c.x,c.y,mn.z+H*0.38))
    shot('seated_front',0,sc_c,H*0.8); shot('seated_side',90,sc_c,H*0.8); shot('seated_34',35,sc_c,H*0.8)
    # same pose with the game's sit_hold morph weights (anim_meta.json, as CharacterMotion.morphWeights): GAME_MORPH=<anim_meta.json>
    import os
    if os.environ.get('GAME_MORPH'):
        exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'tools','game_morph.py')).read(),{'__name__':'gm'})
        bpy.app.handlers.frame_change_pre[-1](sc); bpy.context.view_layer.update(); print('GAME clip',sc.get('game_morph_clip'))
        shot('seated_game_front',0,sc_c,H*0.8); shot('seated_game_side',90,sc_c,H*0.8); shot('seated_game_34',35,sc_c,H*0.8)
else: print('NO sit_hold action', [x.name for x in bpy.data.actions])
