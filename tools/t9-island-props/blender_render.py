# QA only (not shipped). blender -b --factory-startup -P blender_render.py -- scene.json
# Offline, NON-NATIVE preview: Cycles + one sun approximates the island light; Cocos shading/HUD differ.
import bpy, json, sys, math, mathutils
cfg=json.load(open(sys.argv[sys.argv.index('--')+1]))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
def cc2bl(v): return mathutils.Vector((v[0],-v[2],v[1]))
def imp(path):
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]
hide=cfg.get('hide',[])
for o in imp(cfg['island']):
    if any(h in o.name for h in hide): o.hide_render=True
for it in cfg.get('props',[]):
    objs=imp(it['glb']); roots=[o for o in objs if o.parent is None]
    E=bpy.data.objects.new(it.get('name','prop'),None); sc.collection.objects.link(E)
    for r in roots: r.parent=E
    E.location=cc2bl(it['pos']); E.rotation_mode='XYZ'; E.rotation_euler=(0,0,math.radians(it.get('yaw',0))); s=it.get('scale',1); E.scale=(s,s,s)
    if it.get('lampNight'):
        for o in objs:
            if o.name.startswith('lamp_glass'):
                m=o.active_material
                if m and m.use_nodes:
                    b=m.node_tree.nodes.get('Principled BSDF')
                    if b: b.inputs['Emission Color'].default_value=(1,.87,.6,1); b.inputs['Emission Strength'].default_value=2
for ch in cfg.get('chars',[]):
    objs=imp(ch['glb']); roots=[o for o in objs if o.parent is None]
    E=bpy.data.objects.new('char',None); sc.collection.objects.link(E)
    for r in roots: r.parent=E
    E.location=cc2bl(ch['pos']); E.rotation_euler=(0,0,math.radians(ch.get('yaw',0)))
c=cfg['camera']; cam=bpy.data.cameras.new('cam'); cam.sensor_fit='VERTICAL'; cam.angle_y=math.radians(c['fov']); cam.clip_start=.05; cam.clip_end=1000
if c.get('ortho'): cam.type='ORTHO'; cam.ortho_scale=c['ortho']
co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); sc.camera=co
p=cc2bl(c['pos']); t=cc2bl(c['target']); co.location=p
co.rotation_euler=(t-p).to_track_quat('-Z','Y').to_euler()
sun=bpy.data.lights.new('sun','SUN'); sun.energy=cfg.get('sun',3.2); sun.color=(1,.97,.92); so=bpy.data.objects.new('sun',sun); sc.collection.objects.link(so)
so.rotation_euler=(math.radians(50),0,math.radians(-35)); sun.angle=math.radians(8)
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=cfg.get('world',(.55,.7,.8,1)); bg.inputs[1].default_value=cfg.get('worldStrength',.9)
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=cfg.get('samples',24); sc.cycles.use_denoising=True
sc.render.resolution_x,sc.render.resolution_y=cfg['res']; sc.render.film_transparent=False
sc.view_settings.view_transform='Standard'
sc.render.filepath=cfg['out']; bpy.ops.render.render(write_still=True)
print('RENDERED',cfg['out'])
