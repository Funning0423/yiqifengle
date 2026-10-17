# Build M1 working scene: copy of pass2b source (global char scale switch CHAR_SCALE_MODE, root scale 1, 4-weight limit) + real interior (chair, door, shell, col_* proxies) in metre game space (Blender Z-up; game(x,y,z)->blender(x,-z,y)).
import bpy, json, math, numpy as np
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
W='/workspace/wechat-game/team/cinematic/work/m1v2-truesize/'
A='/workspace/wechat-game/art/x/GROKBOT-ART-001-INTERIOR-v2.1.0/GROKBOT-ART-001-INTERIOR-v2.1.0/'
import os, hashlib
CHAR_BLEND=os.environ.get('CHAR_BLEND',W+'src/R5G2_PASS2C_TRUESIZE_grokbot2_SOURCE.blend')   # drop-in: pass2c / reworked sit_corrective / reweighted model
bpy.ops.wm.open_mainfile(filepath=CHAR_BLEND)
rep={'char_blend':CHAR_BLEND,'char_blend_sha256':hashlib.sha256(open(CHAR_BLEND,'rb').read()).hexdigest()}
# 1) drop reference-only objects (hidden MDD wind refs, hidden repair patches, review cameras)
for n in ['B_APRON_PROOF_MIDSURFACE_R8WIND_REFERENCE_MDD','B_YELLOW_PROOF_MIDSURFACE_R8WIND_REFERENCE_MDD','B_CONTINUOUS_FACE_PATCH_R6','B_NATURAL_HAND_FACE_R9','BodiceChartReviewCamera','OriginalHeadRepairCamera']:
    o=bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o)
arm=bpy.data.objects['R5G2_RIG_22P4']; K=bpy.data.objects['B_SINGLE_WORLD_ROOT_SOURCE_K']
CH=['B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2','G2_HAIR_BOB_R5G2']
kval=K.scale[0]; rep['K']=kval
# 2) Cocos skinning. WEIGHTS=limit4 (default): limit 4 BONE influences + normalise, group_select_mode='BONE_DEFORM'
#    (pass2c meshes carry non-bone groups THICKNESS_FREE_SURFACE / EXPLICIT_SEWN_WAIST_ONLY; 'ALL' would count them - v1/v2 used 'ALL').
#    WEIGHTS=orig: model weights untouched (evidence variant).
WMODE=os.environ.get('WEIGHTS','limit4'); rep['weights_mode']=WMODE
def bone_infl(o):
    bones={b.name for b in arm.data.bones if b.use_deform}; gn={g.index:g.name for g in o.vertex_groups}
    return [sum(1 for g in v.groups if gn[g.group] in bones and g.weight>0) for v in o.data.vertices], \
           [sum(g.weight for g in v.groups if gn[g.group] in bones) for v in o.data.vertices]
for n in CH:
    o=bpy.data.objects[n]
    nb,sw=bone_infl(o); before={'max_bone_influences':max(nb),'verts_over4':sum(1 for x in nb if x>4),'bone_weight_sum_min':round(min(sw),4),'bone_weight_sum_max':round(max(sw),4)}
    if WMODE=='limit4':
        for x in bpy.context.selected_objects: x.select_set(False)
        o.select_set(True); bpy.context.view_layer.objects.active=arm; arm.select_set(True); bpy.context.view_layer.objects.active=o
        bpy.ops.object.vertex_group_limit_total(group_select_mode='BONE_DEFORM',limit=4)
        bpy.ops.object.vertex_group_normalize_all(group_select_mode='BONE_DEFORM',lock_active=False)
    nb,sw=bone_infl(o)
    rep['weights_'+n]={'before':before,'after':{'max_bone_influences':max(nb),'bone_weight_sum_min':round(min(sw),4),'bone_weight_sum_max':round(max(sw),4)}}
# 3) GLOBAL CHARACTER SCALE (single switch; rerun build_scene -> anim_build -> check_run after changing):
#    CHAR_SCALE_MODE=bakeK (default, = interim package: K 1.061164 baked once, root scale 1, hat top 1.7253 m)
#    CHAR_SCALE_MODE=removeK (K dropped, root scale 1, hat top 1.626 m)   CHAR_SCALE=<float> extra uniform factor (default 1.0)
import os
MODE=os.environ.get('CHAR_SCALE_MODE','bakeK'); EXTRA=float(os.environ.get('CHAR_SCALE','1.0'))
f=(kval if MODE=='bakeK' else 1.0)*EXTRA; rep['char_scale_mode']=MODE; rep['char_scale_total']=f
for x in bpy.context.selected_objects: x.select_set(False)
K.scale=(f,f,f); bpy.context.view_layer.update()
for n in CH+['R5G2_RIG_22P4']:
    o=bpy.data.objects[n]; mw=o.matrix_world.copy(); o.parent=None; o.matrix_world=mw; o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for n in CH+['R5G2_RIG_22P4']: rep['scale_after_'+n]=[round(x,6) for x in bpy.data.objects[n].matrix_world.to_scale()]
for n in CH:
    for m in bpy.data.objects[n].modifiers:
        if m.type=='SOLIDIFY': m.thickness*=f
bpy.data.objects.remove(K)
# drop pass2 loop NLA from active use (keep actions, muted)
arm.animation_data.action=None
# 4) environment from the real interior pack (metric)
def append(path,names):
    with bpy.data.libraries.load(path) as (src,dst): dst.objects=[n for n in src.objects if n in names]
    out=[]
    for o in dst.objects:
        if o is None: continue
        bpy.context.scene.collection.objects.link(o); out.append(o)
    return out
envc=bpy.data.collections.new('ENV_REAL'); bpy.context.scene.collection.children.link(envc)
colc=bpy.data.collections.new('ENV_COL_PROXIES'); bpy.context.scene.collection.children.link(colc)
env=append(A+'scene/env_interior_assembled.blend',['env_interior_props_merged','env_interior_shell','env_lighthouse_door','env_interior_glass','env_int_anim_cat']+['col_int_ceiling','col_int_chair_armrest_l','col_int_chair_armrest_r','col_int_chair_back','col_int_chair_seat','col_int_desk','col_int_door_frame','col_int_floor_walkable','col_int_props_misc','col_int_side_table','col_int_stairs','col_int_stool','col_int_walls','col_lighthouse_door_leaf'])
for o in env:
    for c in list(o.users_collection): c.objects.unlink(o)
    (colc if o.name.startswith('col_') else envc).objects.link(o)
    if o.name.startswith('col_'): o.display_type='WIRE'; o.hide_render=True
    o.parent=None
colc.hide_render=True
chair_w=Matrix.Translation((0.4203,4.2133,0))@Matrix.Rotation(-2.0,4,'Z')
ch=append(A+'assets/blend/env_int_prop_reading_chair.blend',['env_int_prop_reading_chair'])[0]
for c in list(ch.users_collection): c.objects.unlink(ch)
envc.objects.link(ch); ch.matrix_world=chair_w; ch.name='CHAIR_REAL_reading_chair'
ca=append(A+'assets/blend/env_int_prop_reading_chair_arms.blend',['env_int_prop_reading_chair_arms'])[0]
for c in list(ca.users_collection): c.objects.unlink(ca)
envc.objects.link(ca); ca.matrix_world=chair_w; ca.name='CHAIR_VARIANT_arms_NOT_IN_GAME'; ca.hide_render=True; ca.hide_set(True)
# remove the chair verts from the merged props copy (chair is tested as its own object)
pm=bpy.data.objects['env_interior_props_merged']
kd=KDTree(len(ch.data.vertices))
for i,v in enumerate(ch.data.vertices): kd.insert(ch.matrix_world@v.co,i)
kd.balance()
import bmesh
bm=bmesh.new(); bm.from_mesh(pm.data)
dele=[v for v in bm.verts if kd.find(pm.matrix_world@v.co)[2]<1e-5]
rep['props_merged_chair_verts_removed']=len(dele)
bmesh.ops.delete(bm,geom=dele,context='VERTS'); bm.to_mesh(pm.data); bm.free()
pm.name='ENV_props_merged_minus_chair'
# anchors (game -> blender)
F=json.load(open(W+'probe/facts.json'))
anc=bpy.data.collections.new('ANCHORS'); bpy.context.scene.collection.children.link(anc)
for n,a in F['anchors'].items():
    p=a['position']; e=bpy.data.objects.new('A_'+n,None); e.empty_display_size=0.08; e.location=(p[0],-p[2],p[1]); anc.objects.link(e)
    y=(a.get('properties') or {}).get('yaw_rad')
    if y is not None: e.rotation_euler=(0,0,y)
for n in CH: rep['bbox_z_'+n]=round(max((bpy.data.objects[n].matrix_world@Vector(c)).z for c in bpy.data.objects[n].bound_box),4)
bpy.context.scene.render.fps=30
# model-specific bow-tail vertex list (hips-dominant verts behind/below the waist at rest), recomputed for whatever model is dropped in
b=bpy.data.objects['B_ANATOMICAL_VERTICAL_SLENDER_R5']; me=b.data; s_=f/kval
# pass2c: same rule as grokbot2's p2c_check.py - bow tails = small separate islands behind the body below the waist
# (island min y > 0.06, max z < 1.15 in source units, < 300 verts); the old 'hips-dominant' rule finds 0 verts on pass2c (tails re-weighted)
import bmesh as _bm
bmx=_bm.new(); bmx.from_mesh(me); bmx.verts.ensure_lookup_table(); co0=np.array([(b.matrix_world@v.co)[:] for v in me.vertices])
seen=np.zeros(len(me.vertices),bool); tails=[]; isl=[]
for v in bmx.verts:
    if seen[v.index] or not v.link_edges: continue
    st=[v]; comp=[]; seen[v.index]=True
    while st:
        x=st.pop(); comp.append(x.index)
        for e in x.link_edges:
            w_=e.other_vert(x)
            if not seen[w_.index]: seen[w_.index]=True; st.append(w_)
    if co0[comp,1].min()>0.06*f and co0[comp,2].max()<1.15*f and len(comp)<300: tails+=comp; isl.append(len(comp))
bmx.free(); rep['bow_tail_islands']=isl
np.save(W+'probe/bow_tail_vidx.npy',np.array(tails,dtype=np.int64)); rep['bow_tail_verts']=len(tails)
bpy.context.scene['char_scale']=f; bpy.context.scene['char_scale_mode']=MODE
bpy.ops.wm.save_as_mainfile(filepath=W+'scene/cine_m1_base.blend')
print('REP',json.dumps(rep))
