import bpy,sys,json,pathlib,numpy as np,math,hashlib
from mathutils import Vector,Matrix,Quaternion
sys.path.insert(0,str(pathlib.Path('character-fix/art-src/animation/mocap/scripts').resolve()));import rig as R
def accessor(i):
 ac=rig.J['accessors'][i];out=R.acc(rig.J,rig.BIN,i).copy() if 'bufferView' in ac else np.zeros((ac['count'],R.NC[ac['type']]),dtype=R.CT[ac['componentType']])
 if 'sparse' in ac:
  sp=ac['sparse'];inds=sp['indices'];bv=rig.J['bufferViews'][inds['bufferView']];ix=np.frombuffer(rig.BIN,dtype=R.CT[inds['componentType']],count=sp['count'],offset=bv.get('byteOffset',0)+inds.get('byteOffset',0));vals=sp['values'];bv=rig.J['bufferViews'][vals['bufferView']];v=np.frombuffer(rig.BIN,dtype=R.CT[ac['componentType']],count=sp['count']*R.NC[ac['type']],offset=bv.get('byteOffset',0)+vals.get('byteOffset',0)).reshape(-1,R.NC[ac['type']]);out[ix]=v
 return out
O=pathlib.Path('../candidate/seat-renders');O.mkdir(exist_ok=True,parents=True)
rep=json.load(open('../candidate/replay.json'));rep['glb']=str(pathlib.Path('../candidate/candidate.glb').resolve());rig=R.Rig(rep['glb']);j,b=rig.J,rig.BIN
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
fr0=rep['frames'][0];yaw0=fr0['yawRad'];rot0=np.array([[math.cos(yaw0),0,math.sin(yaw0)],[0,1,0],[-math.sin(yaw0),0,math.cos(yaw0)]]);cc=np.array([[1,0,0],[0,0,-1],[0,1,0]])@(np.array(fr0['controllerRoot'])+rot0@np.array([0,.36055,.013669861631558554]));bpy.ops.mesh.primitive_cube_add(size=1,location=cc);seat=bpy.context.object;seat.name='DIAGNOSTIC_SEAT_ENVELOPE_NOT_GAME_CHAIR';seat.dimensions=(.4946,.3815,.0389);seat.rotation_euler.z=yaw0;mat=bpy.data.materials.new('DiagnosticSeatBlue');mat.diffuse_color=(.12,.35,.65,1);seat.data.materials.append(mat)
envs=list(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=rep['glb']);chars=[o for o in bpy.context.scene.objects if o not in envs];mats={m.name:m for m in bpy.data.materials}
for o in chars:bpy.data.objects.remove(o,do_unlink=True)
C=np.array([[1,0,0],[0,0,-1],[0,1,0]],float);objs=[]
for m in j['meshes']:
 for pr in m['primitives']:
  a=pr['attributes'];P=R.acc(j,b,a['POSITION']).astype(float);J=R.acc(j,b,a['JOINTS_0']).astype(int);Wt=R.acc(j,b,a['WEIGHTS_0']);F=R.acc(j,b,pr['indices']).astype(int).reshape(-1,3)
  md={'P':P,'J':J,'W':Wt,'N':R.acc(j,b,a['NORMAL'])};mesh=bpy.data.meshes.new(m['name']);mesh.from_pydata((P@C.T).tolist(),[],F.tolist());ob=bpy.data.objects.new(m['name'],mesh);bpy.context.collection.objects.link(ob)
  matname=j['materials'][pr['material']]['name'];mat=mats.get(matname)
  if mat:mesh.materials.append(mat)
  for poly in mesh.polygons:poly.use_smooth=True
  if 'COLOR_0' in a:
   color=R.acc(j,b,a['COLOR_0']).astype(float);ac=j['accessors'][a['COLOR_0']]
   if False: pass # R.acc already normalizes colors
   if color.shape[1]==3:color=np.c_[color,np.ones(len(color))]
   layer=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT');layer.data.foreach_set('color',color.astype(np.float32).ravel())
  if 'TEXCOORD_0' in a:
   uv=R.acc(j,b,a['TEXCOORD_0']);layer=mesh.uv_layers.new()
   for poly in mesh.polygons:
    for li in poly.loop_indices:v=mesh.loops[li].vertex_index;layer.data[li].uv=(uv[v,0],1-uv[v,1])
  objs.append((ob,md,pr))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=False;s.render.resolution_x=768;s.render.resolution_y=1024;s.world=bpy.data.worlds.new('World');s.world.color=(.25,.25,.25)
bpy.ops.object.light_add(type='AREA',location=(-2,2,5));bpy.context.object.data.energy=800;bpy.context.object.data.size=5
bpy.ops.object.camera_add();cam=bpy.context.object;s.camera=cam
indices=[0,12,37,73];manifest=[]
for idx in indices:
 fr=next(fr for fr in rep['frames'] if fr['frame']==idx);nd={n['name']:n for n in fr['nodes']};T=np.array([nd[n]['translation'] for n in rig.names]);Q=np.array([nd[n]['rotation'] for n in rig.names]);Sc=np.array([nd[n]['scale'] for n in rig.names]);W=rig.fk(T[None],Q[None],Sc[None])[0];yaw=fr['yawRad'];rot=np.array([[math.cos(yaw),0,math.sin(yaw)],[0,1,0],[-math.sin(yaw),0,math.cos(yaw)]]);root=np.array(fr['controllerRoot'])
 for ob,md,pr in objs:
  # Apply the real driver's morph weights before skinning.
  posed=dict(md);P=md['P'].copy();normal=md['N'].copy()
  weights=fr.get('morphWeights',{})
  names=j['meshes'][next(i for i,m in enumerate(j['meshes']) if m['name']==ob.name.split('.')[0])].get('extras',{}).get('targetNames',[]) if False else []
  # Node morph bindings: index keyed by submesh:index, exported by real adapter.
  binding=next((x for x in fr.get('morphMeshes',[]) if x['mesh']==ob.name.split('.')[0]),None)
  if binding:
   for k,target in enumerate(pr.get('targets',[])):
    wt=binding['weights'].get('0:'+str(k),0)
    if wt and 'POSITION' in target:P+=accessor(target['POSITION'])*wt
    if wt and 'NORMAL' in target:normal+=accessor(target['NORMAL'])*wt
  posed['P']=P;v=(rig.skin(posed,W)@rot.T+root)@C.T;ob.data.vertices.foreach_set('co',v.astype(np.float32).ravel());ob.data.update()
  matrices=W@rig.ibm
  transformed=np.einsum('vkij,vj->vki',matrices[md['J'],:3,:3],normal)
  normals=np.sum(transformed*md['W'][:,:,None],axis=1)@rot.T@C.T
  normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-10)
  ob.data.normals_split_custom_set_from_vertices(normals.tolist())
  ob.data.update()
 for ob in envs:
  if ob.name=='env_lighthouse_door':ob.rotation_euler.z=-math.radians(fr['doorAngleDeg'])
 pos=np.array(fr['camera']['position']);q=fr['camera']['rotation'];cam.location=C@pos;qr=R.q2m(np.array(q));# Cocos camera looks -Z, up +Y; convert both to Blender
 direction=C@(-qr[:,2]);up=C@qr[:,1];cam.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler();target=C@(root+np.array([0,.8,0]));cam.location=target+C@(rot@np.array([-2.5,1,3]));cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.1;
 for label,offset in [('front',[0,.3,3]),('side',[3,.3,0]),('back',[2,.6,-3])]:
  cam.location=target+C@(rot@np.array(offset));cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str((O/f'{label}-{idx:05d}.png').resolve());bpy.ops.render.render(write_still=True)

