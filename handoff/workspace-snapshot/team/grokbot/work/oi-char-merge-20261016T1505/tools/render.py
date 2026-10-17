import bpy,sys,math,mathutils,json
argv=sys.argv[sys.argv.index('--')+1:];CHAR,CHAIR,OUT,MODE=argv[:4]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=720;sc.render.resolution_y=960;sc.render.fps=30
def g2b(p):return mathutils.Vector((p[0],-p[2],p[1]))
def imp(f):
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=f);new=[o for o in bpy.data.objects if o not in before]
  e=bpy.data.objects.new('root_'+f.split('/')[-1],None);sc.collection.objects.link(e)
  for o in new:
    if o.parent is None:o.parent=e
  return e,new
yaw=-2.0
seatedRoot=(0.4327299768730942,0.0,-4.207611558444886);anchor=(0.4203000068664551,0.38,-4.2133002281188965)
ch,chn=imp(CHAR)
if MODE=='static':
  # Oi placement: character baked in analysis coords => world = analysisOrigin + R*p  (R = yaw about Y by -2)
  ch.location=g2b(seatedRoot);ch.rotation_euler=(0,0,yaw)
else:
  ch.location=g2b(seatedRoot);ch.rotation_euler=(0,0,yaw)
st,stn=imp(CHAIR);s=1.2;sx,sz=.00037,-.09094
st.location=g2b((anchor[0]-s*(math.cos(yaw)*sx+math.sin(yaw)*sz),.000126,anchor[2]-s*(-math.sin(yaw)*sx+math.cos(yaw)*sz)));st.rotation_euler=(0,0,yaw);st.scale=(s,s,s)
if MODE=='static':
  # placement.json: stool outer matrix in analysis coords: scale 1.2, translate (-0.000444,0.000126,0.12280)
  st.parent=ch;st.location=g2b((-0.000444,0.000126,0.1227978420148815));st.rotation_euler=(0,0,0);st.scale=(s,s,s)
arm=[o for o in chn if o.type=='ARMATURE']
clips=argv[4].split(',') if len(argv)>4 else []
bpy.ops.mesh.primitive_plane_add(size=6,location=g2b(seatedRoot));pl=bpy.context.object
m=bpy.data.materials.new('g');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.55,.6,.5,1);pl.data.materials.append(m)
sun=bpy.data.objects.new('sun',bpy.data.lights.new('sun','SUN'));sc.collection.objects.link(sun);sun.data.energy=3.5;sun.rotation_euler=(math.radians(50),0,math.radians(30))
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.75,.82,.9,1);w.node_tree.nodes['Background'].inputs[1].default_value=.8
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));sc.collection.objects.link(cam);sc.camera=cam
# facing direction of girl: local +Z (glTF) rotated by yaw
fwd=g2b((math.sin(yaw),0,math.cos(yaw)));right=fwd.cross(mathutils.Vector((0,0,1)))
base=g2b(seatedRoot)
views={'front':(fwd*2.6+mathutils.Vector((0,0,0.9)),0.75,30),'side':(right*2.6+mathutils.Vector((0,0,0.9)),0.75,30),'back':(-fwd*2.6+mathutils.Vector((0,0,0.9)),0.75,30),
 'closeseat':(fwd*0.9+right*0.6+mathutils.Vector((0,0,0.55)),0.45,40),'closeside':(right*1.0+mathutils.Vector((0,0,0.45)),0.42,40),'closefeet':(fwd*0.9+right*0.3+mathutils.Vector((0,0,0.25)),0.1,40),'closehands':(fwd*0.8+right*-0.3+mathutils.Vector((0,0,0.75)),0.6,40)}
def shoot(tag):
  for v,(off,tz,lens) in views.items():
    cam.location=base+off;cam.data.lens=lens
    d=(base+mathutils.Vector((0,0,tz)))-cam.location;cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=f'{OUT}_{tag}_{v}.png';bpy.ops.render.render(write_still=True)
if not clips: shoot('static')
for c in clips:
  name,fr=c.split('@');act=bpy.data.actions.get(name) or next((a for a in bpy.data.actions if a.name.startswith(name)),None)
  if act is None: print('NOACTION',name,[a.name for a in bpy.data.actions][:20]);continue
  for a in arm:
    a.animation_data_create();a.animation_data.action=act
  r=act.frame_range;f=int(r[0]+(r[1]-r[0])*float(fr));sc.frame_set(f);shoot(f'{name}{fr}')
  print('CLIP',name,act.frame_range,f)
