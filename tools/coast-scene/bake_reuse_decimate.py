import os,sys;sys.argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
def need(k,doc):
  v=os.environ.get(k)
  if not v:sys.exit('set %s = %s'%(k,doc))
  return v
# QF_ISLAND_ART_GLB_DIR: island art glb folder (GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/assets/glb). QF_REUSE_WORK: scratch dir (dec/*.glb, outputs).
import bpy,sys,json
ART=os.path.join(need('QF_ISLAND_ART_GLB_DIR','island art glb dir'),'');W=need('QF_REUSE_WORK','scratch dir');os.makedirs(os.path.join(W,'dec'),exist_ok=True)
R={'env_prop_grass_tuft_01':1,'env_prop_grass_tuft_02':1,'env_prop_flowers_01':0.75,'env_prop_rock_01':1,'env_prop_rock_02':1,'env_prop_rock_03':0.6,'env_prop_hydrangea_bush_01':0.5}
out={}
for n,r in R.items():
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=ART+n+'.glb')
  ms=[o for o in bpy.data.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
  for o in ms:o.select_set(True)
  bpy.context.view_layer.objects.active=ms[0]
  if len(ms)>1:bpy.ops.object.join()
  o=bpy.context.view_layer.objects.active;bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  t0=sum(len(p.vertices)-2 for p in o.data.polygons)
  if r<1:
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=1e-5);bpy.ops.object.mode_set(mode='OBJECT')
    d=o.modifiers.new('d','DECIMATE');d.decimate_type='COLLAPSE';d.ratio=r;d.delimit={'UV'};d.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier='d')
  t1=sum(len(p.vertices)-2 for p in o.data.polygons);o.name=n;o.data.name=n
  for e in [x for x in bpy.data.objects if x!=o]:bpy.data.objects.remove(e)
  bpy.ops.export_scene.gltf(filepath=os.path.join(W,'dec',n+'.glb'),export_format='GLB',export_yup=True,export_image_format='NONE',export_normals=True,export_texcoords=True,export_apply=True)
  out[n]=[t0,t1]
json.dump(out,open(os.path.join(W,'dec','tris.json'),'w'));print(out)
