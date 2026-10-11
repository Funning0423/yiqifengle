import bpy,sys,json,math,mathutils
a=sys.argv[sys.argv.index('--')+1:];room,chr_,shots,outdir=a[0],a[1],json.load(open(a[2])),a[3];MODE=a[4] if len(a)>4 else 'FLAT'
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=room); roomobjs=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=chr_); chobjs=[o for o in bpy.data.objects if o not in roomobjs]
# Workbench TEXTURE samples the material's ACTIVE image node; make it the Base Color texture (not the emissive map)
for m in bpy.data.materials:
  if not m.use_nodes: continue
  for l in m.node_tree.links:
    if l.to_socket.name=='Base Color' and l.from_node.type=='TEX_IMAGE': m.node_tree.nodes.active=l.from_node
for o in chobjs:
  if o.name.startswith('Icosphere'): o.hide_render=True
roots=[o for o in chobjs if o.parent is None and not o.name.startswith('Icosphere')]
arm=[o for o in chobjs if o.type=='ARMATURE'][0]
holder=bpy.data.objects.new('chr_holder',None); bpy.context.scene.collection.objects.link(holder)
for r in roots: r.parent=holder
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading
sh.light=MODE; sh.color_type='TEXTURE'; sh.show_shadows=(MODE!='FLAT'); sh.shadow_intensity=0.25; sh.show_cavity=(MODE=='FLAT'); sh.cavity_type='WORLD'; sh.curvature_ridge_factor=0.4; sh.curvature_valley_factor=0.8
sc.render.resolution_x=586; sc.render.resolution_y=1266; sc.render.resolution_percentage=100
sc.world=sc.world or bpy.data.worlds.new('w'); 
cd=bpy.data.cameras.new('cam'); cd.sensor_fit='VERTICAL'; cd.clip_start=0.05; cd.clip_end=1000
cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
conv=mathutils.Quaternion((1,0,0),math.radians(90))
def bl(v): return mathutils.Vector((v[0],-v[2],v[1]))
for s in shots:
  q=s['rot']; qc=mathutils.Quaternion((q[3],q[0],q[1],q[2]))
  cam.location=bl(s['pos']); cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=conv@qc
  cd.lens_unit='FOV'; cd.angle=math.radians(s['fov'])   # with sensor_fit VERTICAL, angle is the vertical fov
  holder.location=bl(s['root']); holder.rotation_euler=(0,0,float(s['yaw'])); holder.scale=(1.0611643605259733,)*3
  act=bpy.data.actions.get(s['clip']); arm.animation_data_create(); arm.animation_data.action=act
  sc.frame_set(int(s['frame']))
  sc.render.filepath=outdir+'/'+s['name']+'.png'; bpy.ops.render.render(write_still=True)
  print('RENDERED',s['name'])
