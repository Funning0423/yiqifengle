import bpy,sys,json,math,mathutils
a=sys.argv[sys.argv.index('--')+1:];room,chr_,shots,outdir,spill=a[0],a[1],json.load(open(a[2])),a[3],json.load(open(a[4]))
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=room); roomobjs=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=chr_); chobjs=[o for o in bpy.data.objects if o not in roomobjs]
for o in chobjs:
  if o.name.startswith('Icosphere'): o.hide_render=True
roots=[o for o in chobjs if o.parent is None and not o.name.startswith('Icosphere')]; arm=[o for o in chobjs if o.type=='ARMATURE'][0]
holder=bpy.data.objects.new('chr_holder',None); bpy.context.scene.collection.objects.link(holder)
for r in roots: r.parent=holder
for o in bpy.data.objects: o.color=(0,0,0,1)
g=spill['g']; P=g['positions']; verts=[(P[i],-P[i+2],P[i+1]) for i in range(0,len(P),3)]; I=g['indices']; faces=[(I[i],I[i+1],I[i+2]) for i in range(0,len(I),3)]
me=bpy.data.meshes.new('spill'); me.from_pydata(verts,[],faces); dec=bpy.data.objects.new('spill',me); bpy.context.scene.collection.objects.link(dec); dec.color=(1,1,1,1)
sc=bpy.context.scene; sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading
sh.light='FLAT'; sh.color_type='OBJECT'; sh.show_shadows=False; sh.show_cavity=False; sh.show_object_outline=False; sh.show_backface_culling=False
sc.render.resolution_x=586; sc.render.resolution_y=1266; sc.render.resolution_percentage=100; sc.display.render_aa='8'
sc.view_settings.view_transform='Standard'
cd=bpy.data.cameras.new('cam'); cd.sensor_fit='VERTICAL'; cd.clip_start=0.05; cd.clip_end=1000
cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
conv=mathutils.Quaternion((1,0,0),math.radians(90))
def bl(v): return mathutils.Vector((v[0],-v[2],v[1]))
for s in shots:
  q=s['rot']; cam.location=bl(s['pos']); cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=conv@mathutils.Quaternion((q[3],q[0],q[1],q[2]))
  cd.lens_unit='FOV'; cd.angle=math.radians(s['fov'])
  holder.location=bl(s['root']); holder.rotation_euler=(0,0,float(s['yaw'])); holder.scale=(1.0611643605259733,)*3
  arm.animation_data_create(); arm.animation_data.action=bpy.data.actions.get(s['clip']); sc.frame_set(int(s['frame']))
  sc.render.filepath=outdir+'/'+s['name']+'_mask.png'; bpy.ops.render.render(write_still=True); print('RENDERED',s['name'])
