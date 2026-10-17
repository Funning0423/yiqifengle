import bpy, math, numpy as np
from mathutils import Matrix, Vector, Quaternion
ARM='R5G2_RIG_22P4'; BODY='B_ANATOMICAL_VERTICAL_SLENDER_R5'; DRESS='G2_DRESS_R5G2'; APRON='G2_APRON_R5G2'; HAIR='G2_HAIR_BOB_R5G2'
# pass2b POSES['sit'] (copied verbatim from pass2b/scripts/p2_poses.py, sha 040814c1...)
SIT=[('root','T',(0,0,-0.609)),('thigh.L','X',-98),('thigh.R','X',-98),('shin.L','X',98),('shin.R','X',98),('foot.L','X',0),('foot.R','X',0),('spine','X',-4),('skirt.back','X',-31),('skirt.back.low','X',-113),('skirt.front','X',-93),('skirt.front.low','X',71),('skirt.left','X',-75),('skirt.left','Y',-25),('skirt.left.low','X',4),('skirt.left.low','Y',-12),('skirt.right','X',-75),('skirt.right','Y',25),('skirt.right.low','X',4),('skirt.right.low','Y',12),('upper_arm.L','X',-38),('upper_arm.L','Y',-16),('forearm.L','X',-21.5),('forearm.L','Z',0.5),('hand.L','X',0.0),('hand.L','Z',12.0),('upper_arm.R','X',-38),('upper_arm.R','Y',16),('forearm.R','X',-21.5),('forearm.R','Z',-0.5),('hand.R','X',0.0),('hand.R','Z',-12.0)]
import os as _os, importlib.util as _iu
_src=_os.environ.get('SIT_POSES_PY','/workspace/wechat-game/team/cinematic/work/m1v2-pass2c/src/p2_poses.py')   # drop-in: model's own POSES['sit']
if _os.path.exists(_src):
    _sp=_iu.spec_from_file_location('p2_poses_dropin',_src); _m=_iu.module_from_spec(_sp); _sp.loader.exec_module(_m)
    if _m.POSES.get('sit'): SIT=[tuple(x) for x in _m.POSES['sit']]
SIT_SRC=_src
def arm(): return bpy.data.objects[ARM]
def upd(): bpy.context.view_layer.update()
def reset(a=None):
    a=a or arm()
    for pb in a.pose.bones: pb.matrix_basis.identity()
    upd()
def apply_list(L,a=None):
    a=a or arm()
    for bn,ax,val in L:
        pb=a.pose.bones[bn]; upd(); M=pb.matrix.copy()
        if ax=='T': pb.matrix=Matrix.Translation(Vector(val))@M
        else:
            h=M.to_translation(); pb.matrix=Matrix.Translation(h)@Matrix.Rotation(math.radians(val),4,ax)@Matrix.Translation(-h)@M
    upd()
def capture(a=None):
    a=a or arm(); return {pb.name:pb.matrix_basis.copy() for pb in a.pose.bones}
def setpose(P,a=None):
    a=a or arm()
    for pb in a.pose.bones: pb.matrix_basis=P[pb.name].copy()
    upd()
def rot_world(bn,axis,deg,a=None):
    a=a or arm(); pb=a.pose.bones[bn]; upd(); M=pb.matrix.copy(); h=M.to_translation()
    pb.matrix=Matrix.Translation(h)@Matrix.Rotation(math.radians(deg),4,axis)@Matrix.Translation(-h)@M; upd()
SKM=(BODY,DRESS,APRON)   # pass2c: morphs on body, dress and apron
def set_morph(Wd):
    """set EVERY non-basis key on body/dress/apron: Wd.get(name,0)"""
    for n in SKM:
        k=bpy.data.objects[n].data.shape_keys
        if not k: continue
        for kb in k.key_blocks[1:]: kb.value=Wd.get(kb.name,0.0)
def set_sk(v): set_morph({'sit_corrective':v})
import json as _json2
SIDE=_os.environ.get('PASS2C_SIDECAR','/workspace/wechat-game/team/cinematic/work/m1v2-pass2c/src/R5G2_PASS2C_INTERIM_grokbot2.json')
_sd=_json2.load(open(SIDE)); STAND_W={int(k):v for k,v in _sd['cine_open_stand_weights'].items()}; SKIRT_SIT=[tuple(x) for x in _sd['sit_skirt_items_deg_world_axis']]
def head(bn,a=None):
    a=a or arm(); return a.pose.bones[bn].matrix.to_translation()
def tail(bn,a=None):
    a=a or arm(); return a.pose.bones[bn].tail.copy()
def aim_bone(bn,target,a=None,keep_twist=True):
    """rotate bone (armature space) about its head so its tail points at target (minimal rotation)."""
    a=a or arm(); pb=a.pose.bones[bn]; upd(); M=pb.matrix.copy(); h=M.to_translation()
    cur=(pb.tail-h).normalized(); want=(Vector(target)-h).normalized()
    q=cur.rotation_difference(want)
    pb.matrix=Matrix.Translation(h)@q.to_matrix().to_4x4()@Matrix.Translation(-h)@M; upd()
def leg_ik(side,ankle,knee_dir,a=None):
    """2-bone IK: put foot.<side> head (ankle) at 'ankle' (armature space); knee bends toward knee_dir."""
    a=a or arm(); th=a.pose.bones['thigh.'+side]; sh=a.pose.bones['shin.'+side]
    upd(); H=th.matrix.to_translation(); Lt=(th.tail-H).length; Ls=(sh.tail-sh.matrix.to_translation()).length
    A=Vector(ankle); d=(A-H); D=min(d.length,Lt+Ls-1e-5); u=d.normalized()
    x=(Lt*Lt-Ls*Ls+D*D)/(2*D); hgt=math.sqrt(max(0,Lt*Lt-x*x))
    kd=Vector(knee_dir); kd=(kd-u*kd.dot(u)).normalized()
    knee=H+u*x+kd*hgt
    aim_bone('thigh.'+side,knee,a); aim_bone('shin.'+side,H+u*D,a)
    return (A-(H+u*D)).length
def foot_flat(side,world_rot_target,a=None):
    """set foot bone armature-space rotation to target matrix (3x3) keeping head."""
    a=a or arm(); pb=a.pose.bones['foot.'+side]; upd(); h=pb.matrix.to_translation()
    pb.matrix=Matrix.Translation(h)@world_rot_target.to_4x4(); upd()
