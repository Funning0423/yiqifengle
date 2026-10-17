# 方案 B 棋盘相机验证渲染。blender -b -P sky_verify.py -- <qa/sky_b.json> <outdir>
import bpy, sys, json, math, os
from mathutils import Vector
a=sys.argv[sys.argv.index('--')+1:]; D=json.load(open(a[0])); OUT=a[1]
GLB='/workspace/wechat-game/work/wt-v2/creator-build-project/assets/bundles/region_skycity/env_skycity.glb'
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE'; sc.eevee.taa_render_samples=16; sc.view_settings.view_transform='Standard'
bpy.ops.import_scene.gltf(filepath=GLB)
for o in list(sc.objects):
    if 'before' in o.name and o.name.startswith('state_'):
        for c in [o]+list(o.children_recursive): c.hide_render=True
    if o.type=='CAMERA': o.hide_render=True
B=lambda p:Vector((p[0],-p[2],p[1]))           # Cocos (y-up) -> Blender
def emis(name,c):
    m=bpy.data.materials.new(name); m.use_nodes=True; N=m.node_tree.nodes; N.clear(); o=N.new('ShaderNodeOutputMaterial'); e=N.new('ShaderNodeEmission'); e.inputs[0].default_value=(*c,1); m.node_tree.links.new(e.outputs[0],o.inputs[0]); return m
BAND=[(0.95,0.30,0.38),(1.0,0.56,0.22),(1.0,0.84,0.30),(0.42,0.84,0.45),(0.26,0.78,0.90),(0.38,0.52,0.98),(0.70,0.42,0.92)]
lin=lambda c:tuple(((x+0.055)/1.055)**2.4 for x in c)
P=[Vector(p) for p in D['bridgeLocal']]
for k in range(7):                                   # verification stand-in of the deck (7 bands, 0.2 m thick)
    vs=[];fs=[]
    for i,p in enumerate(P):
        q=P[min(i+1,len(P)-1)]-P[max(i-1,0)]; side=Vector((q.z,0,-q.x)).normalized()
        for s in (k/7-.5,(k+1)/7-.5):
            c=p+side*s*2.1; vs+=[B(c),B(c-Vector((0,0.2,0)))]
    n=len(P)
    for i in range(n-1):
        b=i*4; fs.append((b,b+2,b+6,b+4)); fs.append((b+1,b+5,b+7,b+3))
        if k==0: fs.append((b,b+4,b+5,b+1))
        if k==6: fs.append((b+2,b+3,b+7,b+6))
    me=bpy.data.meshes.new('rb%d'%k); me.from_pydata(vs,[],fs); o=bpy.data.objects.new('rb%d'%k,me); sc.collection.objects.link(o); o.data.materials.append(emis('b%d'%k,lin(BAND[k])))
def girl(p):
    objs=[]
    def add(op,**kw):
        op(**kw); o=bpy.context.object; objs.append(o); return o
    f=B(p)
    add(bpy.ops.mesh.primitive_cone_add,vertices=8,radius1=.34,radius2=.12,depth=.78,location=f+Vector((0,0,.55))).data.materials.append(emis('d',(1,.75,.02)))
    add(bpy.ops.mesh.primitive_uv_sphere_add,radius=.14,location=f+Vector((0,0,1.33))).data.materials.append(emis('s',(.9,.62,.5)))
    add(bpy.ops.mesh.primitive_cylinder_add,vertices=12,radius=.28,depth=.03,location=f+Vector((0,0,1.47))).data.materials.append(emis('h',(.75,.55,.25)))
    add(bpy.ops.mesh.primitive_cylinder_add,vertices=10,radius=.13,depth=.13,location=f+Vector((0,0,1.54))).data.materials.append(emis('h',(.75,.55,.25)))
    for sx in (-.08,.08): add(bpy.ops.mesh.primitive_cylinder_add,vertices=6,radius=.04,depth=.22,location=f+Vector((sx,0,.11))).data.materials.append(emis('s',(.9,.62,.5)))
    return objs
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.35,0.62,0.85,1)
sun=bpy.data.lights.new('s','SUN'); sun.energy=3; so=bpy.data.objects.new('s',sun); sc.collection.objects.link(so); so.rotation_euler=(math.radians(40),0,math.radians(30))
cd=bpy.data.cameras.new('c'); cd.sensor_fit='VERTICAL'; cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
for b in D['boards']:
    if b['screen'] not in ('390x844','375x667','390x520','768x1024'): continue
    w_,h_=map(int,b['screen'].split('x')); sc.render.resolution_x=w_*2; sc.render.resolution_y=h_*2
    g=girl(b['stopLocal']); c=b['camera']; cam.location=B(c['position']); d=B(c['target'])-B(c['position']); cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); cd.angle_y=math.radians(c['fovVerticalDeg'])
    sc.render.filepath=os.path.join(OUT,'skyB_board_%s.png'%b['screen']); bpy.ops.render.render(write_still=True); print('RENDERED',b['screen'],flush=True)
    for o in g: bpy.data.objects.remove(o,do_unlink=True)
print('ALLDONE',flush=True)
