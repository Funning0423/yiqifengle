# pass2c pose sampler on top of p2_poses: walk swing samples (mirrored for negative s) and sit->stand transition lerps.
import bpy, re
from mathutils import Matrix
import p2_poses as poses
def _mirror(items):
    out=[]
    for bn,ax,val in items:
        if bn.endswith(".L"): bn=bn[:-2]+".R"
        elif bn.endswith(".R"): bn=bn[:-2]+".L"
        elif bn.startswith("skirt.left"): bn=bn.replace("left","right")
        elif bn.startswith("skirt.right"): bn=bn.replace("right","left")
        if ax in ("Y","Z"): val=-val          # X-mirror flips Y/Z rotations
        out.append((bn,ax,val))
    return out
STAND_FWD_MM=350    # sit->stand samples: root slides forward 0.35 m * (1-a) (she rises forward, away from the chair)
KNOTS=[(1.0, 'sit_corrective'), (0.9, 'stand_c90'), (0.875, 'stand_c875'), (0.85, 'stand_c85'), (0.825, 'stand_c825'), (0.8, 'stand_c80'), (0.775, 'stand_c775'), (0.75, 'stand_c75'), (0.7, 'stand_c70'), (0.65, 'stand_c65'), (0.6, 'stand_c60'), (0.575, 'stand_c575'), (0.55, 'stand_c55'), (0.525, 'stand_c525'), (0.5, 'stand_c50'), (0.25, 'stand_c25'), (0.15, 'stand_c15'), (0.1, 'stand_c10'), (0.05, 'stand_c05'), (0.025, 'stand_c025'), (0.0, None)]
def schedule(a):
    # piecewise-linear in-between correctives: at a knot exactly one key is 1; keys missing from the file are skipped
    have=set()
    for ob in bpy.data.objects:
        if ob.type=="MESH" and ob.data.shape_keys: have|=set(kb.name for kb in ob.data.shape_keys.key_blocks)
    kn=[(x,k) for x,k in KNOTS if k is None or k in have]
    W={k:0.0 for x,k in KNOTS if k}
    for (x1,k1),(x0,k0) in zip(kn[:-1],kn[1:]):
        if x0<=a<=x1:
            t=(a-x0)/(x1-x0)
            if k1: W[k1]=t
            if k0: W[k0]=1-t
            break
    return W
def morph_schedule(a): return a
def reset(arm):
    for pb in arm.pose.bones: pb.matrix_basis.identity()
    bpy.context.view_layer.update()
def set_sk(v):
    W=v if isinstance(v,dict) else {"sit_corrective":v}
    for ob in bpy.data.objects:
        if ob.type=="MESH" and ob.data.shape_keys:
            for kb in ob.data.shape_keys.key_blocks:
                if kb.name in [k for x,k in KNOTS if k]: kb.value=W.get(kb.name,0.0)
    bpy.context.view_layer.update()
def apply(arm,name):
    """rest | sit | walk | walk_s<k> (k in % ; 'm' prefix = mirrored, e.g. walk_sm50) | stand_a<k> (sit weight k %, morph = k/100)"""
    reset(arm)
    m=re.match(r"walk_s(m?)(\d+)$",name)
    if m:
        k=int(m.group(2))/100; it=[(b,a,v*k) for b,a,v in poses.POSES["walk"]]
        if m.group(1): it=_mirror(it)
        poses.POSES["_w"]=it; poses.apply_pose(arm,"_w"); set_sk(0); return
    m=re.match(r"stand_a(\d+(?:p\d+)?)(?:_w(\d+))?(?:_f(\d+))?$",name)
    if m:
        # sit->stand sample: pose weight a (1 = sit), morph weight w (default = a), root moves forward f mm * (1-a) (default STAND_FWD_MM)
        a=float(m.group(1).replace("p","."))/100; w=int(m.group(2))/100 if m.group(2) else schedule(a); f=(int(m.group(3)) if m.group(3) else STAND_FWD_MM)/1000
        poses.apply_pose(arm,"sit")
        B={pb.name:pb.matrix_basis.copy() for pb in arm.pose.bones}
        for pb in arm.pose.bones:
            l,r,s_=B[pb.name].decompose(); I=Matrix.Identity(4).to_quaternion()
            pb.matrix_basis=Matrix.Translation(l*a)@I.slerp(r,a).to_matrix().to_4x4()
        bpy.context.view_layer.update()
        if f:
            rb=arm.pose.bones["root"]; M=rb.matrix.copy(); M.translation.y-=f*(1-a)/arm.matrix_world.to_scale()[0]; rb.matrix=M
            bpy.context.view_layer.update()
        set_sk(w); return
    if name=="rest": set_sk(0); return
    poses.apply_pose(arm,name); set_sk({"sit_corrective":1.0} if name=="sit" else 0)

# ---- 运镜bot M1 v2g frames (character frame), see scripts/p2c_m1_export_frames.py ----
import json as _json, os as _os
M1_JSON=_os.path.join(_os.path.dirname(__file__),"..","probe","m1v2","m1v2g_frames_charframe.json")
_M1=None
M1_CLIP={"m1s":"cine_open_stand","m1t":"cine_open_turn","m1e":"cine_open_safe_end"}
# frame-based morph schedule for cine_open_stand: (frame, key); hold = repeated key; keys missing from the file are skipped
FKNOTS=[(0,"sit_corrective"),(5,"sit_corrective")]+[(f,f"m1_c{f:02d}") for f in range(10,81,5)]+[(84,None)]
def fschedule(f):
    have=set()
    for ob in bpy.data.objects:
        if ob.type=="MESH" and ob.data.shape_keys: have|=set(kb.name for kb in ob.data.shape_keys.key_blocks)
    import re as _re
    dyn=sorted((int(k[4:]),k) for k in have if _re.match(r"m1_c\d+$",k))
    kn=[(0,"sit_corrective"),(5,"sit_corrective")]+dyn+[(84,None)]
    if _os.environ.get("FHOLD")=="1":   # building knots in order: the last present key holds to the end
        last=[(x,k) for x,k in kn if k][-1]; kn=[(x,k) for x,k in kn if k]+[(max(x for x,k in FKNOTS)+1,last[1])]
    W={k:0.0 for x,k in FKNOTS+kn+[(0,k) for x,k in KNOTS] if k}
    if f<=kn[0][0]:
        if kn[0][1]: W[kn[0][1]]=1.0
        return W
    for (x0,k0),(x1,k1) in zip(kn[:-1],kn[1:]):
        if x0<=f<=x1:
            t=(f-x0)/(x1-x0) if x1>x0 else 1.0
            if k0: W[k0]+=1-t
            if k1: W[k1]+=t
            return W
    if kn[-1][1]: W[kn[-1][1]]=1.0
    return W
def set_skw(W):
    names=set(k for x,k in KNOTS if k)|set(k for x,k in FKNOTS if k)|set(W.keys())
    for ob in bpy.data.objects:
        if ob.type=="MESH" and ob.data.shape_keys: names|=set(kb.name for kb in ob.data.shape_keys.key_blocks if kb.name.startswith("m1_c"))
    for ob in bpy.data.objects:
        if ob.type=="MESH" and ob.data.shape_keys:
            for kb in ob.data.shape_keys.key_blocks:
                if kb.name in names: kb.value=W.get(kb.name,0.0)
    bpy.context.view_layer.update()
def m1_apply(arm,name):
    """m1s_f<k> / m1t_f<k> / m1e_f0 : 运镜bot M1 v2g bone pose at that frame (character frame); skirt bones = this
    model's sit skirt items x their release curve; morphs = fschedule (stand) or 0."""
    global _M1
    if _M1 is None: _M1=_json.load(open(M1_JSON))
    from mathutils import Matrix
    pre,f=name.split("_f"); f=float(f.replace("p",".")); clip=M1_CLIP[pre]; rows=_M1["clips"][clip]
    i0=int(f); i1=min(i0+1,len(rows)-1); t=f-i0
    reset(arm); Wi=arm.matrix_world.inverted()
    def order(b): 
        d=0
        while b.parent: b=b.parent; d+=1
        return d
    for pb in sorted(arm.pose.bones,key=order):
        if pb.name.startswith("skirt"): continue
        A=Matrix(rows[i0]["bones"][pb.name]); B=Matrix(rows[i1]["bones"][pb.name])
        if t>0:
            la,ra,sa=A.decompose(); lb,rb,sb=B.decompose()
            A=Matrix.LocRotScale(la.lerp(lb,t),ra.slerp(rb,t),sa.lerp(sb,t))
        if _os.environ.get('KFIX')=='1':
            A=A@Matrix.Diagonal((arm.matrix_world.to_scale()[0],)*3+(1,)).to_4x4() if False else A@Matrix.Scale(arm.matrix_world.to_scale()[0],4)   # 运镜bot repro: unit bone scale in armature space
        pb.matrix=Wi@A; bpy.context.view_layer.update()
    w=(rows[i0]["their_sit_corrective"]*(1-t)+rows[i1]["their_sit_corrective"]*t)
    if w>0:
        poses.POSES["_sk"]=[(b,a,v*w) for b,a,v in poses.POSES["sit"] if b.startswith("skirt")]; poses.apply_pose(arm,"_sk")
    set_skw(fschedule(f) if pre=="m1s" else {})
_apply_orig=apply
def apply(arm,name):
    if name.startswith(("m1s_","m1t_","m1e_")): return m1_apply(arm,name)
    return _apply_orig(arm,name)
