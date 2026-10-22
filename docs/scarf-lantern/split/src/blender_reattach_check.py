import bpy,json,numpy as np,sys
P='/workspace/yiqifengle/previews/角色动画bot/'
def imp(p):
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=p);return [o for o in bpy.data.objects if o not in before]
bpy.ops.wm.read_factory_settings(use_empty=True)
A=imp(P+'scarf-lantern/planB_cand3b_ribbonwind4b_stepdown_scarf.glb')
armA=[o for o in A if o.type=='ARMATURE'][0];scA=[o for o in A if o.type=='MESH' and 'SCARF' in o.name][0]
M=imp('planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb');armM=[o for o in M if o.type=='ARMATURE'][0]
assert not any('SCARF' in o.name for o in M if o.type=='MESH')
C=imp('scarf_snow_subpkg.glb');print([(o.name,o.type,len(o.data.vertices) if o.type=='MESH' else 0) for o in C]);scC=[o for o in C if o.type=='MESH' and 'SCARF' in o.name][0];armC=[o for o in C if o.type=='ARMATURE'][0]
# attach: re-point the armature modifier to the main rig (== skinningRoot = character root), keep object world matrix
mw=scC.matrix_world.copy()
for md in scC.modifiers:
  if md.type=='ARMATURE':md.object=armM
scC.parent=armM.parent if armM.parent else None;scC.matrix_world=mw
# put main rig at same place as A rig
res={};dg=bpy.context.evaluated_depsgraph_get();fps=30;sc=bpy.context.scene;sc.render.fps=fps
for act in [a for a in bpy.data.actions if a.name.startswith(tuple(x for x in []))] or []:pass
names=sorted({a.name for a in bpy.data.actions})
def setact(arm,clip):
  cand=[a for a in bpy.data.actions if a.name.split('_'+arm.name)[0]==clip or a.name==clip]
  return cand
# glTF importer names actions "<anim>" for first armature, "<anim>.001" ... ; map by armature via NLA tracks
def acts(arm):
  r={}
  ad=arm.animation_data
  for t in ad.nla_tracks:
    for s in t.strips:r[t.name]=s.action
  if not r:
    for a in bpy.data.actions: r[a.name]=a
  return r
aA,aM=acts(armA),acts(armM)
assert armA.animation_data and armM.animation_data
for t in list(armA.animation_data.nla_tracks):t.mute=True
for t in list(armM.animation_data.nla_tracks):t.mute=True
worst=0
for clip in sorted(aA):
  if clip not in aM: res[clip]='MISSING';continue
  armA.animation_data.action=aA[clip];armM.animation_data.action=aM[clip]
  f0,f1=aA[clip].frame_range;nf=int(round((f1-f0)))+1;mx=0
  for k in range(nf):
    sc.frame_set(int(f0)+k);dg=bpy.context.evaluated_depsgraph_get()
    va=np.array([scA.matrix_world@v.co for v in scA.evaluated_get(dg).to_mesh().vertices]);scA.evaluated_get(dg).to_mesh_clear()
    vc=np.array([scC.matrix_world@v.co for v in scC.evaluated_get(dg).to_mesh().vertices]);scC.evaluated_get(dg).to_mesh_clear()
    mx=max(mx,float(np.abs(va-vc).max()))
  res[clip]={'frames':nf,'max_abs_err_m':mx};worst=max(worst,mx)
res['_worst_m']=worst;res['_scene_fps']=sc.render.fps
json.dump(res,open('blender_reattach_check.json','w'),indent=1);print(json.dumps(res))
