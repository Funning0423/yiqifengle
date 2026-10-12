# blender -b --python build_body.py -- <head_r2_work.blend> <outdir>
# Body round r1: rebuild bodice (torso), shoulders, puff/bishop sleeves + cuffs, white bib + straps, relaxed hands.
# Old M_G2_BODY faces dominated by chest/neck/upper_arm/forearm/hand are removed; legs/feet/BOW untouched.
# New parts use M_G2_FACE (solid patches in T_G2_FACE) -> no new material/texture.
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index("--")+1:]; BLEND,OUT=a[0],a[1]
P=json.load(open(os.path.join(OUT,'data','params.json')))
bpy.ops.wm.open_mainfile(filepath=BLEND)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
body=bpy.data.objects['LOD0_G2_BODY']
MAT={m.name:m for m in bpy.data.materials}
def smooth(t): t=max(0,min(1,t)); return t*t*(3-2*t)
def lerp(a,b,t): return a+(b-a)*t
BW={b.name:(arm.matrix_world@b.head_local, arm.matrix_world@b.tail_local) for b in arm.data.bones}
# ---------------- delete old upper body ----------------
me=body.data; gn={g.index:g.name for g in body.vertex_groups}
mi_body=[m.name for m in me.materials].index('M_G2_BODY')
UP={'chest','neck','spine','upper_arm.L','upper_arm.R','forearm.L','forearm.R','hand.L','hand.R'}
def dom(v):
    gs=sorted([(g.weight,gn[g.group]) for g in v.groups],reverse=True); return gs[0][1] if gs else '-'
bm=bmesh.new(); bm.from_mesh(me); dl=bm.verts.layers.deform.active
def domb(v):
    d=v[dl]; 
    if not d: return '-'
    k=max(d.items(),key=lambda x:x[1])[0]; return gn[k]
kill=[f for f in bm.faces if f.material_index==mi_body and any(domb(v) in UP for v in f.verts) and all(domb(v) in UP|{'hips'} for v in f.verts) and f.calc_center_median().z>0.80]
print('DELETE_FACES',len(kill))
bmesh.ops.delete(bm,geom=kill,context='FACES'); bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(me); bm.free()
new_parts=[]
def mkobj(name,bm):
    m=bpy.data.meshes.new(name); bm.to_mesh(m); bm.free()
    o=bpy.data.objects.new(name,m); bpy.context.scene.collection.objects.link(o); new_parts.append(o); return o
# ---------------- torso / bodice ----------------
# (z, half-width X, front y (neg), back y, superellipse exponent)
SEC=P['torso']
NS=28
def sec_pt(s,k,extra=0.0):
    z,X,F,Bk,n=s; th=2*math.pi*k/NS; c,sn=math.cos(th),math.sin(th)
    x=X*math.copysign(abs(sn)**(2/n),sn); yy=math.copysign(abs(c)**(2/n),c)
    y=(F*abs(yy)) if c>0 else (Bk*abs(yy))
    return Vector((x,y,z))
def torso():
    bm=bmesh.new(); R=[[bm.verts.new(sec_pt(s,k)) for k in range(NS)] for s in SEC]
    for i in range(len(R)-1):
        for k in range(NS): bm.faces.new((R[i][k],R[i][(k+1)%NS],R[i+1][(k+1)%NS],R[i+1][k]))
    return mkobj('N_torso',bm)
otorso=torso()
tbvh=BVHTree.FromObject(otorso,bpy.context.evaluated_depsgraph_get())
def on_torso(p,off):
    """project p onto torso horizontally from the vertical axis, push out by off"""
    o=Vector((0,-0.015,p.z)); d=(p-o); d.z=0
    if d.length<1e-6: d=Vector((0,-1,0))
    d.normalize(); hit=tbvh.ray_cast(o+d*0.4,-d,0.5)
    if hit[0] is None: return p
    return hit[0]+hit[1]*off
# ---------------- sleeves ----------------
SL=P['sleeve']
def arm_path(side):
    S,E=BW[f'upper_arm.{side}']; _,W=BW[f'forearm.{side}']; return S,E,W
def frame_rot(t0,t1):
    return t0.rotation_difference(t1)
NSEG=16
def sleeve(side):
    S,E,W=arm_path(side); u1=(E-S); L1=u1.length; u1.normalize(); u2=(W-E); L2=u2.length; u2.normalize()
    sg=1 if side=='R' else -1
    # reference "outward" vector for ring orientation
    def path(s):
        if s<=L1: p=S+u1*s
        else: p=E+u2*(s-L1)
        # smooth bend across elbow
        b=smooth((s-(L1-SL['elbow_blend']))/(2*SL['elbow_blend']))
        t=(u1.lerp(u2,b)).normalized()
        if abs(s-L1)<SL['elbow_blend']:
            # round the corner: quadratic bezier
            s0=L1-SL['elbow_blend']; s1=L1+SL['elbow_blend']; q=(s-s0)/(s1-s0)
            A=S+u1*s0; Bc=E; Cc=E+u2*(s1-L1); p=(1-q)**2*A+2*(1-q)*q*Bc+q*q*Cc
        return p,t
    # radius profile keyed on arc length s (meters, expressions may use L1/L2)
    K=[(eval(str(k[0]),{'L1':L1,'L2':L2}),k[1]) for k in SL['profile']]
    def rad(s):
        ss=[x for x,_ in K]; rr=[y for _,y in K]
        return float(np.interp(s,ss,rr))
    rings=SL['rings'] ; rings=[eval(str(x),{'L1':L1,'L2':L2}) for x in rings]
    bm=bmesh.new(); R=[]; meta=[]
    ref=Vector((sg,0,0))
    for s in rings:
        p,t=path(s); r=rad(s)
        x=(ref-t*ref.dot(t)).normalized(); y=t.cross(x)
        ring=[]
        gath=sum(g[1]*math.exp(-((s-eval(str(g[0]),{'L1':L1,'L2':L2}))/g[2])**2) for g in SL['gather'])
        for k in range(NSEG):
            th=2*math.pi*k/NSEG
            rr=r*(1+gath*math.cos(8*th))
            fl=float(np.interp(s,[eval(str(q[0]),{'L1':L1,'L2':L2}) for q in SL['inner_flat']],[q[1] for q in SL['inner_flat']]))
            rr*=1-fl*max(0.0,-math.cos(th))**1.2
            ring.append(bm.verts.new(p+(x*math.cos(th)+y*math.sin(th))*rr))
        R.append(ring); meta.append((s,r))
    # set-in sleeve: ring 0 = armhole on the torso side (tilted armscye plane), the next rings blend out into the
    # puff cap -> the sleeve grows out of the shoulder instead of a tube pushed into it
    A=SL['armhole']; na=Vector((sg*1.0,0,-A['tilt'])).normalized(); Ac=Vector((sg*A['x'],A['y'],A['z']))
    up=(Vector((0,0,1))-na*na.z).normalized(); fw=na.cross(up)*(-sg)
    nb=len(SL['snap_blend']); pb,tb=path(rings[nb]); xb=(ref-tb*ref.dot(tb)).normalized(); yb=tb.cross(xb)
    hole=[]
    for k in range(NSEG):
        th=2*math.pi*k/NSEG; d=(xb*math.cos(th)+yb*math.sin(th))
        dp=(d-na*d.dot(na)).normalized()
        T=Ac+up*dp.dot(up)*A['rz']+fw*dp.dot(fw)*A['ry']
        hit=tbvh.ray_cast(T-na*0.06,na,0.12)
        hole.append((hit[0]+hit[1]*0.0015,hit[1]) if hit[0] is not None else (T,na))
    for i,wb in enumerate(SL['snap_blend']):
        for k,v in enumerate(R[i]):
            hp,hn=hole[k]; v.co=hp.lerp(v.co,wb)+hn*SL['snap_push'][i]
    for i in range(len(R)-1):
        for k in range(NSEG): bm.faces.new((R[i][k],R[i][(k+1)%NSEG],R[i+1][(k+1)%NSEG],R[i+1][k]))
    # cuff end: fold inward (inner lip)
    pe,te=path(rings[-1]); inner=[bm.verts.new(pe+(v.co-pe)*0.80-te*0.012) for v in R[-1]]
    for k in range(NSEG): bm.faces.new((R[-1][k],R[-1][(k+1)%NSEG],inner[(k+1)%NSEG],inner[k]))
    o=mkobj(f'N_sleeve_{side}',bm)
    o['L1']=L1; o['L2']=L2
    return o,path,L1,L2,rings
sleeves={}
for side in ('L','R'): sleeves[side]=sleeve(side)
# ---------------- bib + straps (white) ----------------
BIB=P['bib']
def bib():
    bm=bmesh.new(); NX,NZ=8,10; G=[]
    for j in range(NZ+1):
        z=lerp(BIB['z0'],BIB['z1'],j/NZ); hw=lerp(BIB['w0'],BIB['w1'],j/NZ)
        r=[]
        for i in range(NX+1):
            x=lerp(-hw,hw,i/NX); hit=tbvh.ray_cast(Vector((x,-0.4,z)),Vector((0,1,0)),0.5)
            p=hit[0]+hit[1]*BIB['off']
            r.append(bm.verts.new(p))
        G.append(r)
    for j in range(NZ):
        for i in range(NX): bm.faces.new((G[j][i],G[j][i+1],G[j+1][i+1],G[j+1][i]))
    return mkobj('N_bib',bm)
obib=bib()
def strap(sx):
    ctrl=[(BIB['w1']-BIB['strap_w']/2,BIB['z1']-0.022,-1),(0.064,1.372,-0.7),(0.072,1.394,0),(0.072,1.372,0.7),(0.072,1.30,1),(0.066,1.22,1),(0.063,1.16,1)]
    pts=[]
    for (x0,z0,f0),(x1,z1,f1) in zip(ctrl,ctrl[1:]):
        for q in np.linspace(0,1,4,endpoint=False): pts.append((lerp(x0,x1,q),lerp(z0,z1,q),lerp(f0,f1,q)))
    pts.append(ctrl[-1])
    C=[]
    for x,z,f in pts:
        g=Vector((sx*x,-0.015+f*0.075,z)); O=Vector((sx*x*0.5,-0.015,1.29))
        d=(g-O).normalized(); hit=tbvh.ray_cast(O+d*0.5,-d,0.6)
        if hit[0] is None: hit=tbvh.find_nearest(g)
        C.append((hit[0],hit[1]))
    bm=bmesh.new(); rows=[]
    for i,(c,n) in enumerate(C):
        t=(C[min(i+1,len(C)-1)][0]-C[max(i-1,0)][0]).normalized(); wv=n.cross(t).normalized()
        hw=BIB['strap_w']/2; base=c+n*(BIB['off']+0.0012)
        rows.append([bm.verts.new(base-wv*hw),bm.verts.new(base+wv*hw)])
    for r0,r1 in zip(rows,rows[1:]): bm.faces.new((r0[0],r0[1],r1[1],r1[0]))
    return mkobj(f'N_strap_{"L" if sx<0 else "R"}',bm)
ostraps=[strap(-1),strap(1)]
# ---------------- hands (relaxed, slightly curled) ----------------
H=P['hand']
def tube(bm,pts,radii,nseg=6,cap=True,frame0=None):
    R=[]; prev=None
    for i,(p,r) in enumerate(zip(pts,radii)):
        t=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        if prev is None:
            x=(frame0-t*frame0.dot(t)).normalized()
        else:
            x=(prev-t*prev.dot(t)).normalized()
        prev=x; y=t.cross(x)
        R.append([bm.verts.new(p+(x*math.cos(2*math.pi*k/nseg)+y*math.sin(2*math.pi*k/nseg))*r) for k in range(nseg)])
    for a,b in zip(R,R[1:]):
        for k in range(nseg): bm.faces.new((a[k],a[(k+1)%nseg],b[(k+1)%nseg],b[k]))
    if cap:
        t=(pts[-1]-pts[-2]).normalized(); tip=bm.verts.new(pts[-1]+t*radii[-1]*0.8)
        for k in range(nseg): bm.faces.new((R[-1][k],R[-1][(k+1)%nseg],tip))
        b0=bm.verts.new(pts[0]-(pts[1]-pts[0]).normalized()*radii[0]*0.5)
        for k in range(nseg): bm.faces.new((R[0][(k+1)%nseg],R[0][k],b0))
    return R
def hand(side):
    h0,h1=BW[f'hand.{side}']; a=((h1-h0).normalized()+Vector((0,0,-H.get('hang',0.3)))).normalized(); sg=1 if side=='R' else -1
    n=Vector((-sg,0,0)); n=(n-a*n.dot(a)).normalized()       # palm normal -> toward the body
    w=a.cross(n).normalized()
    if w.y>0: w=-w                                              # w -> forward (thumb side)
    bm=bmesh.new()
    # palm: lofted rounded-rect rings along a
    PR=H['palm']; NP=12; R=[]
    for (t,ww,th) in PR:
        c=h0+a*t; ring=[]
        for k in range(NP):
            ang=2*math.pi*k/NP; cs,sn=math.cos(ang),math.sin(ang)
            ex=H.get('palm_ex',0.8)
            px=math.copysign(abs(cs)**ex,cs)*ww/2; py=math.copysign(abs(sn)**ex,sn)*th/2
            ring.append(bm.verts.new(c+w*px+n*py))
        R.append(ring)
    for r0,r1 in zip(R,R[1:]):
        for k in range(NP): bm.faces.new((r0[k],r0[(k+1)%NP],r1[(k+1)%NP],r1[k]))
    # close both ends with fans
    for r,dirn in ((R[0],-1),(R[-1],1)):
        c=sum((v.co for v in r),Vector())/NP; cv=bm.verts.new(c+a*dirn*0.004)
        for k in range(NP):
            f=(r[k],r[(k+1)%NP],cv) if dirn>0 else (r[(k+1)%NP],r[k],cv)
            bm.faces.new(f)
    kn=h0+a*PR[-1][0]
    for (wo,length,rad,curl) in H['fingers']:
        base=kn+w*wo-a*0.006+n*0.001; d=a.copy(); p=base; pts=[p.copy()]; rads=[rad]
        segs=[length*0.42,length*0.33,length*0.25]
        for si,(sl,cv) in enumerate(zip(segs,curl)):
            q=Quaternion(w,math.radians(cv)*(1 if True else -1))
            d2=(q@d).normalized()
            if d2.dot(n)<d.dot(n): d2=(Quaternion(w,-math.radians(cv))@d).normalized()
            d=d2; p=p+d*sl; pts.append(p.copy()); rads.append(rad*(1-0.12*(si+1)))
        tube(bm,pts,rads,6,True,n)
    # thumb
    T=H['thumb']; base=h0+a*T['t']+w*T['w']+n*T['n']
    d=(a*T['dir'][0]+w*T['dir'][1]+n*T['dir'][2]).normalized(); pts=[base.copy()]; rads=[T['r']]
    p=base
    for sl,cv in zip(T['segs'],T['curl']):
        d=(Quaternion(a,math.radians(cv)*sg*0)@d); d=(d+n*math.radians(cv)*0.6).normalized(); p=p+d*sl; pts.append(p.copy()); rads.append(rads[-1]*0.88)
    tube(bm,pts,rads,6,True,n)
    o=mkobj(f'N_hand_{side}',bm); o['side']=side; return o,a,h0
hands={s:hand(s) for s in ('L','R')}
# ---------------- normals out ----------------
def orient(o,center_fn):
    bm=bmesh.new(); bm.from_mesh(o.data); fl=[]
    for f in bm.faces:
        c=f.calc_center_median()
        if f.normal.dot(c-center_fn(c))<0: fl.append(f)
    bmesh.ops.reverse_faces(bm,faces=fl); bm.to_mesh(o.data); bm.free()
def recalc(o):
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:]); bm.to_mesh(o.data); bm.free()
orient(otorso,lambda c:Vector((0,-0.015,c.z)))
for o in [obib]+ostraps: orient(o,lambda c:Vector((0,-0.015,c.z)))
for side,(o,path,L1,L2,rings) in sleeves.items(): recalc(o)
for side,(o,_,_) in hands.items(): recalc(o)
# ---------------- UVs: solid patches ----------------
YEL=(0.75,0.89); YEL_SH=(0.75,0.815); WHT=(0.25,0.93); WHT_SH=(0.25,0.872)
def flat_uv(o,uvfn):
    me=o.data; uvl=me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices: uvl.data[li].uv=uvfn(me.vertices[me.loops[li].vertex_index].co,p)
SKINP=lambda co:(0.56+0.38*((co.x+0.25)/0.5),0.56+0.18*((co.z-0.8)/0.2))
flat_uv(otorso,lambda co,p:YEL)
for side,(o,path,L1,L2,rings) in sleeves.items():
    seam={len(rings)-SL['cuff_rings']-1}
    nr=len(rings)
    def fn(co,p,o=o,nr=nr):
        return YEL
    flat_uv(o,fn)
    # darker seam ring at cuff top + cuff lip
    me=o.data; uvl=me.uv_layers['UVMap']; ci=nr-SL['cuff_rings']-1
    seamv=set(range(ci*NSEG,(ci+1)*NSEG))|set(range(nr*NSEG+1,nr*NSEG+1+NSEG))
    for p in me.polygons:
        for li in p.loop_indices:
            if me.loops[li].vertex_index in seamv: uvl.data[li].uv=YEL_SH
for o in [obib]+ostraps:
    me=o.data; uvl=me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices: uvl.data[li].uv=WHT
for side,(o,_,_) in hands.items(): flat_uv(o,lambda co,p:SKINP(co))
# ---------------- materials ----------------
for o in new_parts: o.data.materials.clear(); o.data.materials.append(MAT['M_G2_FACE'])
# ---------------- weights ----------------
def vg(o,name): return o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
def torso_w(co):
    z=co.z; w={}
    keys=P['torso_w']
    for (z0,w0),(z1,w1) in zip(keys,keys[1:]):
        if z<=keys[0][0]: w=dict(keys[0][1]); break
        if z0<=z<=z1:
            t=smooth((z-z0)/(z1-z0)); w={b:w0.get(b,0)*(1-t)+w1.get(b,0)*t for b in set(w0)|set(w1)}; break
    else: w=dict(keys[-1][1])
    # shoulder: blend upper_arm near the armhole
    ax=abs(co.x); side='R' if co.x>0 else 'L'
    ua=P['torso_arm_w']*smooth((ax-0.110)/0.050)*smooth((z-1.26)/0.05)
    if ua>0:
        w={b:x*(1-ua) for b,x in w.items()}; w[f'upper_arm.{side}']=w.get(f'upper_arm.{side}',0)+ua
    return w
def apply(o,fn):
    for v in o.data.vertices:
        for b,x in fn(v.co).items():
            if x>1e-4: vg(o,b).add([v.index],x,'REPLACE')
for o in [otorso,obib]+ostraps: apply(o,torso_w)
for side,(o,path,L1,L2,rings) in sleeves.items():
    S,E,W=arm_path(side)
    def sw(co,side=side,S=S,E=E,W=W,L1=L1):
        # arc-length coordinate by projection on the two segments
        u1=(E-S).normalized(); s1=(co-S).dot(u1)
        u2=(W-E).normalized(); s2=(co-E).dot(u2)
        s=s1 if s2<0 else L1+s2
        ua=f'upper_arm.{side}'; fa=f'forearm.{side}'
        if s<L1:
            c=SL['cap_chest']*(1-smooth((s-SL['cap_s0'])/(SL['cap_s1']-SL['cap_s0'])))
            f=smooth((s-(L1-SL['elbow_w']))/(2*SL['elbow_w']))
            return {'chest':c,ua:(1-c)*(1-f),fa:(1-c)*f}
        f=smooth((s-(L1-SL['elbow_w']))/(2*SL['elbow_w']))
        return {ua:1-f,fa:f}
    # armhole rings: blend from the torso weights (ring 0 == torso seam, identical weights) to the sleeve weights
    nb=len(SL['snap_blend'])
    for v in o.data.vertices:
        ri=v.index//NSEG
        if ri<nb:
            wb=SL['snap_blend'][ri]; a_=torso_w(v.co); b_=sw(v.co)
            w={k:a_.get(k,0)*(1-wb)+b_.get(k,0)*wb for k in set(a_)|set(b_)}
        else: w=sw(v.co)
        for k,x in w.items():
            if x>1e-4: vg(o,k).add([v.index],x,'REPLACE')
for side,(o,a,h0) in hands.items():
    def hw(co,side=side,a=a,h0=h0):
        t=(co-h0).dot(a); f=smooth((t+0.004)/0.022)
        return {f'forearm.{side}':1-f,f'hand.{side}':f}
    apply(o,hw)
for o in new_parts:
    vg(o,'_tag_body_r1').add(list(range(len(o.data.vertices))),1.0,'REPLACE')
    for p in o.data.polygons: p.use_smooth=True
for o in new_parts:
    mm=o.modifiers.new('a','ARMATURE'); mm.object=arm
stat={o.name:dict(verts=len(o.data.vertices),tris=sum(len(p.vertices)-2 for p in o.data.polygons)) for o in new_parts}
print('PARTS',json.dumps(stat))
json.dump(stat,open(os.path.join(OUT,'data','parts_stats.json'),'w'),indent=1)
bpy.ops.object.select_all(action='DESELECT')
for o in new_parts: o.select_set(True)
body.select_set(True); bpy.context.view_layer.objects.active=body
bpy.ops.object.join()
me=body.data
if 'Color' in me.color_attributes:
    for d in me.color_attributes['Color'].data: d.color=(1,1,1,1)
if not os.environ.get('BLINK'): bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'body_r1_work.blend'))

old={'M_G2_FACE','M_G2_HEAD','M_G2_HAIR','M_G2_BODY'}
C=Vector((0,0.006,1.535)); EA=Vector((0.080,0.100,0.135))
JN=json.load(open(os.path.join(OUT,'data','joint_names.json')))
# ---------------- export primitives for splice ----------------
_B=os.environ.get('BLINK')
if _B:
    du,dv=[float(x) for x in _B.split(',')]; gi=body.vertex_groups['_tag_eyes'].index; me_=body.data; uvl=me_.uv_layers[0]
    ev={v.index for v in me_.vertices if any(g.group==gi and g.weight>0.5 for g in v.groups)}
    for li,l in enumerate(me_.loops):
        if l.vertex_index in ev: uvl.data[li].uv=(uvl.data[li].uv[0]+du,uvl.data[li].uv[1]+dv)
dg=bpy.context.evaluated_depsgraph_get()
me=body.data
me.calc_loop_triangles()
gn={g.index:g.name for g in body.vertex_groups}
uvd=me.uv_layers[0].data
cn=me.corner_normals
TAG=body.vertex_groups['_tag_skull'].index
outp={}
for mi,m in enumerate(me.materials):
    if m.name not in old: continue
    keymap={}; P=[];N=[];U=[];J=[];W=[];I=[]
    for lt in me.loop_triangles:
        if lt.material_index!=mi: continue
        tri=[]
        for li in lt.loops:
            vi=me.loops[li].vertex_index; uv=tuple(round(x,6) for x in uvd[li].uv); nv=cn[li].vector
            vv=me.vertices[vi]
            if any(g.group==TAG for g in vv.groups):
                dd=vv.co-C; ne=Vector((dd.x/EA.x**2,dd.y/EA.y**2,dd.z/EA.z**2)).normalized(); nv=ne.lerp(vv.normal,0.15).normalized()
            n=tuple(round(x,5) for x in nv)
            k=(vi,uv,n)
            if k not in keymap:
                keymap[k]=len(P); v=me.vertices[vi]
                P.append((v.co.x,v.co.z,-v.co.y)); N.append((n[0],n[2],-n[1])); U.append((uv[0],1-uv[1]))
                gs=sorted([(g.weight,gn[g.group]) for g in v.groups if g.weight>1e-4 and gn[g.group] in JN],reverse=True)[:4]
                s=sum(w for w,_ in gs); gs=[(w/s,b) for w,b in gs]+[(0,'root')]*(4-len(gs))
                J.append([JN.index(b) if w>0 else 0 for w,b in gs]); W.append([w for w,_ in gs])
            tri.append(keymap[k])
        I.append(tri)
    outp[m.name]=dict(P=np.array(P,np.float32),N=np.array(N,np.float32),U=np.array(U,np.float32),J=np.array(J,np.uint8),W=np.array(W,np.float32),I=np.array(I,np.uint16).reshape(-1))
    print('PRIM',m.name,len(P),len(I))
np.savez(os.path.join(OUT,'data',os.environ.get('NPZ','head_prims.npz')),**{f'{k}__{a}':v[a] for k,v in outp.items() for a in v})
# vertex group index lists for the two hair groups (glTF cannot store them)
vgi={}
for gname in ('hair.fringe','hair.back'):
    gi=body.vertex_groups[gname].index
    vgi[gname]=dict(blend_vertex_count=sum(1 for v in me.vertices if any(g.group==gi for g in v.groups)))
json.dump(vgi,open(os.path.join(OUT,'data','hair_vertex_groups.json'),'w'),indent=1)
print('DONE')
