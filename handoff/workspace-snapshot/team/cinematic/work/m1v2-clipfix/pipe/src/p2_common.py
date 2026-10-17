import bpy, numpy as np, math, os, sys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0,os.path.dirname(__file__))
from common import eval_co, bvh, weights, signed_clear, BODY
ARM="R5G2_RIG_22P4"; DRESS="G2_DRESS_R5G2"; APRON="G2_APRON_R5G2"
def smooth(e0,e1,x): t=np.clip((np.asarray(x)-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def world_rest(o):
    mw=np.array(o.matrix_world); co=np.array([v.co[:] for v in o.data.vertices]); return co@mw[:3,:3].T+mw[:3,3], mw
def set_world_rest(o,wc):
    mw=np.array(o.matrix_world); inv=np.linalg.inv(mw); lc=wc@inv[:3,:3].T+inv[:3,3]
    o.data.vertices.foreach_set("co",lc.ravel()); o.data.update()
def skirt_weights(o,arm,top):
    wco,_=world_rest(o)
    heads={b.name:(arm.matrix_world@b.head_local) for b in arm.data.bones}
    cx,cy=heads["skirt.front"].x,heads["skirt.front"].y
    names=["hips"]+[f"skirt.{x}" for x in ["front","left","back","right"]]+[f"skirt.{x}.low" for x in ["front","left","back","right"]]
    for g in list(o.vertex_groups):
        if g.name in names: o.vertex_groups.remove(g)
    groups={n:o.vertex_groups.new(name=n) for n in names}; col={n:i for i,n in enumerate(names)}
    h=np.clip((top-wco[:,2])/(top-0.40),0,1); sb=1-smooth(0.0,0.30,h); low=smooth(0.38,0.62,h)
    ang=(np.degrees(np.arctan2(wco[:,1]-cy,wco[:,0]-cx)))%360
    order=["right","back","left","front"]; ia=(ang//90).astype(int)%4; t=(ang%90)/90; wa=np.cos(t*np.pi/2)**2; wb=1-wa
    W=np.zeros((len(wco),9))
    for i in range(len(wco)):
        a=order[ia[i]]; b=order[(ia[i]+1)%4]; W[i,0]=sb[i]
        for bn,w in ((a,wa[i]),(b,wb[i])):
            W[i,col[f"skirt.{bn}"]]+=(1-sb[i])*(1-low[i])*w; W[i,col[f"skirt.{bn}.low"]]+=(1-sb[i])*low[i]*w
    idx=np.argsort(-W,1)[:,4:]; np.put_along_axis(W,idx,0,1); W/=W.sum(1,keepdims=True)
    for j,n in enumerate(names):
        for i in np.where(W[:,j]>1e-4)[0]: groups[n].add([int(i)],float(W[i,j]),'REPLACE')
    return int((W>1e-4).sum(1).max())
def rot_world(arm,pbname,axis,deg):
    pb=arm.pose.bones[pbname]; bpy.context.view_layer.update()
    M=pb.matrix.copy(); h=M.to_translation()
    pb.matrix=Matrix.Translation(h)@Matrix.Rotation(math.radians(deg),4,axis)@Matrix.Translation(-h)@M
    bpy.context.view_layer.update()
def bake_pose_to_rest(arm, meshes):
    """apply current pose to all skinned meshes and make it the armature rest pose"""
    for o in meshes:
        for x in bpy.context.selected_objects: x.select_set(False)
        o.select_set(True); bpy.context.view_layer.objects.active=o
        md=[m for m in o.modifiers if m.type=="ARMATURE"][0]; nm=md.name
        # keep modifier order: apply armature then re-add at same index
        idx=list(o.modifiers).index(md)
        bpy.ops.object.modifier_apply(modifier=nm)
    for x in bpy.context.selected_objects: x.select_set(False)
    arm.select_set(True); bpy.context.view_layer.objects.active=arm
    bpy.ops.object.mode_set(mode="POSE"); bpy.ops.pose.select_all(action="SELECT"); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode="OBJECT")
    for o in meshes:
        md=o.modifiers.new("G2_Armature","ARMATURE"); md.object=arm
        for x in bpy.context.selected_objects: x.select_set(False)
        o.select_set(True); bpy.context.view_layer.objects.active=o
        while o.modifiers.find("G2_Armature")>0: bpy.ops.object.modifier_move_up(modifier="G2_Armature")
