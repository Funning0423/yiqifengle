# blender -b --python build_head_hy.py -- <head_r2_work_final.blend> <outdir>
# Head round HY: game-poly retopology of the Hunyuan V3.1 head (1.5M tris).
#   Clean procedural topology is projected onto the Hunyuan surfaces (per albedo class):
#   - skull/face: quad sphere ray-projected onto the Hunyuan skin, smoothed, rounder chin, small nose
#   - hair: crown cap / inner fill / side pieces / temple locks / back piece (hair.back) / 7 fringe strands (hair.fringe),
#           all driven by the sampled Hunyuan hair envelope r(az,th) and its hem line (tips)
#   - hat: rings fitted to the Hunyuan straw surface (brim plane by PCA, crown wall + brim top ray-cast)
#   - eyes: separate meshes per eye (domed eye disc + 3D upper lash ridge), blink by UV offset (_tag_eyes, HANDOFF 4.6)
#   Neck and stand collar from head-r2 are kept. Result is joined into LOD0_G2_BODY with the same tags as head-r2,
#   so body-r4/scripts/build_body.py can use head_hy_work_final.blend as its input unchanged.
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import hy_load as HL
a=sys.argv[sys.argv.index("--")+1:]; BLEND,OUT=a[0],os.path.abspath(a[1])
P=json.load(open(os.path.join(OUT,'data','params.json')))
bpy.ops.wm.open_mainfile(filepath=BLEND)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
body=bpy.data.objects['LOD0_G2_BODY']
MAT={m.name:m for m in bpy.data.materials}
C=Vector(P['C']); CH=Vector(P['CH'])
def smooth(t): t=max(0,min(1,t)); return t*t*(3-2*t)
def lerp(a,b,t): return a+(b-a)*t
LOG={}
# ---------------- Hunyuan source, per-class BVH ----------------
W,UV,I,cls,_=HL.load(); CEN=W[I].mean(1)
def bvh_sel(mask):
    T=I[mask]; used,inv=np.unique(T,return_inverse=True)
    return BVHTree.FromPolygons([tuple(x) for x in W[used]],inv.reshape(-1,3).tolist())
zc=CEN[:,2]
face_m=(cls!=0)&(cls!=2)&(cls!=4)&~((cls==3)&(zc>1.6))&(zc>1.455)&(zc<1.65)&(np.abs(CEN[:,0])<0.105)&(CEN[:,1]<0.06)
hair_m=(cls==0)&(zc>1.40)
hat_m=((cls==2)|(cls==3))&(zc>1.57)
FB=bvh_sel(face_m); HB=bvh_sel(hair_m); TB=bvh_sel(hat_m)
pink_hat=CEN[(cls==3)&(zc>1.57)]
LOG['src_tris']=dict(face=int(face_m.sum()),hair=int(hair_m.sum()),hat=int(hat_m.sum()))
print('SRC',LOG['src_tris'])
# ---------------- hair envelope r(az,th) around CH ----------------
G=P['hair_grid']; AZ=np.arange(-180,180,G['daz']); TH=np.arange(0,180+1e-6,G['dth'])
def hdir(az,th):
    a_=math.radians(az); t=math.radians(th); return Vector((math.sin(t)*math.sin(a_),-math.sin(t)*math.cos(a_),math.cos(t)))
R=np.full((len(TH),len(AZ)),np.nan)
for i,th in enumerate(TH):
    for j,az in enumerate(AZ):
        d=hdir(az,th); h=HB.ray_cast(CH+d*0.32,-d,0.32-0.035)
        if h[0] is not None and (h[0]-CH).dot(d)>0.035: R[i,j]=(h[0]-CH).length
# hem line: per azimuth, last row of the contiguous run that starts in the upper half
th_end=np.zeros(len(AZ))
for j in range(len(AZ)):
    col=~np.isnan(R[:,j]); last=None
    for i in range(len(TH)):
        if col[i]: last=i
        elif last is not None and TH[i]>40: break
    th_end[j]=TH[last] if last is not None else 90
# small gaps (strand noise) and the hidden top under the hat are filled by diffusion; below the hem extrapolated
valid=~np.isnan(R); F=np.where(valid,R,np.nanmean(R))
for it in range(400):
    Fp=np.pad(F,((1,1),(0,0)),mode='edge'); Fn=(Fp[:-2]+Fp[2:]+np.roll(F,1,1)+np.roll(F,-1,1))/4
    F=np.where(valid,R,Fn)
# light gaussian smoothing (keeps clump-scale relief: sigma ~1 cell = 2.5 deg)
def gblur(A,s):
    if s<=0: return A
    k=np.exp(-0.5*(np.arange(-3,4)/s)**2); k/=k.sum()
    B=np.apply_along_axis(lambda r: np.convolve(np.r_[r[-3:],r,r[:3]],k,'valid'),1,A)
    Bp=np.pad(B,((3,3),(0,0)),mode='edge'); return np.apply_along_axis(lambda c: np.convolve(c,k,'valid'),0,Bp)
F=gblur(F,G['sigma'])
k=np.exp(-0.5*(np.arange(-4,5)/2.0)**2); k/=k.sum(); th_end=np.convolve(np.r_[th_end[-4:],th_end,th_end[:4]],k,'valid')
LOG['hair_env']=dict(valid_frac=float(valid.mean()),r_min=float(np.nanmin(R)),r_max=float(np.nanmax(R)),th_end_front=float(th_end[len(AZ)//2]),th_end_side=float(th_end[int((90+180)/G['daz'])]),th_end_back=float(th_end[0]))
print('ENV',LOG['hair_env'])
def env(az,th):
    az=((az+180)%360)-180; th=max(0.0,min(180.0,th))
    fj=(az+180)/G['daz']; j0=int(math.floor(fj))%len(AZ); j1=(j0+1)%len(AZ); tj=fj-math.floor(fj)
    fi=th/G['dth']; i0=min(int(fi),len(TH)-1); i1=min(i0+1,len(TH)-1); ti=fi-i0
    return (F[i0,j0]*(1-tj)+F[i0,j1]*tj)*(1-ti)+(F[i1,j0]*(1-tj)+F[i1,j1]*tj)*ti
def thend(az):
    az=((az+180)%360)-180; fj=(az+180)/G['daz']; j0=int(math.floor(fj))%len(AZ); j1=(j0+1)%len(AZ); t=fj-math.floor(fj)
    return th_end[j0]*(1-t)+th_end[j1]*t
NPAN,PH=9,20.0
def panel(az): return abs(math.sin(math.radians(az-PH)*NPAN/2))**0.6
def hair_pt(az,th,extra=0.0,cusp=True):
    r=env(az,th)
    if cusp: r*=1+P['hair_cusp']*(panel(az)-0.75)*smooth((th-58)/50)
    return CH+hdir(az,th)*(r+extra)
def env_r(p):
    d=p-CH; r=d.length; th=math.degrees(math.acos(max(-1,min(1,d.z/r)))); az=math.degrees(math.atan2(d.x,-d.y)); return env(az,th),az,th
# ---------------- skull / face ----------------
SF=P['skull_fallback']
def fallback(d):
    x=SF['x']*d.x; y=(SF['yf'] if d.y<0 else SF['yb'])*d.y; z=(SF['zt'] if d.z>0 else SF['zb'])*d.z
    return C+Vector((x,y,z))
def quad_sphere(cuts):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=2)
    bmesh.ops.subdivide_edges(bm,edges=bm.edges[:],cuts=cuts,use_grid_fill=True)
    for v in bm.verts: v.co=v.co.normalized()
    return bm
bm=quad_sphere(P['skull_cuts']); hitw={}
for v in bm.verts:
    d=v.co.normalized(); p=fallback(d); w=0.0
    h=FB.ray_cast(C+d*0.30,-d,0.30-0.03)
    if h[0] is not None and (h[0]-C).dot(d)>0.03 and 0.045<(h[0]-C).length<0.135:
        p=h[0]; w=1.0
    # stay inside the hair (with gap) wherever hair covers this direction
    re,az,th=env_r(p)
    if th<thend(az)+(14 if abs(az)>75 else -4) and not (abs(az)<60 and th>45):
        rp=(p-CH).length; lim=re-P['skull_hair_gap']
        if rp>lim: p=CH+(p-CH)*(lim/rp)
    v.co=p; hitw[v.index]=w
# laplacian smoothing (face detail of the 1.5M source is reduced to the game silhouette)
for it in range(P['skull_smooth']):
    new={}
    for v in bm.verts:
        nb=[e.other_vert(v).co for e in v.link_edges]; avg=sum(nb,Vector())/len(nb); new[v]=v.co.lerp(avg,0.5)
    for v,c in new.items(): v.co=c
# rounder chin: pull the lower face toward a circle in the side profile + soften the jaw corners
CN=P['chin']
for v in bm.verts:
    p=v.co
    if p.y<C.y and p.z<CN['z1']:
        t=smooth((CN['z1']-p.z)/(CN['z1']-CN['z0']))
        p.x*=1+CN['round']*0.18*t*(1-abs(p.x)/0.07)      # wider, rounder jaw line
        p.z+=CN['lift']*t
# small nose (the Hunyuan nose is smoothed away at this density)
NS=P['nose']
for v in bm.verts:
    p=v.co
    if p.y<-0.06: p.y-=NS['amp']*math.exp(-((p.x/NS['sx'])**2+((p.z-NS['z'])/NS['sz'])**2))
dele=[f for f in bm.faces if (f.calc_center_median()-C).normalized().z>0.74 or ((f.calc_center_median()-C).normalized().y>0.50 and f.calc_center_median().z>1.52)]
bmesh.ops.delete(bm,geom=dele,context='FACES'); bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
skull=bpy.data.meshes.new('skull'); bm.to_mesh(skull); bm.free()
oskull=bpy.data.objects.new('N_skull',skull); bpy.context.scene.collection.objects.link(oskull)
skull_bvh=BVHTree.FromObject(oskull,bpy.context.evaluated_depsgraph_get())
LOG['skull_proj_frac']=float(np.mean(list(hitw.values())))
# ellipsoid fit for soft anime normals (export uses C/EA for _tag_skull vertices)
SV=np.array([v.co[:] for v in skull.vertices])-np.array(C[:])
EA=Vector((float(np.percentile(np.abs(SV[:,0]),97)),float(np.percentile(np.abs(SV[:,1]),97)),float(np.percentile(np.abs(SV[:,2]),97))))
LOG['skull_ellipsoid']=dict(C=list(C),EA=list(EA))
def on_skull_front(x,z,off):
    hit=skull_bvh.ray_cast(Vector((x,-0.3,z)),Vector((0,1,0)),1.0)
    if hit[0] is None: hit=skull_bvh.find_nearest(Vector((x,-0.08,z)))
    return hit[0],hit[1]
def hug(az,z,off):
    a_=math.radians(az)
    hit=skull_bvh.ray_cast(C+Vector((0,0,z-C.z)),Vector((math.sin(a_),-math.cos(a_),0)),0.5)
    if hit[0] is None: return None
    return hit[0]+hit[1]*off
# ---------------- neck/collar from head-r2 are kept; old skull/eyes/hat/hair removed ----------------
gi={g.name:g.index for g in body.vertex_groups}
kill_tags={gi[t] for t in ('_tag_skull','_tag_eyes','_tag_hat','_tag_hair_shell','hair.fringe','hair.back') if t in gi}
bm=bmesh.new(); bm.from_mesh(body.data); dl=bm.verts.layers.deform.active
kf=[f for f in bm.faces if all(any(g in kill_tags and w>0.5 for g,w in v[dl].items()) for v in f.verts)]
LOG['removed_r2_head_faces']=len(kf)
bmesh.ops.delete(bm,geom=kf,context='FACES'); bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(body.data); bm.free()
# ---------------- sheets / helpers ----------------
def sheet(name, cols, rows, fn, close_u=False):
    bm=bmesh.new(); Gd=[[bm.verts.new(fn(i,j)) for i in range(cols)] for j in range(rows)]
    nc=cols if close_u else cols-1
    for j in range(rows-1):
        for i in range(nc):
            bm.faces.new((Gd[j][i],Gd[j][(i+1)%cols],Gd[j+1][(i+1)%cols],Gd[j+1][i]))
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(name,me); bpy.context.scene.collection.objects.link(o); return o
PHASE={}   # per-object per-vertex lock phase (0 seam .. 1 lock centre) for the hair UV
def set_phase(o,fn):
    PHASE[o.name]=[fn(v) for v in o.data.vertices]
def az_of(p): return math.degrees(math.atan2(p.x-CH.x,-(p.y-CH.y)))
# ---------------- hair ----------------
NL=48
def crown_end(az):
    base=50 if abs(az)<46 else (50+(min(abs(az),70)-46)/24*32)
    return min(base,thend(az)-6)
ROWS_C=10
ocrown=sheet('N_hair_crown',NL,ROWS_C,lambda i,j: hair_pt(-180+360*i/NL,lerp(2,crown_end(-180+360*i/NL),j/(ROWS_C-1)),0.004),close_u=True)
bm=bmesh.new(); bm.from_mesh(ocrown.data); bm.verts.ensure_lookup_table()
ring=[bm.verts[i] for i in range(NL)]; top=bm.verts.new(hair_pt(0,0,0.004,False))
for i in range(NL): bm.faces.new((top,ring[(i+1)%NL],ring[i]))
bm.to_mesh(ocrown.data); bm.free()
oinner=sheet('N_hair_inner',21,6,lambda i,j: hair_pt(82+196*i/20,lerp(70,max(110,thend(82+196*i/20)-8),j/5),-0.007,False))
def side_fn(sign):
    NCs,NRs=14,14
    def fn(i,j):
        u=i/(NCs-1); tj=j/(NRs-1); az=lerp(63+30*smooth(tj*1.2),122,u)
        azs=az*sign
        te=thend(azs)+3.0*(panel(azs)-0.6)
        th=lerp(62,te,tj)
        p=hair_pt(azs,th,0.0016)
        if tj>0.80:
            k=(tj-0.80)/0.20; q=(p-Vector((CH.x,CH.y,p.z))); p=Vector((CH.x,CH.y,p.z))+q*(1-0.22*k*k); p.z+=0.012*k*k
        if u<0.25:
            h=hug(azs,p.z,0.009)
            if h is not None and p.z<1.62: p=p.lerp(h,(1-u/0.25)*(0.25+0.15*smooth((tj-0.3)/0.5)))
        return p
    return fn,NCs,NRs
fnL,a1,b1=side_fn(1); osideL=sheet('N_hair_side_L',a1,b1,fnL)
fnR,a1,b1=side_fn(-1); osideR=sheet('N_hair_side_R',a1,b1,fnR)
def temple_fn(sign):
    def fn(i,j):
        u=i/3; tj=j/8; az=sign*(lerp(56,64,u)+6*tj); th=lerp(50,min(124,thend(az)-2),tj)
        p=hair_pt(az,th,0.0045,False)
        h=hug(az,p.z,0.011)
        if h is not None: p=p.lerp(h,0.40*tj)
        return p
    return fn
otL=sheet('N_hair_temple_L',4,9,temple_fn(1)); otR=sheet('N_hair_temple_R',4,9,temple_fn(-1))
for o in (otL,otR):
    vs=o.data.vertices
    for j in range(9):
        tj=j/8; row=[vs[j*4+i] for i in range(4)]; cen=sum((v.co for v in row),Vector())/4
        for v in row: v.co=cen+(v.co-cen)*(1-0.7*tj**1.5)
NCb,NRb=33,12
def back_fn(i,j):
    u=i/(NCb-1); az=lerp(100,260,u); tj=j/(NRb-1)
    te=thend(az)+3.0*(panel(az)-0.6)
    th=lerp(74,te,tj)
    p=hair_pt(az,th,0.0)
    if tj>0.78:
        k=(tj-0.78)/0.22; q=(p-Vector((CH.x,CH.y,p.z))); p=Vector((CH.x,CH.y,p.z))+q*(1-0.15*k*k); p.z+=0.012*k*k
    return p
oback=sheet('N_hair_back',NCb,NRb,back_fn)
# fringe: 7 strands, root on the crown, tip on the Hunyuan fringe hem; S=(root az, tip az, width deg)
fr=[]; FR_S={}
for k,(ra,ta,wdeg) in enumerate(P['fringe']):
    NR,NC=9,4
    def fn(i,j,ra=ra,ta=ta,wdeg=wdeg,k=k):
        t=j/(NR-1); s=(i/(NC-1))*2-1
        az=lerp(ra,ta,t**1.4)+s*wdeg*0.5*(1-0.62*t**2.6)
        th=lerp(38,thend(az)+1.5*(1-abs(s)),t)
        p=hair_pt(az,th,0.0,False)
        bow=0.0035*math.sin(min(1,t)*math.pi*0.85)*(1-0.5*s*s)+0.0006*k
        return p+(p-CH).normalized()*(bow+0.002)
    o=sheet(f'N_hair_fringe_{k}',NC,NR,fn); fr.append(o)
    FR_S[o.name]=[1-abs((vi%NC)/(NC-1)*2-1) for vi in range(NC*NR)]
bpy.ops.object.select_all(action='DESELECT')
for o in fr: o.select_set(True)
bpy.context.view_layer.objects.active=fr[0]; bpy.ops.object.join(); ofringe=fr[0]; ofringe.name='N_hair_fringe'
fr_phase=sum((FR_S[k] for k in sorted(FR_S,key=lambda n:int(n.split('_')[-1]))),[])
def cheek_fn(sign):
    def fn(i,j):
        az=sign*lerp(72,118,i/6); z=lerp(1.60,1.47,j/6)
        h=None; zz=z
        while h is None and zz<1.62: h=hug(az,zz,0.0075); zz+=0.004
        if h is None: return hair_pt(az,110,-0.01,False)
        return h
    return fn
ocheekL=sheet('N_hair_cheek_L',7,7,cheek_fn(1)); ocheekR=sheet('N_hair_cheek_R',7,7,cheek_fn(-1))
hair_parts=[ocrown,oinner,osideL,osideR,otL,otR,oback,ofringe,ocheekL,ocheekR]
# ---------------- eyes (separate meshes) ----------------
E=P['eye']; UZ0=P['uv_z0']
def lid_curve(t,sx):
    """upper lid line, t 0 inner .. 1 outer (planar x,z)"""
    x=E['cx']+(t*2-1)*E['w']*1.0; z=E['cz']+E['h']*E['lid_y']*0.82+math.sin(t*math.pi)*E['h']*E['lid_curv']*0.55-0.0018*t
    return sx*x,z
eye_objs=[]
for sx in (-1,1):
    bm=bmesh.new(); NRg,NSg=4,16; tilt=math.radians(E['tilt'])*sx
    def place(x,z,lift):
        hp,hn=on_skull_front(x,z,0); return hp+hn*lift
    cx,cz=sx*E['cx'],E['cz']; ew,eh=E['w']*1.18,E['h']*1.16
    c=bm.verts.new(place(cx,cz,E['off']+E['dome'])); rings=[]
    for r in range(1,NRg+1):
        rr=r/NRg; ring=[]
        for k in range(NSg):
            a_=2*math.pi*k/NSg; dx=math.cos(a_)*ew*rr; dz=math.sin(a_)*eh*rr
            x=cx+dx*math.cos(tilt)-dz*math.sin(tilt); z=cz+dx*math.sin(tilt)+dz*math.cos(tilt)
            ring.append(bm.verts.new(place(x,z,E['off']+E['dome']*(1-rr*rr))))
        rings.append(ring)
    for k in range(NSg): bm.faces.new((c,rings[0][k],rings[0][(k+1)%NSg]))
    for r0,r1 in zip(rings,rings[1:]):
        for k in range(NSg): bm.faces.new((r0[k],r1[k],r1[(k+1)%NSg],r0[(k+1)%NSg]))
    me=bpy.data.meshes.new('eye'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(f'N_eye_{"L" if sx<0 else "R"}',me); bpy.context.scene.collection.objects.link(o); eye_objs.append(o)
lash_objs=[]
for sx in (-1,1):
    bm=bmesh.new(); NSg=12; secs=[]
    for i in range(NSg+1):
        t=i/NSg; o_=t if sx>0 else t   # t: inner->outer in both eyes (x sign handles mirroring)
        x,z=lid_curve(t,sx); th_=lerp(E['lash_t0'],E['lash_t1'],t**1.5)
        p0,n0=on_skull_front(x,z-0.0004,0); p1,n1=on_skull_front(x,z+th_,0)
        out=E['lash_out']*(0.6+0.4*t)
        a0=p0+n0*(E['off']*0.5); a1=p1+n1*(E['off']*0.5); b1=p1+n1*(out); b0=p0+n0*(out*0.7)
        secs.append([bm.verts.new(a0),bm.verts.new(b0),bm.verts.new(b1),bm.verts.new(a1)])
    # outer flick
    x,z=lid_curve(1.0,sx); pf,nf=on_skull_front(x+sx*0.0042,z+0.0016,0); tip=bm.verts.new(pf+nf*0.0008)
    for s0,s1 in zip(secs,secs[1:]):
        for k in range(3): bm.faces.new((s0[k],s0[k+1],s1[k+1],s1[k]))
    for k in range(3): bm.faces.new((secs[-1][k],secs[-1][k+1],tip))
    me=bpy.data.meshes.new('lash'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(f'N_lash_{"L" if sx<0 else "R"}',me); bpy.context.scene.collection.objects.link(o); lash_objs.append(o)
# ---------------- hat: fitted to the Hunyuan straw surface ----------------
HP=P['hat']; hc=CEN[hat_m]
ct=hc[hc[:,2]>hc[:,2].max()-0.012].mean(0)
ang=np.degrees(np.arctan2(hc[:,0]-ct[0],-(hc[:,1]-ct[1]))); rr_=np.hypot(hc[:,0]-ct[0],hc[:,1]-ct[1])
rim=[]
for b in range(72):
    m=(ang>=-180+5*b)&(ang<-175+5*b)
    if m.sum(): k_=np.argmax(np.where(m,rr_,-1)); rim.append(hc[k_])
rim=np.array(rim); rc=rim.mean(0); _,_,vt=np.linalg.svd(rim-rc,full_matrices=False); n=vt[2]; n=n if n[2]>0 else -n
ez=Vector(n); ex=(Vector((1,0,0))-ez*ez.x).normalized(); ey=ez.cross(ex)
O=Vector(rc)
def L2W(x,y,z): return O+ex*x+ey*y+ez*z
def W2L(p): d=p-O; return Vector((d.dot(ex),d.dot(ey),d.dot(ez)))
HL_=np.array([W2L(Vector(p))[:] for p in hc])
def fit_ellipse(pts2):
    """outer outline per 10deg bin -> axis-aligned ellipse (cx,cy,rx,ry) by linear least squares"""
    c0=pts2.mean(0); a=np.arctan2(pts2[:,1]-c0[1],pts2[:,0]-c0[0]); r=np.hypot(*(pts2-c0).T); out=[]
    for b in range(36):
        m=(a>=-math.pi+b*math.pi/18)&(a<-math.pi+(b+1)*math.pi/18)
        if m.sum()>=1: out.append(pts2[m][np.argmax(r[m])])
    q=np.array(out); A=np.c_[q[:,0]**2,q[:,1]**2,q[:,0],q[:,1]]; s=np.linalg.lstsq(A,np.ones(len(q)),rcond=None)[0]
    cx=-s[2]/(2*s[0]); cy=-s[3]/(2*s[1]); k=1+s[0]*cx*cx+s[1]*cy*cy
    return cx,cy,math.sqrt(k/s[0]),math.sqrt(k/s[1])
pl=np.array([W2L(Vector(p))[:] for p in pink_hat])
pw=pl[(pl[:,2]>0.012)]
BAND=(float(np.percentile(pw[:,2],4)),float(np.percentile(pw[:,2],96))) if len(pw)>50 else (0.02,0.045)
HTOP=float(np.percentile(HL_[:,2],99.5))
cw=HL_[(HL_[:,2]>BAND[1])&(HL_[:,2]<HTOP-0.01)]
ccx,ccy,crx,cry=fit_ellipse(cw[:,:2]); CC=Vector((ccx,ccy,0))
rl=np.array([W2L(Vector(p))[:] for p in rim]); bcx,bcy,brx,bry=fit_ellipse(rl[:,:2])
BRIM_DROOP=float(np.median(rl[:,2]))
crx+=HP['crown_shrink']; cry+=HP['crown_shrink']
# brim top-surface height vs distance outside the crown wall (upper quartile per ring) -> logged; the brim profile
# below (junction fillet + flat outer brim) follows it. Crown height / band set to the V12 boater ratio.
_ph=np.arctan2(HL_[:,1]-ccy,HL_[:,0]-ccx); _r=np.hypot(HL_[:,0]-ccx,HL_[:,1]-ccy)
_rc=1/np.sqrt((np.cos(_ph)/crx)**2+(np.sin(_ph)/cry)**2)
BRIM_PROF={}
for f0 in (0.005,0.02,0.04,0.06,0.08):
    m=(np.abs(_r-_rc-f0)<0.006)&(HL_[:,2]<0.06)
    if m.sum()>20: BRIM_PROF[f0]=float(np.percentile(HL_[m,2],75))
LOG['brim_profile_m']=BRIM_PROF
CB=HP['junction']; HTOP_SRC=HTOP; HTOP=CB+HP['crown_h']
BAND=(CB+0.004,CB+0.004+HP['band_frac']*HP['crown_h'])
# extra back tilt + back shift (eyes visible from the 30deg game camera, like head-r2)
TX=math.radians(HP.get('tilt_extra',0.0)); Rx=Matrix.Rotation(-TX,3,ex)
ez=(Rx@ez).normalized(); ey=(Rx@ey).normalized(); O=O+Vector((0,HP.get('back',0.0),HP.get('up',0.0)))
def rim_at(phi):
    """brim outer radius from the crown centre along phi (fitted ellipse, may be offset from the crown) + droop"""
    d=(math.cos(phi),math.sin(phi)); ox,oy=ccx-bcx,ccy-bcy
    A_=(d[0]/brx)**2+(d[1]/bry)**2; B_=2*(ox*d[0]/brx**2+oy*d[1]/bry**2); C_=(ox/brx)**2+(oy/bry)**2-1
    t=(-B_+math.sqrt(max(0,B_*B_-4*A_*C_)))/(2*A_)
    return t*HP.get('brim_scale',1.0),BRIM_DROOP
def ell_r(phi,rx,ry): return 1/math.sqrt((math.cos(phi)/rx)**2+(math.sin(phi)/ry)**2)
def crown_r(phi,hz):
    taper=1-HP.get('crown_taper',0.06)*max(0,(hz-BAND[1]))/max(1e-3,(HTOP-BAND[1]))
    return ell_r(phi,crx,cry)*taper
LOG['hat']=dict(src_top_h=HTOP_SRC,normal=list(n),tilt_back_deg=math.degrees(math.atan2(n[1],n[2]))+HP.get('tilt_extra',0.0),crown=[ccx,ccy,crx,cry],brim=[bcx,bcy,brx,bry],droop=BRIM_DROOP,top_h=HTOP,band=BAND)
print('HAT',LOG['hat'])
N=HP['N']; PHI=[2*math.pi*k/N for k in range(N)]
CWH=[CB,BAND[0],(BAND[0]+BAND[1])/2,BAND[1],lerp(BAND[1],HTOP,0.45),HTOP-0.012,HTOP-0.004]
CR={hz:[crown_r(p,hz)*(0.985 if hz==CWH[-1] else 1.0) for p in PHI] for hz in CWH}
cbase=CR[CWH[0]]
def brim_top(phi,rad):
    """gentle boater brim: flat near the crown, droop toward the rim (fraction of the fitted rim droop)"""
    rmx,_=rim_at(phi); f=max(0.0,min(1.0,(rad-ell_r(phi,crx,cry))/max(1e-3,rmx-ell_r(phi,crx,cry))))
    return HP['brim_out']+(CB-HP['brim_out'])*math.exp(-f/HP['fillet'])-HP['rim_droop']*f**4
bm=bmesh.new(); RINGS=[]; band_rows=set()
def add_ring(pts): RINGS.append([bm.verts.new(L2W(*p)) for p in pts])
# top cap rings (rounded crown top)
add_ring([(CC.x+math.cos(p)*CR[CWH[-1]][k]*0.55,CC.y+math.sin(p)*CR[CWH[-1]][k]*0.55,HTOP+0.001) for k,p in enumerate(PHI)])
add_ring([(CC.x+math.cos(p)*CR[CWH[-1]][k]*0.85,CC.y+math.sin(p)*CR[CWH[-1]][k]*0.85,HTOP-0.001) for k,p in enumerate(PHI)])
for hz in CWH[::-1]:
    if hz in (BAND[0],BAND[1]): band_rows.add(len(RINGS))
    add_ring([(CC.x+math.cos(p)*CR[hz][k],CC.y+math.sin(p)*CR[hz][k],hz) for k,p in enumerate(PHI)])
# brim (top surface ray-cast; rim from the fitted outline), roll, underside back to the crown
BF=[0.25,0.5,0.75,0.92,1.0]; top_z={}
for f in BF:
    pts=[]
    for k,p in enumerate(PHI):
        rr0=cbase[k]+0.004; rmx,rzz=rim_at(p); rad=lerp(rr0,rmx,f)
        z=brim_top(p,rad); z=z if z is not None else lerp(0.0,rzz,f)
        pts.append((CC.x+math.cos(p)*rad,CC.y+math.sin(p)*rad,z)); top_z[(f,k)]=z
    add_ring(pts)
th0,th1=HP['thick0'],HP['thick1']
rimpts=[]
for k,p in enumerate(PHI):
    rmx,_=rim_at(p); z=top_z[(1.0,k)]
    rimpts.append((CC.x+math.cos(p)*(rmx+0.002),CC.y+math.sin(p)*(rmx+0.002),z-th1*0.5))
add_ring(rimpts)
for f in BF[::-1]:
    pts=[]
    for k,p in enumerate(PHI):
        rr0=cbase[k]+0.004; rmx,_=rim_at(p); rad=lerp(rr0,rmx,f)
        pts.append((CC.x+math.cos(p)*rad,CC.y+math.sin(p)*rad,top_z[(f,k)]-lerp(th0,th1,f)))
    add_ring(pts)
add_ring([(CC.x+math.cos(p)*(cbase[k]-0.002),CC.y+math.sin(p)*(cbase[k]-0.002),top_z[(BF[0],k)]-th0) for k,p in enumerate(PHI)])
cen=bm.verts.new(L2W(CC.x,CC.y,HTOP+0.002))
for k in range(N): bm.faces.new((cen,RINGS[0][(k+1)%N],RINGS[0][k]))
band_faces=set()
for i in range(len(RINGS)-1):
    for k in range(N):
        f=bm.faces.new((RINGS[i][k],RINGS[i][(k+1)%N],RINGS[i+1][(k+1)%N],RINGS[i+1][k]))
        if i in (min(band_rows),min(band_rows)+1) : band_faces.add(f)
bm.faces.index_update(); band_idx={f.index for f in band_faces}
me=bpy.data.meshes.new('hat'); bm.to_mesh(me); bm.free()
ohat=bpy.data.objects.new('N_hat',me); bpy.context.scene.collection.objects.link(ohat)
# tuck hair inside the crown (anything above the brim base outside the crown wall is pulled in; top clamped)
def crown_lim(phi,hz):
    k=int(round(phi/(2*math.pi)*N))%N
    hz_=max(CWH[0],min(CWH[-1],hz)); keys=sorted(CR)
    for z0,z1 in zip(keys,keys[1:]):
        if z0<=hz_<=z1: t=(hz_-z0)/(z1-z0); return CR[z0][k]*(1-t)+CR[z1][k]*t
    return CR[keys[0]][k]
ntuck=0
for o in hair_parts:
    for v in o.data.vertices:
        l=W2L(v.co); phi=math.atan2(l.y-CC.y,l.x-CC.x); rr=math.hypot(l.x-CC.x,l.y-CC.y)
        bz=top_z[(BF[0],int(round(phi/(2*math.pi)*N))%N)]
        if l.z>bz-0.016:
            lim=crown_lim(phi,l.z)-0.006
            if rr>lim and rr<lim+0.06:
                s=lim/rr; l.x=CC.x+(l.x-CC.x)*s; l.y=CC.y+(l.y-CC.y)*s; v.co=L2W(*l); ntuck+=1
        l=W2L(v.co)
        if l.z>HTOP-0.007: l.z=HTOP-0.007; v.co=L2W(*l); ntuck+=1
LOG['hair_tucked']=ntuck
# ---------------- normals ----------------
def recalc(o, inside=False):
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
    if inside: bmesh.ops.reverse_faces(bm,faces=bm.faces[:])
    bm.to_mesh(o.data); bm.free()
def orient_out(o,c=CH):
    me=o.data; bm=bmesh.new(); bm.from_mesh(me); fl=[]
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median()-c)<0: fl.append(f)
    bmesh.ops.reverse_faces(bm,faces=fl); bm.to_mesh(me); bm.free()
recalc(oskull); recalc(ohat)
for o in hair_parts+eye_objs+lash_objs: orient_out(o,C if o in eye_objs+lash_objs else CH)
# ---------------- UVs ----------------
def pl(co,du=0,dv=0): return (0.25+co.x*2.5+du,(co.z-UZ0)*2.5+dv)
SKINP=lambda co:(0.56+0.38*((co.x+0.12)/0.24),0.56+0.18*((co.z-1.36)/0.32))
me=oskull.data; uvl=me.uv_layers.new(name='UVMap')
for p in me.polygons:
    back=p.center.y>-0.03 or p.normal.y>0.35 or p.center.z>UZ0+0.195 or abs(p.center.x)>0.095
    for li in p.loop_indices:
        co=me.vertices[me.loops[li].vertex_index].co
        uvl.data[li].uv=SKINP(co) if back else pl(co)
for o in eye_objs+lash_objs:
    me=o.data; uvl=me.uv_layers.new(name='UVMap')
    for li,l in enumerate(me.loops): uvl.data[li].uv=pl(me.vertices[l.vertex_index].co)
me=ohat.data; uvl=me.uv_layers.new(name='UVMap')
for p in me.polygons:
    for li in p.loop_indices:
        co=W2L(me.vertices[me.loops[li].vertex_index].co)
        if p.index in band_idx: uvl.data[li].uv=(0.49*(0.05+0.9*(math.atan2(co.y-CC.y,co.x-CC.x)/(2*math.pi)+0.5)),0.85)
        else: uvl.data[li].uv=(0.49*min(0.98,max(0.02,(co.x-CC.x+0.25)/0.5)),min(0.70,max(0.02,((co.y-CC.y+0.25)/0.5)*0.68+0.02)))
# hair: u = lock phase (0 seam/dark .. 1 lock centre/light), v = height gradient (+ highlight band in the texture)
def hair_uv(o,ph=None):
    me=o.data; uvl=me.uv_layers.new(name='UVMap')
    for li,l in enumerate(me.loops):
        co=me.vertices[l.vertex_index].co
        g=ph[l.vertex_index] if ph else panel(az_of(co))
        uvl.data[li].uv=(0.53+0.44*g, min(0.995,max(0.005,1-(1.69-co.z)/0.27)))
for o in hair_parts:
    if o is ofringe: hair_uv(o,fr_phase)
    elif o in (ocheekL,ocheekR,oinner): hair_uv(o,[0.05]*len(o.data.vertices))
    else: hair_uv(o)
# ---------------- materials ----------------
def setmat(o,mname): o.data.materials.clear(); o.data.materials.append(MAT[mname])
for o in [oskull]+eye_objs+lash_objs: setmat(o,'M_G2_FACE')
setmat(ohat,'M_G2_HEAD')
for o in hair_parts: setmat(o,'M_G2_HAIR')
TEX=os.path.join(OUT,'tex')
for mname,fn in (('M_G2_FACE','T_G2_FACE.jpg'),('M_G2_HEAD','T_G2_HEAD.jpg')):
    for nd in MAT[mname].node_tree.nodes:
        if nd.type=='TEX_IMAGE' and os.path.exists(os.path.join(TEX,fn)): nd.image=bpy.data.images.load(os.path.join(TEX,fn),check_existing=False)
# ---------------- weights / tags ----------------
def vg(o,name): return o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
def allv(o): return list(range(len(o.data.vertices)))
for o in [oskull,ohat]+eye_objs+lash_objs+hair_parts: vg(o,'head').add(allv(o),1.0,'REPLACE')
vg(ofringe,'hair.fringe').add(allv(ofringe),1.0,'REPLACE')
vg(oback,'hair.back').add(allv(oback),1.0,'REPLACE')
vg(oskull,'_tag_skull').add(allv(oskull),1.0,'REPLACE'); vg(ohat,'_tag_hat').add(allv(ohat),1.0,'REPLACE')
for o in eye_objs: vg(o,'_tag_skull').add(allv(o),1.0,'REPLACE'); vg(o,'_tag_eyes').add(allv(o),1.0,'REPLACE')
for o in lash_objs: vg(o,'_tag_eyes').add(allv(o),1.0,'REPLACE'); vg(o,'_tag_lash').add(allv(o),1.0,'REPLACE')
for o in hair_parts:
    if o not in (ofringe,oback): vg(o,'_tag_hair_shell').add(allv(o),1.0,'REPLACE')
# ---------------- join ----------------
parts=[oskull,ohat]+eye_objs+lash_objs+hair_parts
stat={}
for o in parts:
    stat[o.name]=dict(verts=len(o.data.vertices),tris=sum(len(p.vertices)-2 for p in o.data.polygons))
    for p in o.data.polygons: p.use_smooth=True
LOG['parts']=stat; LOG['head_tris']=sum(s['tris'] for s in stat.values())
print('PARTS',json.dumps(stat)); print('HEAD_TRIS',LOG['head_tris'])
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
body.select_set(True); bpy.context.view_layer.objects.active=body
bpy.ops.object.join()
me=body.data
if 'Color' in me.color_attributes:
    for d in me.color_attributes['Color'].data: d.color=(1,1,1,1)
me.set_sharp_from_angle(angle=math.radians(50))
json.dump(dict(C=list(C),EA=list(EA)),open(os.path.join(OUT,'data','skull_frame.json'),'w'),indent=1)
json.dump(LOG,open(os.path.join(OUT,'data','build_log.json'),'w'),indent=1,default=float)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'head_hy_work.blend'))
print('DONE')
