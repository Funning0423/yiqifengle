import bpy,json,sys
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=sys.argv[-2]);arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for t in arm.animation_data.nla_tracks: t.mute=True
PB=arm.pose.bones;R={}
for c in ['walk_loop','walk_start','walk_stop_bodyL','walk_stop_bodyR']:
  a=bpy.data.actions[c];arm.animation_data.action=a
  try: arm.animation_data.action_slot=a.slots[0]
  except: pass
  rows=[]
  for f in range(int(round(a.frame_range[1]))+1):
    sc.frame_set(f);M=arm.matrix_world
    rows.append({k:list(M@getattr(PB[b],e)) for k,b,e in (('aL','foot.L','head'),('tL','foot.L','tail'),('aR','foot.R','head'),('tR','foot.R','tail'),('kL','shin.L','head'),('kR','shin.R','head'),('hips','hips','head'),('wL','hand.L','head'),('wR','hand.R','head'))})
  R[c]=rows
json.dump(R,open(sys.argv[-1],'w'))
