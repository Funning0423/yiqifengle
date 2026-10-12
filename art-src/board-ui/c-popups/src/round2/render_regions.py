# 旅程册章节预览小图：tide = 本作小岛模型 combined_visual_m.glb；meadow / sky = 低多边形占位。
# blender -b --factory-startup -P render_regions.py -- <outdir> [tide,meadow,sky]
import bpy, sys, math, os, random
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:]; OUT=argv[0]; WHICH=(argv[1].split(',') if len(argv)>1 else ['tide','meadow','sky'])
GLB='/workspace/yiqifengle/work/棋盘UI美术bot/creator-build-project/assets/bundles/region_island/combined_visual_m.glb'
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
def sun(rot=(50,0,35),e=3.0,col=(1,0.96,0.88)):
    l=bpy.data.lights.new('sun','SUN'); l.energy=e; l.color=col; l.angle=math.radians(8); o=bpy.data.objects.new('sun',l); bpy.context.scene.collection.objects.link(o)
    o.rotation_euler=[math.radians(a) for a in rot]
def cam(loc,look,lens=50):
    c=bpy.data.cameras.new('c'); c.lens=lens; o=bpy.data.objects.new('cam',c); bpy.context.scene.collection.objects.link(o); o.location=loc
    d=Vector(look)-Vector(loc); o.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); bpy.context.scene.camera=o; return o
def plane(z,size,m):
    bpy.ops.mesh.primitive_plane_add(size=size,location=(0,0,z)); o=bpy.context.object; o.data.materials.append(m); return o
def lowpoly(o):
    for p in o.data.polygons: p.use_smooth=False
def render(name):
    bpy.context.scene.render.filepath=os.path.join(OUT,name+'.png'); bpy.ops.render.render(write_still=True)

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
if 'sky' in WHICH:
    sc=reset(); sky(sc,'#b9c6ec','#f7ecdc',1.0); random.seed(5)
    rock=mat('rock',srgb('#b8a48c')); top=mat('top',srgb('#a8cf86')); cl=mat('cl',srgb('#ffffff'),0.9)
    for (x,y,z,r) in ((0,4,1.0,2.4),(-4.5,8,2.6,1.4),(4.2,9,3.2,1.1)):
        bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,depth=r*1.6,location=(x,y,z-r*0.8),rotation=(math.pi,0,0)); bpy.context.object.data.materials.append(rock)
        bpy.ops.mesh.primitive_cylinder_add(vertices=7,radius=r*1.02,depth=0.35,location=(x,y,z+0.1)); bpy.context.object.data.materials.append(top)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=0.35,depth=1.6,location=(0.6,4,1.9)); bpy.context.object.data.materials.append(mat('tw',srgb('#f2ead8')))
    bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=0.5,depth=0.6,location=(0.6,4,3.0)); bpy.context.object.data.materials.append(mat('rf',srgb('#7aa7c7')))
    for k in range(14):
        x,y,z=random.uniform(-8,8),random.uniform(0,12),random.uniform(-1.5,0.5)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(0.8,1.6),location=(x,y,z)); o=bpy.context.object; o.scale.z=0.5; o.data.materials.append(cl)
    sun((45,0,-30),3.0); cam((0,-8,3.2),(0,5,1.2),38); sc.render.film_transparent=True; render('region_sky')
print('DONE')
