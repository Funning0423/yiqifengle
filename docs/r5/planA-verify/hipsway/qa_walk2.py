import bpy,sys,json,numpy as np
from mathutils.bvhtree import BVHTree
glb,metap,out=sys.argv[-3:]
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.render.fps=30
bpy.ops.import_scene.gltf(filepath=glb)
meta=json.load(open(metap))['clips'];O={o.name:o for o in bpy.data.objects}
arm=[o for o in O.values() if o.type=='ARMATURE'][0];M={k[8:]:o for k,o in O.items() if k.startswith('LOD0_G2_') and o.type=='MESH'}
B=M['BODY'];gi={g.index:g.name for g in B.vertex_groups}
D=[gi[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in B.data.vertices]
HV=set(i for i,d in enumerate(D) if d.startswith(('hand.','forearm.')))
if arm.animation_data is None: arm.animation_data_create()
for t in arm.animation_data.nla_tracks: t.mute=True
def interp(tab,t): return float(np.interp(t,[a for a,_ in tab],[b for _,b in tab]))
def wm(o):
    dg=bpy.context.evaluated_depsgraph_get();oe=o.evaluated_get(dg);me=oe.to_mesh();Mw=oe.matrix_world.copy()
    vs=[Mw@v.co for v in me.vertices];me.calc_loop_triangles();t=[tuple(x.vertices) for x in me.loop_triangles];oe.to_mesh_clear();return vs,t
rows=[]
for c in ['walk_start','walk_loop','walk_stop_bodyL','walk_stop_bodyR']:
    act=[a for a in bpy.data.actions if a.name==c or a.name.startswith(c+'_')]
    act=sorted(act,key=lambda a:len(a.name))[0];arm.animation_data.action=act
    try: arm.animation_data.action_slot=act.slots[0]
    except Exception: pass
    f0,f1=act.frame_range;N=int(round(meta[c]['duration_s']*30));cur=meta[c].get('morph',{}).get('curves',{})
    for f in range(N+1):
        t=f/30
        for o in M.values():
            sk=o.data.shape_keys
            if sk:
                for kb in sk.key_blocks[1:]: kb.value=interp(cur[kb.name],t) if kb.name in cur else 0.0
        fr=f0+(f1-f0)*f/N;sc.frame_set(int(fr),subframe=fr-int(fr));bpy.context.view_layer.update()
        W={n:wm(M[n]) for n in ('BODY','DRESS','APRON')};T={n:BVHTree.FromPolygons(*W[n]) for n in ('DRESS','APRON')}
        bv,bt=W['BODY'];bh=BVHTree.FromPolygons(bv,[x for x in bt if all(v in HV for v in x)])
        r=dict(clip=c,f=f,HANDxAPRON=len(bh.overlap(T['APRON'])),HANDxDRESS=len(bh.overlap(T['DRESS'])),DRESSxAPRON=len(T['DRESS'].overlap(T['APRON'])),DRESSxBODY=len(T['DRESS'].overlap(BVHTree.FromPolygons(bv,bt))),APRONxBODY=len(T['APRON'].overlap(BVHTree.FromPolygons(bv,bt))))
        r['hand_apron_mm']=round(min(T['APRON'].find_nearest(bv[i])[3] for i in HV if D[i].startswith('hand.'))*1000,2)
        r['hand_dress_mm']=round(min(T['DRESS'].find_nearest(bv[i])[3] for i in HV if D[i].startswith('hand.'))*1000,2)
        rows.append(r)
    x=[r for r in rows if r['clip']==c]
    print('QW',c,'frames',len(x),{k:(max(r[k] for r in x),sum(r[k] for r in x)) for k in ('HANDxAPRON','HANDxDRESS','DRESSxAPRON','DRESSxBODY','APRONxBODY')},'minclr',min(r['hand_apron_mm'] for r in x),min(r['hand_dress_mm'] for r in x),flush=True)
json.dump(rows,open(out,'w'))
