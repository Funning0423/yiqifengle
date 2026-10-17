"""cloth-sim temporal filter of the pass2c cloth: goal = pass2c deformed dress/apron (armature + per-frame knots), use_dynamic_mesh (rest shape follows
the knots), gravity off, body+bow+real chair collisions, dress self collision, apron collides with dress (outer layer). Writes world midsurface per frame.
usage: blender -b --python sim_cloth.py -- <blend> <out.npz> <pin_stiffness> <mass> <air_damping> <quality> [clip=cine_open_stand]"""
import bpy, sys, numpy as np
a=sys.argv[sys.argv.index('--')+1:]; blend,out=a[:2]; PIN=float(a[2]); MASS=float(a[3]); AIR=float(a[4]); QUAL=int(a[5]); PW=float(a[6]) if len(a)>6 else 0.7
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe/scripts'); import clips
bpy.ops.wm.open_mainfile(filepath=blend); sc=bpy.context.scene
D=bpy.data.objects['G2_DRESS_R5G2']; Ap=bpy.data.objects['G2_APRON_R5G2']; BODY=bpy.data.objects['B_ANATOMICAL_VERTICAL_SLENDER_R5']
BOW=bpy.data.objects.get('G2_BOW_TAILS_R5G2'); CH=bpy.data.objects['CHAIR_REAL_reading_chair']
def coll(o,outer,name):
    m=o.modifiers.new(name,'COLLISION'); o.collision.thickness_outer=outer; o.collision.thickness_inner=0.001; o.collision.cloth_friction=2.0; o.collision.damping=0.5
for o in (BODY,CH)+((BOW,) if BOW else ()): coll(o,0.002,'COL')
CD=bpy.data.collections.new('COL_D'); CA=bpy.data.collections.new('COL_A')
for o in (BODY,CH)+((BOW,) if BOW else ()): CD.objects.link(o); CA.objects.link(o)
CA.objects.link(D)
for o,col,selfc in ((D,CD,True),(Ap,CA,True)):
    for m in list(o.modifiers):
        if m.type in ('SOLIDIFY','TRIANGULATE'): o.modifiers.remove(m)
    vg=o.vertex_groups.new(name='pin_all'); vg.add(list(range(len(o.data.vertices))),PW,'REPLACE')
    cm=o.modifiers.new('CLOTH','CLOTH'); s=cm.settings; cs=cm.collision_settings
    s.quality=QUAL; s.mass=MASS; s.air_damping=AIR; s.vertex_group_mass='pin_all'; s.pin_stiffness=PIN; s.use_dynamic_mesh=True
    s.tension_stiffness=s.compression_stiffness=40; s.shear_stiffness=20; s.bending_stiffness=2.0; s.tension_damping=s.compression_damping=s.shear_damping=10; s.bending_damping=1.0
    s.effector_weights.gravity=0.0
    cs.use_collision=True; cs.distance_min=0.0022; cs.collision_quality=4; cs.collection=col; cs.use_self_collision=selfc; cs.self_distance_min=0.0012; cs.self_friction=2.0
    cm.point_cache.frame_start=0; cm.point_cache.frame_end=90
coll(D,0.0016,'COL_LAYER')   # after the cloth modifier: the apron sees the simulated dress
clips.activate('cine_open_stand'); sc.frame_start=0; sc.frame_end=90
OUT={'G2_DRESS_R5G2':[],'G2_APRON_R5G2':[]}
for f in range(0,91):
    sc.frame_set(f); dg=bpy.context.evaluated_depsgraph_get()
    for o in (D,Ap):
        oe=o.evaluated_get(dg); me=oe.to_mesh(); co=np.empty(len(me.vertices)*3); me.vertices.foreach_get('co',co); co=co.reshape(-1,3)
        mw=np.array(oe.matrix_world); OUT[o.name].append(co@mw[:3,:3].T+mw[:3,3]); oe.to_mesh_clear()
    print('SIM',f,flush=True)
np.savez(out,**{k:np.array(v) for k,v in OUT.items()}); print('SIMDONE')
