import bpy,json,math,numpy as np,os
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.environ['CITY'])
bpy.ops.import_scene.gltf(filepath=os.environ['SEA'])
for o in list(bpy.data.objects):
  if o.name.startswith(('env_sky_cloudsea','env_sky_cumulus_far')) and o.name!='env_sky_cloudsea_soft':o.hide_render=True
  if o.name.startswith(('state_')) and 'before' in o.name:o.hide_render=True
sea=bpy.data.objects['env_sky_cloudsea_soft']
m=bpy.data.materials.new('seamat');m.use_nodes=True;nt=m.node_tree;bs=nt.nodes['Principled BSDF']
ca=nt.nodes.new('ShaderNodeVertexColor');ca.layer_name='Color';nt.links.new(ca.outputs[0],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=0.9
sea.data.materials.clear();sea.data.materials.append(m)
sc=bpy.context.scene;sc.render.engine='BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x=720;sc.render.resolution_y=1280;sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(0.33,0.6,0.74,1);w.node_tree.nodes['Background'].inputs[1].default_value=0.9
s=bpy.data.lights.new('sun','SUN');s.energy=3.2;so=bpy.data.objects.new('sun',s);sc.collection.objects.link(so);so.rotation_euler=(math.radians(50),0,math.radians(35))
cd=bpy.data.cameras.new('c');cam=bpy.data.objects.new('c',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.sensor_fit='VERTICAL';cd.clip_end=3000;cd.clip_start=0.1
def g2b(p):return Vector((p[0],-p[2],p[1]))
j=json.load(open('flight.json'));Mi=np.linalg.inv(np.array(j['seam']['skycityRootWorld']['matrix_rowmajor']))
shots={}
for t in (22.0,34.9):
  k=min(j['keys'],key=lambda k:abs(k['t']-t))
  shots['flight_t%04.1f'%t]=(g2b(Mi@np.array(k['cam']+[1])),g2b(Mi@np.array(k['camLook']+[1])),48)
a={o.name:o.matrix_world.translation for o in bpy.data.objects if o.name.startswith('anchor')}
c=a['anchor_starcourt_center'];sp=a['anchor_spawn_girl']
out=(sp-c);out.z=0;out.normalize()
look=sp+Vector((0,0,1.25))
up=Vector((0,0,1))
P=c+out*48+up*10;shots['rim_closeup_down']=(P,P+out*60-up*45,48)
P=c+out*40+up*4;shots['rim_horizon']=(P,P+out*200-up*12,48)
P=c-out*38+up*48;shots['board_high']=(P,c,55)
sc.eevee.taa_render_samples=16
for name,(P,L,fov) in shots.items():
  cam.location=P;cam.rotation_euler=(L-P).to_track_quat('-Z','Y').to_euler();cd.angle=math.radians(fov)
  sc.render.filepath=os.environ['OUT']+'_'+name+'.png';bpy.ops.render.render(write_still=True);print('SHOT',name,tuple(P))
