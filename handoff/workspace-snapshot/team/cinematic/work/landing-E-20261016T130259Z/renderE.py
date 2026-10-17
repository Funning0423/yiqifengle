import bpy,json,sys,math,mathutils,random,os
a=sys.argv[sys.argv.index('--')+1:];objp,posep,out=a[0],a[1],a[2];lim=int(a[3]) if len(a)>3 else 10**9
poses=json.load(open(posep))[:lim];os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=objp,forward_axis='NEGATIVE_Z',up_axis='Y')
B=lambda p:mathutils.Vector((p[0],-p[2],p[1]))
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='OBJECT'
sc.display.shading.show_shadows=False;sc.render.resolution_x=390;sc.render.resolution_y=844;sc.world=bpy.data.worlds.new('w');sc.world.color=(0.03,0.05,0.16)
for o in list(sc.objects):
  n=o.name.lower();random.seed(n)
  base=(0.55,0.5,0.45) if n.startswith('island') else (0.35,0.6,0.3) if n.startswith('meadow') else (0.62,0.6,0.72)
  if 'foliage' in n or 'grass' in n or 'tree' in n: base=(0.25,0.55,0.25)
  if 'rainbow' in n or 'bridge' in n: base=(0.9,0.6,0.9)
  j=lambda c:min(1,max(0,c+random.uniform(-.08,.08)));o.color=(j(base[0]),j(base[1]),j(base[2]),1)
bpy.ops.mesh.primitive_plane_add(size=1600,location=(0,0,-0.918));bpy.context.object.color=(0.05,0.2,0.35,1)
cam=bpy.data.cameras.new('c');co=bpy.data.objects.new('c',cam);sc.collection.objects.link(co);sc.camera=co;cam.sensor_fit='VERTICAL';cam.clip_end=1500;cam.clip_start=.05
# character: body + head + facing nose, parented to an empty
emp=bpy.data.objects.new('her',None);sc.collection.objects.link(emp)
def part(op,col,**k):
  op(**k);o=bpy.context.object;o.color=col;o.parent=emp;return o
part(bpy.ops.mesh.primitive_cylinder_add,(1,.25,.2,1),radius=.22,depth=1.1,location=(0,0,.55))
part(bpy.ops.mesh.primitive_uv_sphere_add,(1,.85,.6,1),radius=.2,location=(0,0,1.35))
part(bpy.ops.mesh.primitive_cone_add,(1,1,.1,1),radius1=.07,depth=.25,location=(0,.25,1.35),rotation=(-math.pi/2,0,0))
for p in poses:
  if os.path.exists(f"{out}/{p['i']:04d}.png"): continue
  emp.location=B(p['root']);emp.rotation_euler=(0,0,-p['yaw']+0)  # yaw=atan2(x,z); blender fwd +Y = -world z... set below
  fx,fz=math.sin(p['yaw']),math.cos(p['yaw']);f=B([fx,0,fz]);emp.rotation_euler=(0,0,math.atan2(-f.x,f.y))
  cam.angle=math.radians(p['fov']);co.location=B(p['position']);d=B(p['target'])-B(p['position']);co.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
  sc.render.filepath=f"{out}/{p['i']:04d}.png";bpy.ops.render.render(write_still=True)
