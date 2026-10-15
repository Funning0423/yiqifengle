# v7 preview: same Cocos-matched Eevee lighting as v5 (render_v5.py), NLA clips looped, portrait gameplay camera
import bpy,sys,math,os
from mathutils import Vector
glb,outdir,tag,mode=sys.argv[-4:]; os.makedirs(outdir,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene; sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=glb)
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.eevee.taa_render_samples=8
for k,v in (('use_gtao',False),('use_fast_gi',False),('use_volumetric_shadows',False),('use_shadows',True)):
    if hasattr(sc.eevee,k): setattr(sc.eevee,k,v)
print('EEVEE_PROPS',[p.identifier for p in sc.eevee.bl_rna.properties if any(s in p.identifier for s in ('gi','ao','ray','shadow','clamp','light'))])
if hasattr(sc.eevee,'use_raytracing'): sc.eevee.use_raytracing=False
for m in bpy.data.materials:
    if hasattr(m,'surface_render_method'): m.surface_render_method='DITHERED'
    if hasattr(m,'blend_method'): m.blend_method='OPAQUE'
    if m.node_tree:
        for n in m.node_tree.nodes:
            if n.type=='BSDF_PRINCIPLED' and 'Specular IOR Level' in n.inputs: n.inputs['Specular IOR Level'].default_value=min(n.inputs['Specular IOR Level'].default_value,0.2)
sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'
def srgb(c): return [((x/255+0.055)/1.055)**2.4 for x in c]
w=bpy.data.worlds.new('w'); w.use_nodes=True; bg=w.node_tree.nodes['Background']
sky=srgb((51,128,204)); bg.inputs[0].default_value=(*[0.78*s for s in sky],1); sc.world=w
def sun(name,d,strength,col):
    o=bpy.data.objects.new(name,bpy.data.lights.new(name,'SUN')); o.data.energy=strength; o.data.color=col
    o.rotation_euler=Vector(d).to_track_quat('-Z','Y').to_euler(); sc.collection.objects.link(o)
    for k,v in (('shadow_filter_radius',3.0),('shadow_maximum_resolution',0.02),('shadow_resolution_limit',0.02)):
        if hasattr(o.data,k): setattr(o.data,k,v)
sun('cocos_main_dir',(0.433,0.75,-0.5),1.69,(1,1,1))
kd=(Vector((0,0,5))-Vector((-25,-25,80))).normalized(); sun('MeadowKeyLight_approx',tuple(kd),0.6,tuple(srgb((255,243,218))))
for n in ('meadow_sky_dome','meadow_far_hills','meadow_clouds_near'):   # Cocos: these never cast shadows (unlit/background)
    if n in bpy.data.objects: bpy.data.objects[n].visible_shadow=False
# preview-only: replace Principled with plain Diffuse (Cocos builtin-standard at roughness .9 ~ diffuse); removes Eevee per-pixel noise seen on palette surfaces
for m in bpy.data.materials:
    if not m.node_tree: continue
    nt=m.node_tree; pb=next((n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'),None); out=next((n for n in nt.nodes if n.type=='OUTPUT_MATERIAL'),None)
    if not pb or not out or not out.inputs['Surface'].is_linked or out.inputs['Surface'].links[0].from_node!=pb: continue
    d=nt.nodes.new('ShaderNodeBsdfDiffuse'); bc=pb.inputs['Base Color']
    if bc.is_linked: nt.links.new(bc.links[0].from_socket,d.inputs['Color'])
    else: d.inputs['Color'].default_value=bc.default_value
    nt.links.new(d.outputs[0],out.inputs['Surface'])
for m in bpy.data.materials:
    if m.node_tree:
        for n in m.node_tree.nodes:
            if n.type=='TEX_IMAGE' and n.image and n.image.name=='meadow_palette_256': n.interpolation='Closest'
# loop every imported clip via NLA
for o in bpy.data.objects:
    ad=o.animation_data
    if not ad: continue
    ad.action=None
    for tr in ad.nla_tracks:
        tr.mute=False
        for st in tr.strips: st.repeat=max(1.0,math.ceil(1000/(st.action_frame_end-st.action_frame_start)))
gp=bpy.data.objects['CAM_spawn_pov']; gp.data.clip_end=1000; gp.data.sensor_fit='VERTICAL'; sc.camera=gp
if mode=='still':
    sc.render.resolution_x,sc.render.resolution_y=750,1624; sc.frame_set(int(sys.argv[-5]) if sys.argv[-5].isdigit() else 60)
    sc.render.filepath=f'{outdir}/{tag}_08_gameplay_portrait_750x1624.png'; bpy.ops.render.render(write_still=True)
else:
    a,b=[int(x) for x in mode.split('-')]
    sc.eevee.taa_render_samples=4; sc.render.resolution_x,sc.render.resolution_y=540,1170
    sc.frame_start,sc.frame_end=a,b; sc.render.filepath=f'{outdir}/frames/f_'; bpy.ops.render.render(animation=True)
