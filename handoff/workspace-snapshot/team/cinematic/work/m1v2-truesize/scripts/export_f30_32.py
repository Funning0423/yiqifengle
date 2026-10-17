"""Export f30-32 (plus f29/f33 context) of cine_open_stand: bone transforms + evaluated meshes + morph weights + thigh/chair gaps."""
import bpy,sys,json,os,numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-truesize/scripts'); import clips, checker as C
from mathutils.bvhtree import BVHTree
blend,outdir,tag=sys.argv[sys.argv.index('--')+1:][:3]; os.makedirs(outdir,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=blend); arm=bpy.data.objects['R5G2_RIG_22P4']; dg=bpy.context.evaluated_depsgraph_get()
ch=bpy.data.objects[C.CHAIR]; chm=ch.evaluated_get(dg).to_mesh()
ct=BVHTree.FromPolygons([ch.matrix_world@v.co for v in chm.vertices],[p.vertices[:] for p in chm.polygons])
b=bpy.data.objects[C.BODY]; vg={g.index:g.name for g in b.vertex_groups}
thigh=np.array([any(vg[g.group].startswith('thigh') and g.weight>0.5 for g in v.groups) for v in b.data.vertices])
clips.activate('cine_open_stand'); out={'blend':blend,'tag':tag,'coords':'Blender world, Z-up, metres (game = (x, z, -y))','frames':{}}
for f in (29,30,31,32,33):
    bpy.context.scene.frame_set(f); dg=bpy.context.evaluated_depsgraph_get(); fr={'bones':{},'morph_weights':{},'mesh_npz':None}
    for pb in arm.pose.bones:
        fr['bones'][pb.name]={'world':[list(r) for r in arm.matrix_world@pb.matrix],'local_basis':[list(r) for r in pb.matrix_basis]}
    arrs={}
    for n in (C.BODY,C.DRESS,C.APRON,C.HAIR):
        o=bpy.data.objects[n]; e=o.evaluated_get(dg); m=e.to_mesh()
        arrs[n]=np.array([e.matrix_world@v.co for v in m.vertices],np.float32); e.to_mesh_clear()
        sk=o.data.shape_keys
        if sk: fr['morph_weights'][n]={k.name:round(k.value,6) for k in sk.key_blocks[1:] if abs(k.value)>1e-9}
    np.savez_compressed(f'{outdir}/f{f:02d}_eval_meshes.npz',**arrs); fr['mesh_npz']=f'f{f:02d}_eval_meshes.npz'
    d=[]; 
    for p in arrs[C.BODY][thigh]:
        loc,nrm,i,dist=ct.find_nearest(p); s=1 if (p-np.array(loc))@np.array(nrm)>=0 else -1; d.append(s*dist)
    fr['thigh_min_signed_gap_to_real_chair_mm']=round(min(d)*1000,4)
    # gap body -> seat front edge line, measured in grokbot2's character frame (seat top z 0.38, front edge y -0.204, |x|<0.247)
    import math
    from mathutils import Matrix as _M
    Mc=_M.Rotation(2.0,4,'Z')@_M.Translation((-0.43273,-4.20761,0))
    B=np.array([(Mc@__import__('mathutils').Vector(p))[:] for p in arrs[C.BODY]]); sel=(np.abs(B[:,0])<0.247)&(np.abs(B[:,1]+0.204)<0.06)&(np.abs(B[:,2]-0.38)<0.06)
    ed=np.hypot(B[sel,1]+0.204,B[sel,2]-0.38); fr['body_to_seat_front_edge_mm']=round(float(ed.min())*1000,4) if sel.any() else None
    D=np.array([(Mc@__import__('mathutils').Vector(p))[:] for p in arrs[C.DRESS]]); sd=(np.abs(D[:,0])<0.247)&(np.abs(D[:,1]+0.204)<0.06)&(np.abs(D[:,2]-0.38)<0.06)
    fr['dress_to_seat_front_edge_mm']=round(float(np.hypot(D[sd,1]+0.204,D[sd,2]-0.38).min())*1000,4) if sd.any() else None
    fr['root_world_z']=round((arm.matrix_world@arm.pose.bones['root'].matrix).to_translation().z,6)
    out['frames'][f]=fr; print('F',f,fr['thigh_min_signed_gap_to_real_chair_mm'],fr['body_to_seat_front_edge_mm'],fr['dress_to_seat_front_edge_mm'],fr['root_world_z'],flush=True)
json.dump(out,open(f'{outdir}/pose_f29_33.json','w'))
# small GLB of evaluated meshes at f30/31/32 (static meshes, one node per mesh per frame)
bpy.ops.object.select_all(action='DESELECT'); new=[]
for f in (30,31,32):
    bpy.context.scene.frame_set(f); dg=bpy.context.evaluated_depsgraph_get()
    for n in (C.BODY,C.DRESS,C.APRON):
        e=bpy.data.objects[n].evaluated_get(dg); me=bpy.data.meshes.new_from_object(e); me.transform(e.matrix_world)
        o=bpy.data.objects.new(f'f{f}_{n}',me); bpy.context.scene.collection.objects.link(o); o.hide_viewport=False; o.select_set(True); new.append(o)
bpy.ops.export_scene.gltf(filepath=f'{outdir}/f30_32_eval_meshes.glb',use_selection=True,export_apply=False,export_animations=False,export_skins=False,export_morph=False,export_materials='NONE')
print('DONE')
