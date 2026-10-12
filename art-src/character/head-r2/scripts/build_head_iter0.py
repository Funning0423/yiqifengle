# blender -b --python build_head.py -- <base.glb> <outdir>
# Head round r2: new skull/face, neck, stand collar, bob hair + separate bangs + separate back tips, boater hat.
# Replaces only BODY primitives with materials M_G2_FACE / M_G2_HEAD / M_G2_HAIR. Torso primitive (M_G2_BODY) untouched.
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index("--")+1:]; GLB,OUT=a[0],os.path.abspath(a[1])
TEX=os.path.join(OUT,'tex')
P=json.load(open(os.path.join(OUT,'data','params.json')))
HAT_TILT,HAT_Y,HAT_Z,HAT_BRIM=P['hat_tilt'],P['hat_y'],P['hat_z'],P['hat_brim']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
for o in list(bpy.data.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
body=bpy.data.objects['LOD0_G2_BODY']
MAT={m.name:m for m in bpy.data.materials}
C=Vector((0,0.006,1.535))     # head centre
def smooth(t): t=max(0,min(1,t)); return t*t*(3-2*t)

# ---------------- skull / face ----------------
def skull_point(u):   # u: unit vector
    ux,uy,uz=u
    ay=0.103 if uy<0 else 0.094
    x,y,z=0.078*ux, ay*uy, (0.098 if uz>0 else 0.080)*uz
    t=smooth((0.15-uz)/1.15)          # lower face factor
    x*=1-0.22*t**2.2
    if uy<0: y-=0.016*t*(-uy)          # chin forward
    else: y*=1-0.45*t                  # back of jaw into neck
    # cheek softness: slight widening at cheek height front
    ch=math.exp(-((uz+0.15)/0.25)**2)*max(0,-uy)
    x*=1+0.06*ch
    p=Vector((x,y,z))+C
    # nose
    if uy<-0.6:
        n=0.0055*math.exp(-((p.x/0.008)**2+((p.z-1.500)/0.011)**2))
        p.y-=n
    return p
def quad_sphere(cuts):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=2)
    bmesh.ops.subdivide_edges(bm,edges=bm.edges[:],cuts=cuts,use_grid_fill=True)
    for v in bm.verts: v.co=v.co.normalized()
    return bm
bm=quad_sphere(9)
for v in bm.verts: v.co=skull_point(v.co.normalized())
# drop faces fully covered by hair (top/back) to save tris
dele=[f for f in bm.faces if (f.calc_center_median()-C).normalized().z>0.72 or ((f.calc_center_median()-C).normalized().y>0.45 and f.calc_center_median().z>1.50)]
bmesh.ops.delete(bm,geom=dele,context='FACES')
skull=bpy.data.meshes.new('skull'); bm.to_mesh(skull); bm.free()
oskull=bpy.data.objects.new('N_skull',skull); bpy.context.scene.collection.objects.link(oskull)
skull_bvh=BVHTree.FromObject(oskull,bpy.context.evaluated_depsgraph_get())
def on_skull(d,off):   # point on skull along dir d from C, pushed out by off
    hit=skull_bvh.ray_cast(C,d.normalized(),1.0)
    if hit[0] is None:
        return skull_point(d.normalized())+d.normalized()*off
    return hit[0]+d.normalized()*off

# ---------------- neck ----------------
def ring_mesh(name, rings, segs, cap=False, center=(0,0)):
    """rings: list of (z, rx, ry, cy). returns object, quads between consecutive rings"""
    bm=bmesh.new(); R=[]
    for (z,rx,ry,cy) in rings:
        R.append([bm.verts.new((rx*math.sin(2*math.pi*k/segs), cy-ry*math.cos(2*math.pi*k/segs), z)) for k in range(segs)])
    for i in range(len(R)-1):
        for k in range(segs):
            bm.faces.new((R[i][k],R[i][(k+1)%segs],R[i+1][(k+1)%segs],R[i+1][k]))
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(name,me); bpy.context.scene.collection.objects.link(o); return o
oneck=ring_mesh('N_neck',[(1.380,0.035,0.035,0.004),(1.405,0.034,0.034,0.004),(1.430,0.033,0.034,0.006),(1.455,0.034,0.035,0.008),(1.480,0.036,0.037,0.010)],12)
# stand collar: outer bottom -> outer top -> rim -> inner
ocollar=ring_mesh('N_collar',[(1.392,0.061,0.056,0.001),(1.410,0.058,0.053,0.001),(1.425,0.050,0.048,0.002),(1.437,0.044,0.043,0.003),(1.437,0.040,0.040,0.004),(1.410,0.037,0.037,0.004)],16)
for o in (oneck,ocollar):
    o.data.flip_normals() if False else None
# ring_mesh winding: check outward normals later via recalc
def recalc(o, inside=False):
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
    if inside: bmesh.ops.reverse_faces(bm,faces=bm.faces[:])
    bm.to_mesh(o.data); bm.free()

# ================= r2 hair: layered bob (crown cap, inner fill, 2 side pieces, 2 temple locks, back piece, fringe) =========
CH=Vector((0,0.010,1.540))
HX,HYF,HYB,HZT,HZB=0.104,0.112,0.124,0.112,0.100
def hair_ell(az,th,extra=0.0):
    """bob envelope; az=0 front(-Y), th polar from top (deg)."""
    a=math.radians(az); t=math.radians(th)
    s=math.sin(t); c=math.cos(t)
    if th>90: s=s**0.55; z=CH.z+HZB*c
    else: z=CH.z+HZT*c
    bul=1+0.10*math.exp(-((th-108)/30)**2)          # outward bulge at cheek level (fuller bob)
    # panel lobes: 7 large locks around the head, stronger toward the ends
    lob=0.5-0.5*math.cos(math.radians(az)*7+0.6)
    bul*=1+0.028*lob*smooth((th-55)/60)
    ay=HYF if math.cos(a)>=0 else HYB
    p=Vector((HX*bul*s*math.sin(a), CH.y-ay*bul*s*math.cos(a), z))
    n=(p-CH); n.z*=0.6; n.normalize()
    return p+n*extra
def sheet(name, cols, rows, fn, close_u=False):
    """fn(i,j)->Vector ; cols x rows grid of verts ; faces between"""
    bm=bmesh.new(); G=[[bm.verts.new(fn(i,j)) for i in range(cols)] for j in range(rows)]
    nc=cols if close_u else cols-1
    for j in range(rows-1):
        for i in range(nc):
            bm.faces.new((G[j][i],G[j][(i+1)%cols],G[j+1][(i+1)%cols],G[j+1][i]))
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(name,me); bpy.context.scene.collection.objects.link(o); return o
def lerp(a,b,t): return a+(b-a)*t
def hug(az,z,off):
    """point on skull at azimuth/height + off (for strands that frame the face)"""
    a=math.radians(az); d=Vector((math.sin(a),-math.cos(a),(z-C.z)/0.085)).normalized()
    hit=skull_bvh.ray_cast(C+Vector((0,0,z-C.z)),Vector((math.sin(a),-math.cos(a),0)),0.5)
    if hit[0] is None: return None
    return hit[0]+hit[1]*off
# --- crown cap: full circle, th 0..TH_END(az); front opening limited to hairline
NL=48
def crown_end(az):
    f=math.cos(math.radians(az))
    return 50 if abs(az)<46 else (50+ (min(abs(az),70)-46)/24*32)   # 50 deg at front -> 82 at sides/back
ROWS_C=12
def crown_fn(i,j):
    az=-180+360*i/NL; th=lerp(2,crown_end(az),j/(ROWS_C-1))
    return hair_ell(az,th,0.004)
ocrown=sheet('N_hair_crown',NL,ROWS_C,crown_fn,close_u=True)
# close top with a fan
bm=bmesh.new(); bm.from_mesh(ocrown.data); bm.verts.ensure_lookup_table()
ring=[bm.verts[i] for i in range(NL)]; top=bm.verts.new(hair_ell(0,0,0.004))
for i in range(NL): bm.faces.new((top,ring[(i+1)%NL],ring[i]))
bm.to_mesh(ocrown.data); bm.free()
# --- inner fill (hidden, stops see-through between pieces), back+sides
def inner_fn(i,j):
    az=55+250*i/20; th=lerp(70,138,j/5); return hair_ell(az,th,-0.006)
oinner=sheet('N_hair_inner',21,6,inner_fn)
# --- side pieces (L/R): az 40..112, th 60..152 ; front edge hugs the cheek, ends curl in toward the chin
def side_fn(sign):
    NCs,NRs=12,13
    def fn(i,j):
        u=i/(NCs-1); tj=j/(NRs-1); az=lerp(43+28*smooth(tj*1.3),114,u)
        thend=lerp(152,146,u)+2.0*math.sin(u*math.pi*3)     # gentle wave on the bottom edge
        th=lerp(62,thend,tj)
        p=hair_ell(az,th,0.0016)
        # curl: last rows tuck inward/up (rolled edge)
        if tj>0.84:
            k=(tj-0.84)/0.16; q=(p-Vector((CH.x,CH.y,p.z))); p=Vector((CH.x,CH.y,p.z))+q*(1-0.16*k*k); p.z+=0.010*k*k
        # front edge: hug the face a little
        if u<0.25:
            h=hug(az,p.z,0.009)
            if h is not None and p.z<1.585: p=p.lerp(h,(1-u/0.25)*(0.35+0.35*smooth((tj-0.3)/0.5)))
        return Vector((sign*p.x,p.y,p.z))
    return fn,NCs,NRs
fnL,a1,b1=side_fn(1); osideL=sheet('N_hair_side_L',a1,b1,fnL)
fnR,a1,b1=side_fn(-1); osideR=sheet('N_hair_side_R',a1,b1,fnR)
# --- temple locks: thin strands in front of the side pieces, from the fringe edge down to the cheek
def temple_fn(sign):
    def fn(i,j):
        u=i/3; tj=j/8; az=lerp(44,56,u)+6*tj; th=lerp(52,128,tj)
        p=hair_ell(az,th,0.0045)
        h=hug(az,p.z,0.011)
        if h is not None: p=p.lerp(h,0.45*tj)
        w=1-0.75*tj**2                      # taper toward the tip
        if i in (0,3): pass
        return Vector((sign*p.x,p.y,p.z))
    return fn
otL=sheet('N_hair_temple_L',4,9,temple_fn(1)); otR=sheet('N_hair_temple_R',4,9,temple_fn(-1))
# taper the temple tips (pull outer columns together near the bottom)
for o in (otL,otR):
    vs=o.data.vertices
    for j in range(9):
        tj=j/8; row=[vs[j*4+i] for i in range(4)]; cen=sum((v.co for v in row),Vector())/4
        for v in row: v.co=cen+(v.co-cen)*(1-0.7*tj**1.5)
# --- back piece (hair.back): az 100..260 over the inner fill, under the side pieces; rolled inward ends
NCb,NRb=26,11
def back_fn(i,j):
    u=i/(NCb-1); az=lerp(100,260,u); tj=j/(NRb-1)
    thend=146+2.5*math.sin(u*math.pi*5)
    th=lerp(74,thend,tj)
    p=hair_ell(az,th,0.0)
    if tj>0.8:
        k=(tj-0.8)/0.2; q=(p-Vector((CH.x,CH.y,p.z))); p=Vector((CH.x,CH.y,p.z))+q*(1-0.18*k*k); p.z+=0.011*k*k
    return p
oback=sheet('N_hair_back',NCb,NRb,back_fn)
# --- fringe (hair_bangs): 4 light strands, swept toward her left (+X), gaps show the forehead
STR=[(-58,9,1.552),(-44,8,1.564),(-30,9,1.572),(-14,12,1.562),(4,11,1.560),(21,11,1.561),(38,11,1.556),(52,9,1.548)]   # (center az, half width deg, tip z)
def fringe_bottom(az):
    zs=[tz+0.010*abs((az-ac)/hw)**1.1 for ac,hw,tz in STR]
    return min(min(zs),1.588)
NCf=31; TS=[0,0.18,0.36,0.52,0.66,0.78,0.88,0.95,1.0]
def fringe_fn(i,j):
    u=i/(NCf-1); az0=lerp(-64,58,u); t=TS[j]
    ztop=hair_ell(az0,44,0)[2]; zb=fringe_bottom(az0)
    z=lerp(ztop,zb,t); az=az0+7*t**1.6
    top=hair_ell(az,44,-0.002)
    h=hug(az,z,0.0075+0.004*(1-t))
    if h is None: h=hair_ell(az,60,0)
    q=top.lerp(h,smooth(t*1.15))
    lob=max(math.exp(-((az-ac)/hw)**2) for ac,hw,tz in STR)
    return q+(q-CH).normalized()*0.0030*lob*math.sin(min(1,t*1.1)*math.pi*0.9)
ofringe=sheet('N_hair_bangs',NCf,len(TS),fringe_fn)
# cheek fill (dark, hugging the skull under the side pieces) so the 30deg game camera never sees through to the background
def cheek_fn(sign):
    def fn(i,j):
        az=lerp(58,118,i/6); z=lerp(1.585,1.455,j/6)
        h=hug(az,z,0.004)
        if h is None: h=hair_ell(az,110,-0.01)
        return Vector((sign*h.x,h.y,h.z))
    return fn
ocheekL=sheet('N_hair_cheek_L',7,7,cheek_fn(1)); ocheekR=sheet('N_hair_cheek_R',7,7,cheek_fn(-1))
hair_parts=[ocrown,oinner,osideL,osideR,otL,otR,oback,ofringe,ocheekL,ocheekR]

# ---------------- eye patches (blink via UV offset) ----------------
RECT=dict(x0=-0.057,x1=0.057,z0=1.489,z1=1.546)
def eye_patch():
    bm=bmesh.new(); NX,NZ=14,6; G=[]
    for j in range(NZ+1):
        r=[]
        for i in range(NX+1):
            x=lerp(RECT['x0'],RECT['x1'],i/NX); z=lerp(RECT['z0'],RECT['z1'],j/NZ)
            hit=skull_bvh.ray_cast(Vector((x,-0.3,z)),Vector((0,1,0)),1.0)
            if hit[0] is None: hit=skull_bvh.find_nearest(Vector((x,-0.08,z)))
            r.append(bm.verts.new(hit[0]+hit[1]*0.0018))
        G.append(r)
    for j in range(NZ):
        for i in range(NX): bm.faces.new((G[j][i],G[j][i+1],G[j+1][i+1],G[j+1][i]))
    me=bpy.data.meshes.new('eyes'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('N_eye_patch',me); bpy.context.scene.collection.objects.link(o); return o
oeyes=eye_patch()

# ---------------- hat r2 (boater): narrower thick brim drooping down, taller crown, wider band, worn back ----------------
hv=np.array([v.co[:] for o in hair_parts for v in o.data.vertices])
TILT=math.radians(HAT_TILT); Mh=Matrix.Translation((0,HAT_Y,HAT_Z))@Matrix.Rotation(-TILT,4,'X'); Mi=Mh.inverted()
loc=np.array([(Mi@Vector(p))[:] for p in hv]); sel=loc[loc[:,2]>-0.005]
HCY=(sel[:,1].max()+sel[:,1].min())/2
rx=np.abs(sel[:,0]).max()+0.003; ry=np.abs(sel[:,1]-HCY).max()+0.003; htop=loc[:,2].max()+0.007
print('HAT crown rx ry cy top',rx,ry,HCY,htop)
# tuck hair under the hat band: anything near/above the hat base plane is pulled inside the crown (hidden by the brim)
ntuck=0
for o in hair_parts:
    for v in o.data.vertices:
        l=Mi@v.co
        if l.z>-0.016:
            e=math.sqrt((l.x/rx)**2+((l.y-HCY)/ry)**2); lim=0.965 if l.z>-0.004 else 0.965+0.035*(-0.004-l.z)/0.012
            if e>lim:
                k=lim/e; l.x*=k; l.y=HCY+(l.y-HCY)*k; v.co=Mh@l; ntuck+=1
print('TUCK',ntuck)
def hat():
    bm=bmesh.new(); N=36
    def ring(z,sx,sy,droop=0):
        return [bm.verts.new(Mh@Vector((sx*math.sin(2*math.pi*k/N), HCY-sy*math.cos(2*math.pi*k/N), z-droop))) for k in range(N)]
    H=max(0.060,htop); BR=HAT_BRIM; BH=0.026
    R=[ring(H,rx*0.95,ry*0.95), ring(H-0.003,rx*0.995,ry*0.995), ring(H-0.008,rx,ry), ring(BH+0.002,rx,ry),
       ring(BH,rx+0.002,ry+0.002), ring(0.003,rx+0.002,ry+0.002), ring(0.0,rx+0.003,ry+0.003),
       ring(0.0,rx+BR*0.45,ry+BR*0.45,0.003), ring(0.0,rx+BR*0.85,ry+BR*0.85,0.008), ring(-0.002,rx+BR,ry+BR,0.011),
       ring(-0.008,rx+BR,ry+BR,0.011), ring(-0.009,rx+BR*0.85,ry+BR*0.85,0.008), ring(-0.006,rx+BR*0.45,ry+BR*0.45,0.003), ring(-0.002,rx,ry)]
    cen=bm.verts.new(Mh@Vector((0,HCY,H)))
    for k in range(N): bm.faces.new((cen,R[0][(k+1)%N],R[0][k]))
    band=set()
    for i in range(len(R)-1):
        for k in range(N):
            f=bm.faces.new((R[i][k],R[i][(k+1)%N],R[i+1][(k+1)%N],R[i+1][k]))
            if i in (3,4,5): band.add(f)
    bm.faces.index_update(); band={f.index for f in band}
    me=bpy.data.meshes.new('hat'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('N_hat',me); bpy.context.scene.collection.objects.link(o); return o,band
ohat,band=hat()

# ---------------- normals orientation ----------------
for o in (oskull,oneck,ohat): recalc(o)
def orient_out(o,flat=False):
    me=o.data; bm=bmesh.new(); bm.from_mesh(me); fl=[]
    for f in bm.faces:
        c=f.calc_center_median(); r=c-CH
        if flat: r.z=0
        if f.normal.dot(r)<0: fl.append(f)
    bmesh.ops.reverse_faces(bm,faces=fl); bm.to_mesh(me); bm.free()
for o in hair_parts: orient_out(o)
orient_out(oeyes)
me=ocollar.data; bm=bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); fl=[]
for f in bm.faces:
    c=f.calc_center_median(); r=Vector((c.x,c.y-0.003,0)); inner=(f.index>=64)
    if 48<=f.index<64:
        if f.normal.z<0: fl.append(f)
        continue
    if (f.normal.dot(r)>0)==inner: fl.append(f)
bmesh.ops.reverse_faces(bm,faces=fl); bm.to_mesh(me); bm.free()

# ---------------- UVs ----------------
def pl(co,du=0,dv=0): return (0.25+co.x*2.5+du,(co.z-1.41)*2.5+dv)
SKINP=lambda co:(0.56+0.38*((co.x+0.12)/0.24),0.56+0.18*((co.z-1.36)/0.32))
me=oskull.data; uvl=me.uv_layers.new(name='UVMap')
for p in me.polygons:
    back=p.center.y>-0.025 or p.normal.y>0.3 or p.center.z>1.612
    for li in p.loop_indices:
        co=me.vertices[me.loops[li].vertex_index].co
        uvl.data[li].uv=SKINP(co) if back else pl(co)
for o in (oneck,):
    me=o.data; uvl=me.uv_layers.new(name='UVMap')
    for li,l in enumerate(me.loops): uvl.data[li].uv=SKINP(me.vertices[l.vertex_index].co)
me=ocollar.data; uvl=me.uv_layers.new(name='UVMap')
for p in me.polygons:
    for li in p.loop_indices:
        co=me.vertices[me.loops[li].vertex_index].co
        k=math.atan2(co.x,-(co.y-0.003))/(2*math.pi)+0.5
        uvl.data[li].uv=(0.56+0.38*k, 0.81+0.13*((co.z-1.39)/0.047))
me=oeyes.data; uvl=me.uv_layers.new(name='UVMap')
for li,l in enumerate(me.loops): uvl.data[li].uv=pl(me.vertices[l.vertex_index].co)
me=ohat.data; uvl=me.uv_layers.new(name='UVMap')
for p in me.polygons:
    for li in p.loop_indices:
        co=me.vertices[me.loops[li].vertex_index].co
        if p.index in band: uvl.data[li].uv=(0.49*(0.05+0.9*(math.atan2(co.x,-co.y)/(2*math.pi)+0.5)),0.85)
        else: uvl.data[li].uv=(0.49*((co.x+0.2)/0.4),((co.y+0.2)/0.4)*0.68+0.02)
def hair_uv(o):
    me=o.data; uvl=me.uv_layers.new(name='UVMap')
    for li,l in enumerate(me.loops):
        co=me.vertices[l.vertex_index].co
        az=abs(math.degrees(math.atan2(co.x-CH.x,-(co.y-CH.y))))
        uvl.data[li].uv=(0.53+0.44*az/180, min(0.995,max(0.005,1-(1.665-co.z)/0.23)))
for o in hair_parts: hair_uv(o)

# ---------------- materials ----------------
def setmat(o,mname): o.data.materials.clear(); o.data.materials.append(MAT[mname])
for o in (oskull,oneck,ocollar,oeyes): setmat(o,'M_G2_FACE')
setmat(ohat,'M_G2_HEAD')
for o in hair_parts: setmat(o,'M_G2_HAIR')
for mname,fn in (('M_G2_FACE','T_G2_FACE.jpg'),('M_G2_HEAD','T_G2_HEAD.jpg')):
    for n in MAT[mname].node_tree.nodes:
        if n.type=='TEX_IMAGE': n.image=bpy.data.images.load(os.path.join(TEX,fn))
# hair: give the Blender material the hair strip texture too (GLB gets it via splice)
hm=MAT['M_G2_HAIR']; nt=hm.node_tree; bsdf=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'][0]
ti=nt.nodes.new('ShaderNodeTexImage'); ti.image=bpy.data.images.load(os.path.join(TEX,'T_G2_HEAD.jpg'))
bsdf.inputs['Base Color'].default_value=(1,1,1,1)
nt.links.new(ti.outputs['Color'],bsdf.inputs['Base Color'])

# ---------------- weights ----------------
def vg(o,name): return o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
def allv(o): return list(range(len(o.data.vertices)))
for o in [oskull,ohat,oeyes]+hair_parts: vg(o,'head').add(allv(o),1.0,'REPLACE')
vg(ofringe,'hair_bangs').add(allv(ofringe),1.0,'REPLACE')
vg(oback,'hair_tips_back').add(allv(oback),1.0,'REPLACE')
for o,t in ((oskull,'_tag_skull'),(oeyes,'_tag_skull'),(oeyes,'_tag_eyes'),(oneck,'_tag_neck'),(ocollar,'_tag_collar'),(ohat,'_tag_hat')): vg(o,t).add(allv(o),1.0,'REPLACE')
for o in hair_parts:
    if o not in (ofringe,oback): vg(o,'_tag_hair_shell').add(allv(o),1.0,'REPLACE')
def ramp(o, keys):
    for v in o.data.vertices:
        z=v.co.z
        if z<=keys[0][0]: w=keys[0][1]
        elif z>=keys[-1][0]: w=keys[-1][1]
        else:
            for (z0,w0),(z1,w1) in zip(keys,keys[1:]):
                if z0<=z<=z1:
                    t=(z-z0)/(z1-z0); w={b:w0.get(b,0)*(1-t)+w1.get(b,0)*t for b in set(w0)|set(w1)}; break
        for b,x in w.items():
            if x>1e-4: vg(o,b).add([v.index],x,'REPLACE')
ramp(oneck,[(1.392,{'chest':1}),(1.415,{'chest':0.4,'neck':0.6}),(1.435,{'neck':1}),(1.455,{'neck':0.5,'head':0.5}),(1.475,{'head':1})])
ramp(ocollar,[(1.395,{'chest':1}),(1.433,{'chest':0.7,'neck':0.3})])
# ---------------- remove old head parts from BODY, join ----------------
bm=bmesh.new(); bm.from_mesh(body.data)
old={'M_G2_FACE','M_G2_HEAD','M_G2_HAIR'}
mn=[m.name for m in body.data.materials]
bmesh.ops.delete(bm,geom=[f for f in bm.faces if mn[f.material_index] in old],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(body.data); bm.free()
# anime-style soft shading: skull normals from a smooth ellipsoid (no nose/jaw creases)
EA=Vector((0.080,0.100,0.135))
cn=[]
for v in oskull.data.vertices:  # (eyes get the same normals at export via _tag_skull)
    d=v.co-C; n=Vector((d.x/EA.x**2,d.y/EA.y**2,d.z/EA.z**2)).normalized()
    cn.append(n.lerp(v.normal,0.15).normalized())
oskull.data.normals_split_custom_set_from_vertices(cn)
parts=[oskull,oneck,ocollar,ohat,oeyes]+hair_parts
stat={}
for o in parts:
    bm=bmesh.new(); bm.from_mesh(o.data); stat[o.name]=dict(verts=len(bm.verts),tris=sum(len(f.verts)-2 for f in bm.faces)); bm.free()
for o in parts:
    for p in o.data.polygons: p.use_smooth=True
    # color attribute (all white, like original)
    ca=o.data.color_attributes.new('Color','FLOAT_COLOR','CORNER') if False else None
print('PARTS',json.dumps(stat))
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
body.select_set(True); bpy.context.view_layer.objects.active=body
bpy.ops.object.join()
me=body.data
# vertex colors: keep white for everything
if 'Color' in me.color_attributes:
    ca=me.color_attributes['Color']
    for d in ca.data: d.color=(1,1,1,1)
# hat: sharp brim rim, others smooth
me.set_sharp_from_angle(angle=math.radians(50))
json.dump(stat,open(os.path.join(OUT,'data','parts_stats.json'),'w'),indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'head_r2_work.blend'))
# ---------------- export primitives for splice ----------------
dg=bpy.context.evaluated_depsgraph_get()
me=body.data
me.calc_loop_triangles()
gn={g.index:g.name for g in body.vertex_groups}
JN=json.load(open(os.path.join(OUT,'data','joint_names.json')))
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
np.savez(os.path.join(OUT,'data','head_prims.npz'),**{f'{k}__{a}':v[a] for k,v in outp.items() for a in v})
# vertex group index lists for the two hair groups (glTF cannot store them)
vgi={}
for gname in ('hair_bangs','hair_tips_back'):
    gi=body.vertex_groups[gname].index
    vgi[gname]=dict(blend_vertex_count=sum(1 for v in me.vertices if any(g.group==gi for g in v.groups)))
json.dump(vgi,open(os.path.join(OUT,'data','hair_vertex_groups.json'),'w'),indent=1)
print('DONE')
