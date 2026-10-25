"""Blender close-up / context renders for the b19 dock models (Workbench, palette textures applied for the render only).
blender -b --factory-startup -P blender_render.py -- <config.json>
config: {"imports":[{"file":..,"palette":png|null,"loc":[x,y,z] cocos,"yaw":deg}],"shots":[{"out":..,"eye":[cocos],"look":[cocos],"lens":mm,"res":[w,h]}],
         "hide":[name regex], "anim":{...optional}}"""
import bpy,json,sys,math,re,mathutils
cfg=json.load(open(sys.argv[sys.argv.index('--')+1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
C=lambda p:mathutils.Vector((p[0],-p[2],p[1]))
imgs={}
for im in cfg['imports']:
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=im['file'])
    new=[o for o in bpy.data.objects if o not in before]
    if im.get('palette'):
        if im['palette'] not in imgs:imgs[im['palette']]=bpy.data.images.load(im['palette'])
        for o in new:
            for slot in getattr(o,'material_slots',[]):
                m=slot.material
                if m and (im.get('mat') is None or re.search(im['mat'],m.name)):
                    m.use_nodes=True;nt=m.node_tree;nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');b=nt.nodes.new('ShaderNodeBsdfPrincipled')
                    nt.links.new(b.outputs[0],out.inputs[0]);t=nt.nodes.new('ShaderNodeTexImage');t.image=imgs[im['palette']];t.interpolation='Closest'
                    nt.links.new(t.outputs['Color'],b.inputs['Base Color']);nt.nodes.active=t
    roots=[o for o in new if o.parent is None]
    for o in roots:
        if 'loc' in im:o.location=C(im['loc'])
        if 'yaw' in im:o.rotation_mode='XYZ';o.rotation_euler[2]+=math.radians(im['yaw'])
for nm,ps in cfg.get('pose',{}).items():
    o=bpy.data.objects[nm];o.rotation_mode='QUATERNION'
    if 'rotz' in ps:o.rotation_quaternion=mathutils.Quaternion((0,-1,0),math.radians(ps['rotz']))
    if 'loc' in ps:o.location=C(ps['loc'])
    if 'yaw' in ps:o.rotation_quaternion=mathutils.Quaternion((0,0,1),math.radians(ps['yaw']))@o.rotation_quaternion
for o in bpy.data.objects:
    for rx in cfg.get('hide',[]):
        if re.search(rx,o.name):o.hide_render=True
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sh=sc.display.shading;sh.light='STUDIO';sh.color_type='TEXTURE';sh.show_shadows=True;sh.shadow_intensity=0.35
sh.show_cavity=True;sh.cavity_type='WORLD';sh.curvature_ridge_factor=0.6;sc.display.shading.show_object_outline=False
sc.world=bpy.data.worlds.new('w') if not sc.world else sc.world;sc.world.color=(0.62,0.74,0.86)
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));sc.collection.objects.link(cam);sc.camera=cam
def aim(eye,look,lens):
    cam.location=C(eye);d=C(look)-C(eye);cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler();cam.data.lens=lens;cam.data.clip_start=0.02;cam.data.clip_end=400
for s in cfg['shots']:
    aim(s['eye'],s['look'],s.get('lens',35));sc.render.resolution_x,sc.render.resolution_y=s.get('res',[960,720]);sc.render.filepath=s['out'];bpy.ops.render.render(write_still=True);print('SHOT',s['out'])
A=cfg.get('anim')
if A:  # walk-through: character glb along a polyline with its walk_loop clip, camera follows
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=A['character']);new=[o for o in bpy.data.objects if o not in before];root=[o for o in new if o.parent is None][0]
    arm=[o for o in new if o.type=='ARMATURE']
    if arm and arm[0].animation_data is not None:
        act=bpy.data.actions.get(A.get('clip','walk_loop'))
        if act:arm[0].animation_data.action=act
    pts=[C(p) for p in A['path']];L=[0]
    for a,b in zip(pts[:-1],pts[1:]):L.append(L[-1]+(b-a).length)
    fps=A.get('fps',12);sc.render.fps=fps;n=int(L[-1]/A.get('mps',1.0)*fps)+1;sc.frame_start=1;sc.frame_end=n
    for f in range(n+1):
        d=min(L[-1],f/fps*A.get('mps',1.0));i=max(k for k in range(len(L)) if L[k]<=d+1e-9);i=min(i,len(pts)-2);t=(d-L[i])/max(1e-6,L[i+1]-L[i]);p=pts[i].lerp(pts[i+1],t);dv=pts[i+1]-pts[i]
        root.location=p;root.rotation_mode='XYZ';root.rotation_euler=(math.radians(90),0,math.atan2(dv.y,dv.x)-math.pi/2+math.radians(A.get('yawFix',0)));root.keyframe_insert('location',frame=f+1);root.keyframe_insert('rotation_euler',frame=f+1)
        off=mathutils.Vector(A['camOffset']);cam.location=p+off;cam.rotation_euler=((p+mathutils.Vector((0,0,0.9)))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=A.get('lens',30)
        cam.keyframe_insert('location',frame=f+1);cam.keyframe_insert('rotation_euler',frame=f+1)
    sc.render.resolution_x,sc.render.resolution_y=A.get('res',[480,360]);sc.render.image_settings.file_format='PNG';sc.render.filepath=A['out']+'/f_';bpy.ops.render.render(animation=True);print('ANIM',n)
