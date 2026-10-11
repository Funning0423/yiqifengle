import os
# shared helpers: game-like lighting (Cocos WorldR5Integration.scene island light), camera, model loading
import bpy, math, os
from mathutils import Vector, Matrix
HY=os.environ.get('HUNYUAN_GLB','/workspace/yiqifengle/previews/grokbot/hunyuan-head/hunyuan_head_v31.glb')
R2=os.path.join(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../..'),'head-r2/chr_b_r5g2_head-r2_TEST.glb')
# Hunyuan -> R2 head space: hair width 0.62 -> 0.281 (= R2 0.258 x 1.09, PM-approved +8-10%), chin z 0.30 -> R2 chin 1.464
HY_S=0.453; HY_T=(0.0,0.0,1.464-0.30*0.453)
# Cocos: Main Light euler(-30,-30,0), 125000 lx white, LDR exposure 1/38400 -> 3.255 (Cocos & Cycles both divide Lambert by pi)
SUN_DIR_COCOS=(0.433,-0.5,-0.75)          # light travel dir, Y-up, camera on +Z
SUN_DIR=Vector((0.433,0.75,-0.5))           # Blender Z-up, she faces -Y, camera on -Y
SUN_STRENGTH=3.255
def s2l(c): c=c/255; return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
AMB=20000/38400
SKY=[s2l(c)*AMB for c in (51,128,204)]; GROUND=[s2l(c)*AMB for c in (51,51,51)]
BG=(0.70,0.73,0.78)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc=bpy.context.scene
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=int(os.environ.get('SPP','48'))
    sc.cycles.use_denoising=True
    try: sc.cycles.denoiser='OPENIMAGEDENOISE'
    except Exception: pass
    sc.cycles.max_bounces=4
    sc.render.film_transparent=True; sc.view_settings.view_transform='Standard'
    # hemisphere ambient like Cocos: mix(ground, sky, n.z*0.5+0.5)
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; nt.nodes.clear()
    tc=nt.nodes.new('ShaderNodeTexCoord'); sep=nt.nodes.new('ShaderNodeSeparateXYZ'); mr=nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value=-1; mr.inputs['From Max'].default_value=1
    mix=nt.nodes.new('ShaderNodeMix'); mix.data_type='RGBA'
    mix.inputs['A'].default_value=(*GROUND,1); mix.inputs['B'].default_value=(*SKY,1)
    bg=nt.nodes.new('ShaderNodeBackground'); out=nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(tc.outputs['Generated'],sep.inputs[0]); nt.links.new(sep.outputs['Z'],mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'],mix.inputs['Factor']); nt.links.new(mix.outputs['Result'],bg.inputs['Color'])
    nt.links.new(bg.outputs[0],out.inputs[0])
    ld=bpy.data.lights.new('sun','SUN'); ld.energy=SUN_STRENGTH; ld.angle=math.radians(2)
    ld.use_shadow=False  # scene: sun does not cast shadows (planar shadow only)
    sun=bpy.data.objects.new('sun',ld); sc.collection.objects.link(sun)
    cd=bpy.data.cameras.new('cam'); cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
    return sc,sun,cam

def load_hy(path=HY):
    bpy.ops.import_scene.gltf(filepath=path)
    o=[o for o in bpy.context.selected_objects if o.type=='MESH']
    for x in o:
        x.scale=(HY_S,)*3; x.location=HY_T
    cocos_pbr()
    return o

def cocos_pbr():
    # Cocos builtin-standard ignores KHR_materials_specular (importer sets factor 2.0 -> plastic look); use F0=0.04
    for m in bpy.data.materials:
        if not m.node_tree: continue
        for n in m.node_tree.nodes:
            if n.type=='BSDF_PRINCIPLED':
                for l in list(n.inputs['Specular IOR Level'].links)+list(n.inputs['Specular Tint'].links): m.node_tree.links.remove(l)
                n.inputs['Specular IOR Level'].default_value=0.5; n.inputs['Specular Tint'].default_value=(1,1,1,1)

def load_r2(path=R2):
    bpy.ops.import_scene.gltf(filepath=path)
    for o in list(bpy.data.objects):
        if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
    arms=[o for o in bpy.data.objects if o.type=='ARMATURE']
    for arm in arms:
        if arm.animation_data:
            for t in arm.animation_data.nla_tracks: t.mute=True
            arm.animation_data.action=None
        for pb in arm.pose.bones: pb.matrix_basis.identity()
    cocos_pbr()
    return [o for o in bpy.data.objects if o.type=='MESH']

def shoot(sc,sun,cam,s,path,light_follows=True):
    az=math.radians(s['az']); el=math.radians(s.get('el',0)); tgt=Vector(s['target'])
    d=Vector((math.sin(az)*math.cos(el),-math.cos(az)*math.cos(el),math.sin(el)))
    cam.location=tgt+d*4; cam.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'; cam.data.ortho_scale=s['scale']; cam.data.clip_start=0.01
    # in game the camera and sun are fixed and she turns: keep sun fixed relative to the camera azimuth
    R=Matrix.Rotation(az if light_follows else 0,3,'Z')
    sun.rotation_euler=(R@SUN_DIR).to_track_quat('-Z','Y').to_euler()
    sc.render.resolution_x,sc.render.resolution_y=s.get('res',[600,600])
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)
