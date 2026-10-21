import bpy,json,sys
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
for t in arm.animation_data.nla_tracks: t.mute=True
PB=arm.pose.bones;print('BONES',[ (b.name,b.parent.name if b.parent else None) for b in PB])
for a in bpy.data.actions:
  if not a.name.startswith('walk'): continue
  arm.animation_data.action=a
  try: arm.animation_data.action_slot=a.slots[0]
  except: pass
  f0,f1=a.frame_range;xs=[];ys=[];fs=[]
  f=f0
  while f<=f1+1e-6:
    sc.frame_set(int(f),subframe=f-int(f));h=arm.matrix_world@PB['hips'].head;fl=arm.matrix_world@PB['foot.L'].head;fr=arm.matrix_world@PB['foot.R'].head
    xs.append(round(h.x,4));ys.append(round(h.y,4));fs.append((round(fl.x,3),round(fl.y,3),round(fr.x,3),round(fr.y,3)));f+=1
  hips_ch=[fc.data_path for fc in a.fcurves if '"hips"' in fc.data_path]
  print('CLIP',a.name,f0,f1,'hipsX range mm',round((max(xs)-min(xs))*1000),'hipsY range',round((max(ys)-min(ys))*1000),set(hips_ch),fs[0],fs[-1])
