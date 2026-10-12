# 旅程册章节预览小图：tide = 小岛 combined_visual_m.glb；sky = 天空城 env_skycity.glb；meadow = 草甸场景 GLB（还没建，默认跳过）。
# blender -b --factory-startup -P render_regions.py -- <outdir> [tide,meadow,sky]
# 草甸场景建好后：放到 MEADOW_GLB（或用环境变量 MEADOW_GLB 指定），再给 meadow 段补相机。PLACEHOLDER=1 可以重出旧占位图。
import bpy, sys, math, os, random
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:]; OUT=argv[0]; WHICH=(argv[1].split(',') if len(argv)>1 else ['tide','meadow','sky'])
REPO=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../../../..'))
BUNDLES=os.path.join(REPO,'creator-build-project/assets/bundles')
GLB=os.path.join(BUNDLES,'region_island/combined_visual_m.glb')
SKY_GLB=os.path.join(BUNDLES,'region_skycity/env_skycity.glb')
MEADOW_GLB=os.environ.get('MEADOW_GLB',os.path.join(BUNDLES,'region_meadow/env_meadow.glb'))
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
    sc.render.engine='CYCLES'; sc.cycles.samples=24; sc.cycles.use_denoising=True; sc.cycles.max_bounces=4; sc.render.threads_mode='FIXED'; sc.render.threads=4; sc.render.resolution_x=720; sc.render.resolution_y=440; sc.render.film_transparent=False
    sc.view_settings.view_transform='Standard'
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; return sc
def mat(name,col,rough=0.8,emit=0):
    m=bpy.data.materials.new(name); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Roughness'].default_value=rough
    if emit: b.inputs['Emission Color'].default_value=(*col,1); b.inputs['Emission Strength'].default_value=emit
    return m
def srgb(h): h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]; return tuple((x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4) for x in c)
def sky(sc,top,hor,strength=1.0):
    nt=sc.world.node_tree; bg=nt.nodes['Background']; tc=nt.nodes.new('ShaderNodeTexCoord'); sep=nt.nodes.new('ShaderNodeSeparateXYZ'); ramp=nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'],sep.inputs[0]); nt.links.new(sep.outputs['Z'],ramp.inputs['Fac'])
    ramp.color_ramp.elements[0].position=0.5; ramp.color_ramp.elements[0].color=(*srgb(hor),1); ramp.color_ramp.elements[1].position=0.75; ramp.color_ramp.elements[1].color=(*srgb(top),1)
    nt.links.new(ramp.outputs['Color'],bg.inputs['Color']); bg.inputs['Strength'].default_value=strength
    return nt,bg
SKY_STOPS=((0.0,'#9fc2e6'),(0.40,'#c9dcee'),(0.50,'#f4ecdf'),(0.60,'#b6cdee'),(1.0,'#9dbbe8'))   # 俯看云海也是天：下方浅蓝雾、地平线暖白、上方天蓝
def t9_sky(sc,stops=SKY_STOPS):
    """镜头看到的是渐变天空；照明仍是 A 套 T9 天光 (0.62,0.80,0.95)×0.55。"""
    nt,bg=sky(sc,stops[-1][1],stops[0][1],1.0); out=nt.nodes['World Output']; ramp=next(n for n in nt.nodes if n.type=='VALTORGB')
    els=ramp.color_ramp.elements; els[0].position=stops[0][0]; els[1].position=stops[-1][0]
    for p,_ in stops[1:-1]: els.new(p)
    for e in els: e.color=(*srgb(min(stops,key=lambda s:abs(s[0]-e.position))[1]),1)
    amb=nt.nodes.new('ShaderNodeBackground'); amb.inputs['Color'].default_value=(0.62,0.80,0.95,1); amb.inputs['Strength'].default_value=0.55
    lp=nt.nodes.new('ShaderNodeLightPath'); mix=nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'],mix.inputs['Fac']); nt.links.new(amb.outputs[0],mix.inputs[1]); nt.links.new(bg.outputs[0],mix.inputs[2]); nt.links.new(mix.outputs[0],out.inputs['Surface'])
def sun(rot=(50,0,35),e=3.0,col=(1,0.96,0.88)):
    l=bpy.data.lights.new('sun','SUN'); l.energy=e; l.color=col; l.angle=math.radians(8); o=bpy.data.objects.new('sun',l); bpy.context.scene.collection.objects.link(o)
    o.rotation_euler=[math.radians(a) for a in rot]; return o
def t9_sun():
    o=sun(e=2.35,col=(1.0,0.97,0.92)); o.rotation_euler=Vector((0.55,0.60,-0.75)).normalized().to_track_quat('-Z','Y').to_euler(); return o
def cam(loc,look,lens=50):
    c=bpy.data.cameras.new('c'); c.lens=lens; c.clip_end=3000; o=bpy.data.objects.new('cam',c); bpy.context.scene.collection.objects.link(o); o.location=loc
    d=Vector(look)-Vector(loc); o.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); bpy.context.scene.camera=o; return o
def plane(z,size,m):
    bpy.ops.mesh.primitive_plane_add(size=size,location=(0,0,z)); o=bpy.context.object; o.data.materials.append(m); return o
def lowpoly(o):
    for p in o.data.polygons: p.use_smooth=False
def render(name):
    bpy.context.scene.render.filepath=os.path.join(OUT,name+'.png'); bpy.ops.render.render(write_still=True)
def skycity_import(sc):
    """天空城默认态：去掉交互完成后的 state_*_after 件、导出残留的 Icosphere，
    以及跟 state_ring_before 同一网格的 env_sky_starring（两份叠在一起会出现双环）。"""
    bpy.ops.import_scene.gltf(filepath=SKY_GLB)
    for o in list(sc.objects):
        if o.type=='MESH' and (o.name in ('Icosphere','env_sky_starring') or o.name.startswith('state_') and '_after' in o.name): bpy.data.objects.remove(o,do_unlink=True)

if 'tide' in WHICH:
    sc=reset(); sky(sc,'#9cc9e0','#f3e9d2',1.0)
    bpy.ops.import_scene.gltf(filepath=GLB)
    for o in list(sc.objects):
        n=o.name
        if o.type=='MESH' and any(k in n for k in ('sky_dome','cloud_layer','night','interior','beam','seagull_fly')): bpy.data.objects.remove(o,do_unlink=True)
    sun((55,0,-40),3.0)
    # 3/4 俯视：从南偏东看小岛、灯塔和海边沙滩
    cam((22,-42,17),(2.0,-1.5,1.8),42)
    sc.render.film_transparent=False
    render('region_tide')
if 'meadow' in WHICH:
    if os.path.exists(MEADOW_GLB):
        sc=reset(); sky(sc,'#a9d3e6','#f6efd9',1.0)
        bpy.ops.import_scene.gltf(filepath=MEADOW_GLB)
        sun((55,0,-40),3.0)
        raise SystemExit('meadow: 场景 GLB 已就位，先按模型尺寸补相机再渲（参照 sky 段）')
    elif os.environ.get('PLACEHOLDER')=='1':
        sc=reset(); sky(sc,'#a9d3e6','#f6efd9',1.0); random.seed(3)
        g=mat('grass',srgb('#9cc66b')); g2=mat('grass2',srgb('#7fb05a')); fl=[mat('f%d'%i,srgb(h)) for i,h in enumerate(('#f4d35e','#f6a6b2','#ffffff','#f29e4c'))]
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=18,y_subdivisions=18,size=24); gr=bpy.context.object; gr.data.materials.append(g)
        for v in gr.data.vertices: v.co.z=0.55*math.sin(v.co.x*0.45)+0.45*math.cos(v.co.y*0.38+1)+random.uniform(-0.12,0.12)
        lowpoly(gr)
        for k in range(4):   # 远山
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=4+k,location=(-10+k*7,14+k*2,-1.5)); h=bpy.context.object; h.scale.z=0.55; h.data.materials.append(g2)
        for k in range(70):  # 小花
            x,y=random.uniform(-7,7),random.uniform(-4,9); z=0.55*math.sin(x*0.45)+0.45*math.cos(y*0.38+1)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(0.09,0.16),location=(x,y,z+0.12)); bpy.context.object.data.materials.append(random.choice(fl))
        for x,y in ((-3,5),(4,7),(1.5,3)):   # 低多边形树
            bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=0.15,depth=1.2,location=(x,y,1.1)); bpy.context.object.data.materials.append(mat('tr',srgb('#8a5a3b')))
            bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=0.9,depth=1.9,location=(x,y,2.4)); bpy.context.object.data.materials.append(g2)
        sun((50,0,30),3.0); cam((0,-9,3.6),(0,4,0.8),38); sc.render.film_transparent=True; render('region_meadow')
    else:
        print('SKIP meadow: 没有草甸场景 GLB（%s），raw/regions/region_meadow.png 保持占位'%MEADOW_GLB)
if 'sky' in WHICH:
    sc=reset(); t9_sky(sc); skycity_import(sc); t9_sun()
    # 3/4 俯视：从东南看整座浮岛（大树、星环、遗迹、星之庭和机器人），岛底的藤蔓和瀑布落进云里
    cam((150,-205,108),(2,-6,18),68)
    render('region_sky')
print('DONE')
