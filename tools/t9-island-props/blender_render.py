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
def tint_material(m,rgb):  # multiply the colour feeding Principled Base Color / Emission Color (runtime mainColor multiply)
    if not m or not m.use_nodes: return False
    nt=m.node_tree; done=False
    for nd in list(nt.nodes):
        for inp_name in ('Base Color','Emission Color','Color'):
            if nd.type not in ('BSDF_PRINCIPLED','EMISSION','BACKGROUND') or inp_name not in nd.inputs: continue
            inp=nd.inputs[inp_name]
            if inp.is_linked:
                src=inp.links[0].from_socket; mul=nt.nodes.new('ShaderNodeMix'); mul.data_type='RGBA'; mul.blend_type='MULTIPLY'; mul.inputs['Factor'].default_value=1
                nt.links.new(src,mul.inputs[6]); mul.inputs[7].default_value=tuple(rgb)+(1,); nt.links.new(mul.outputs[2],inp); done=True
            elif inp_name!='Emission Color' or nd.type!='BSDF_PRINCIPLED':
                v=inp.default_value; inp.default_value=(v[0]*rgb[0],v[1]*rgb[1],v[2]*rgb[2],v[3]); done=True
    return done
for name,rgb in cfg.get('tints',{}).items():
    m=bpy.data.materials.get(name); print('tint',name,tint_material(m,rgb))
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
                    if b:
                        la=it.get('lampAmber')
                        if la:  # runtime: builtin-unlit opaque mainColor -> pure emission, no lighting
                            b.inputs['Base Color'].default_value=(0,0,0,1); b.inputs['Emission Color'].default_value=tuple(la)+(1,); b.inputs['Emission Strength'].default_value=1.0
                            try: b.inputs['Specular IOR Level'].default_value=0
                            except Exception: pass
                        else: b.inputs['Emission Color'].default_value=(1,.87,.6,1); b.inputs['Emission Strength'].default_value=2
for k,fl in enumerate(cfg.get('flats',[])):  # procedural sign water: world positions (Cocos), vertex alpha, flat colour
    me=bpy.data.meshes.new('flat%d'%k); P=fl['positions']; V=[tuple(cc2bl(P[i:i+3])) for i in range(0,len(P),3)]; I=fl['indices']
    me.from_pydata(V,[],[tuple(I[i:i+3]) for i in range(0,len(I),3)]); me.update()
    ca=me.color_attributes.new('a','FLOAT_COLOR','POINT'); C=fl['colors']
    for i in range(len(V)): ca.data[i].color=(1,1,1,C[i*4+3])
    ob=bpy.data.objects.new('flat%d'%k,me); sc.collection.objects.link(ob)
    m=bpy.data.materials.new('flatm%d'%k); m.use_nodes=True; m.blend_method='BLEND'; nt=m.node_tree; nt.nodes.clear()
    out=nt.nodes.new('ShaderNodeOutputMaterial'); em=nt.nodes.new('ShaderNodeEmission'); tr=nt.nodes.new('ShaderNodeBsdfTransparent'); mx=nt.nodes.new('ShaderNodeMixShader'); at=nt.nodes.new('ShaderNodeVertexColor'); at.layer_name='a'
    mul=nt.nodes.new('ShaderNodeMath'); mul.operation='MULTIPLY'; mul.inputs[1].default_value=fl['alpha']
    em.inputs[0].default_value=tuple(fl['rgb'])+(1,); em.inputs[1].default_value=fl.get('strength',1.0)
    nt.links.new(at.outputs['Alpha'],mul.inputs[0]); nt.links.new(mul.outputs[0],mx.inputs[0]); nt.links.new(tr.outputs[0],mx.inputs[1]); nt.links.new(em.outputs[0],mx.inputs[2]); nt.links.new(mx.outputs[0],out.inputs[0])
    ob.data.materials.append(m)
for k,pl in enumerate(cfg.get('pointLights',[])):  # T9n lamp light; light linking limits it to the listed props (= Cocos Light.visibility)
    ld=bpy.data.lights.new('pl%d'%k,'POINT'); ld.energy=pl['energy']; ld.color=tuple(pl['rgb']); ld.shadow_soft_size=pl.get('radius',.1)
    try: ld.use_custom_distance=True; ld.cutoff_distance=pl['range']
    except Exception: pass
    lo=bpy.data.objects.new('pl%d'%k,ld); sc.collection.objects.link(lo); lo.location=cc2bl(pl['pos'])
    if pl.get('only'):
        col=bpy.data.collections.new('lit%d'%k)
        for o in bpy.data.objects:
            r=o
            while r.parent: r=r.parent
            if r.name==pl['only'] and o.type=='MESH': col.objects.link(o)
        try: lo.light_linking.receiver_collection=col
        except Exception as e: print('light linking unavailable',e)
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
sun=bpy.data.lights.new('sun','SUN'); sun.energy=cfg.get('sun',3.2); sun.color=tuple(cfg.get('sunColor',(1,.97,.92))); so=bpy.data.objects.new('sun',sun); sc.collection.objects.link(so)
so.rotation_euler=(math.radians(50),0,math.radians(-35)); sun.angle=math.radians(8)
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=cfg.get('world',(.55,.7,.8,1)); bg.inputs[1].default_value=cfg.get('worldStrength',.9)
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=cfg.get('samples',24); sc.cycles.use_denoising=True
sc.render.resolution_x,sc.render.resolution_y=cfg['res']; sc.render.film_transparent=False
sc.view_settings.view_transform='Standard'
sc.render.filepath=cfg['out']; bpy.ops.render.render(write_still=True)
print('RENDERED',cfg['out'])
