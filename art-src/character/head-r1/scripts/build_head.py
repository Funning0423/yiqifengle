# blender -b --python build_head.py -- <base.glb> <outdir>
# Head round r1: new skull/face, neck, stand collar, bob hair + separate bangs + separate back tips, boater hat.
# Replaces only BODY primitives with materials M_G2_FACE / M_G2_HEAD / M_G2_HAIR. Torso primitive (M_G2_BODY) untouched.
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index("--")+1:]; GLB,OUT=a[0],a[1]
TEX=os.path.join(OUT,'tex')
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
    x,y,z=0.075*ux, ay*uy, (0.098 if uz>0 else 0.086)*uz
    t=smooth((0.15-uz)/1.15)          # lower face factor
    x*=1-0.30*t**2.5
    if uy<0: y-=0.012*t*(-uy)          # chin forward
    else: y*=1-0.45*t                  # back of jaw into neck
    # cheek softness: slight widening at cheek height front
    ch=math.exp(-((uz+0.15)/0.25)**2)*max(0,-uy)
    x*=1+0.04*ch
    p=Vector((x,y,z))+C
    # nose
    if uy<-0.6:
        n=0.0032*math.exp(-((p.x/0.007)**2+((p.z-1.503)/0.010)**2))
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

# ---------------- hair shell (bob) ----------------
NLON=40
def hair_shell():
    bm=bmesh.new(); rows=[]
    # upper dome rows: polar 0..90deg (8 rows) ; then straight bob rows down to z=1.462
    pol=[math.radians(x) for x in (8,20,32,44,56,68,80,90)]
    zs=[1.522,1.505,1.488,1.474,1.462]
    top=bm.verts.new(on_skull(Vector((0,0,1)),0.009))
    def lon_dir(k,p):
        az=2*math.pi*k/NLON   # az=0 front (-Y)
        return Vector((math.sin(p)*math.sin(az), -math.sin(p)*math.cos(az), math.cos(p))),az
    for p in pol:
        r=[]
        for k in range(NLON):
            d,az=lon_dir(k,p); off=0.009+0.015*math.sin(p)**0.7   # flatter under the hat, more volume at sides
            q=on_skull(d,off)
            r.append(bm.verts.new(q))
        rows.append(r)
    eq=[v.co.copy() for v in rows[-1]]
    for i,z in enumerate(zs):
        f=(i+1)/len(zs)
        r=[]
        for k in range(NLON):
            e=eq[k]; dxy=Vector((e.x-C.x,e.y-C.y,0))
            az=2*math.pi*k/NLON; frontness=max(0,math.cos(az))
            flare=1+0.06*math.sin(f*math.pi*0.85)-0.10*f**2.5         # bulge then curl in at tips
            q=Vector((C.x,C.y,0))+dxy*flare; q.z=z+0.010*frontness*f
            r.append(bm.verts.new(q))
        rows.append(r)
    for k in range(NLON): bm.faces.new((top,rows[0][k],rows[0][(k+1)%NLON]))
    for i in range(len(rows)-1):
        for k in range(NLON):
            bm.faces.new((rows[i][k],rows[i][(k+1)%NLON],rows[i+1][(k+1)%NLON],rows[i+1][k]))
    # face opening: front sector below hairline
    dele=[]
    for fc in bm.faces:
        c=fc.calc_center_median(); d=c-C; az=math.degrees(math.atan2(d.x,-d.y))
        lim=52.0
        if abs(az)<lim and c.z<1.598: dele.append(fc)
    bmesh.ops.delete(bm,geom=dele,context='FACES')
    me=bpy.data.meshes.new('hair'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('N_hair_shell',me); bpy.context.scene.collection.objects.link(o); return o
ohair=hair_shell()

# ---------------- bangs (separate piece) ----------------
def bangs():
    bm=bmesh.new(); NC=18; NR=5
    grid=[]
    for r in range(NR+1):
        t=r/NR; row=[]
        for c in range(NC+1):
            s=c/NC*2-1                      # -1..1 across (s<0 = her right, +X is her left)
            az=math.radians(s*60)
            # bottom edge: side-swept (longer toward +X), zig-zag strands
            strand=0.004*(0.5+0.5*math.cos(c*2*math.pi/3))
            zb=1.566 - 0.010*(s+1)/2 - strand*(1-abs(s))**0.5 + 0.012*abs(s)**3
            zt=1.612
            z=zt+(zb-zt)*t
            pz=math.radians(90)-math.atan2(z-C.z,0.09)
            d=Vector((math.sin(az), -math.cos(az), (z-C.z)/0.09)).normalized()
            off=0.006+0.006*math.sin(t*math.pi)*0.6+0.004*(1-t)
            q=on_skull(d,off+0.002)
            row.append(bm.verts.new(q))
        grid.append(row)
    for r in range(NR):
        for c in range(NC):
            bm.faces.new((grid[r][c],grid[r][c+1],grid[r+1][c+1],grid[r+1][c]))
    me=bpy.data.meshes.new('bangs'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('N_hair_bangs',me); bpy.context.scene.collection.objects.link(o); return o
obangs=bangs()

# ---------------- back tips (separate piece) ----------------
def tips(shell):
    sv=[v.co for v in shell.data.vertices]
    bm=bmesh.new(); NC=24; NR=3
    a0,a1=math.radians(62),math.radians(298)   # around the back
    grid=[]
    # bottom row of shell at given az: find radius at z ~1.462
    def shell_r(az):
        best=None
        for v in sv:
            d=v-C
            if abs(v.z-1.462-0.0)<0.004+0.011*max(0,math.cos(az)):
                a=math.atan2(d.x,-d.y)%(2*math.pi)
                da=abs((a-az+math.pi)%(2*math.pi)-math.pi)
                if best is None or da<best[0]: best=(da,math.hypot(d.x,d.y))
        return best[1]
    for r in range(NR+1):
        t=r/NR; row=[]
        for c in range(NC+1):
            az=a0+(a1-a0)*c/NC
            R0=shell_r(az)
            strand=0.004*(0.5+0.5*math.cos(c*2*math.pi/3))
            ztop=1.476; zbot=1.442-strand
            z=ztop+(zbot-ztop)*t
            rr=R0*(0.975 - 0.08*t**1.5)     # tuck under, tips curl in
            row.append(bm.verts.new((C.x+rr*math.sin(az), C.y-rr*math.cos(az), z)))
        grid.append(row)
    for r in range(NR):
        for c in range(NC):
            bm.faces.new((grid[r][c],grid[r][c+1],grid[r+1][c+1],grid[r+1][c]))
    me=bpy.data.meshes.new('tips'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('N_hair_tips_back',me); bpy.context.scene.collection.objects.link(o); return o
otips=tips(ohair)
# shorten shell at the back so tips piece takes over: drop the last shell row behind
bm=bmesh.new(); bm.from_mesh(ohair.data)
dele=[f for f in bm.faces if f.calc_center_median().z<1.468 and abs(math.degrees(math.atan2(f.calc_center_median().x-C.x,-(f.calc_center_median().y-C.y))))>60]
bmesh.ops.delete(bm,geom=dele,context='FACES'); bm.to_mesh(ohair.data); bm.free()

# ---------------- hat (boater) ----------------
hv=np.array([v.co[:] for o in (ohair,obangs) for v in o.data.vertices])
TILT=math.radians(10); Z0=1.606
Mh=Matrix.Translation((0,0.010,Z0))@Matrix.Rotation(-TILT,4,'X')   # hat local -> world (front brim up)
Mi=Mh.inverted()
loc=np.array([(Mi@Vector(p))[:] for p in hv])
sel=loc[loc[:,2]>-0.012]
rx=np.abs(sel[:,0]).max()+0.005; ry=np.abs(sel[:,1]).max()+0.005; htop=sel[:,2].max()+0.008
print('HAT crown rx ry top',rx,ry,htop)
def hat():
    bm=bmesh.new(); N=32
    def ring(z,sx,sy,droop=0):
        return [bm.verts.new(Mh@Vector((sx*math.sin(2*math.pi*k/N), -sy*math.cos(2*math.pi*k/N), z-droop))) for k in range(N)]
    H=max(0.048,htop)
    BR=0.064   # brim width
    rings=[ ring(H,rx*0.97,ry*0.97), ring(H-0.004,rx,ry), ring(0.020,rx,ry), ring(0.018,rx+0.0015,ry+0.0015), ring(0.002,rx+0.0015,ry+0.0015), ring(0.0,rx,ry),
            ring(0.0,rx+BR*0.5,ry+BR*0.5,0.002), ring(0.0,rx+BR,ry+BR,0.006), ring(-0.004,rx+BR,ry+BR,0.006), ring(-0.004,rx+BR*0.5,ry+BR*0.5,0.002), ring(-0.004,rx,ry)]
    cen=bm.verts.new(Mh@Vector((0,0,H)))
    for k in range(N): bm.faces.new((cen,rings[0][(k+1)%N],rings[0][k]))
    band=set()
    for i in range(len(rings)-1):
        for k in range(N):
            f=bm.faces.new((rings[i][k],rings[i][(k+1)%N],rings[i+1][(k+1)%N],rings[i+1][k]))
            if i in (2,3,4): band.add(f)
    bm.faces.index_update(); band={f.index for f in band}
    me=bpy.data.meshes.new('hat'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('N_hat',me); bpy.context.scene.collection.objects.link(o); return o,band
ohat,band=hat()
for o,inside in ((oskull,False),(oneck,False),(ocollar,False),(ohair,False),(obangs,False),(otips,False),(ohat,False)):
    recalc(o)
# collar & bangs/tips are open sheets: recalc may guess; force outward by dot with radial direction
def orient_out(o,center_axis=True):
    me=o.data; flip=[]
    for p in me.polygons:
        c=p.center; r=Vector((c.x-C.x,c.y-C.y,(c.z-C.z) if not center_axis else 0))
        flip.append(p.normal.dot(r)<0)
    bm=bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    bmesh.ops.reverse_faces(bm,faces=[bm.faces[i] for i,f in enumerate(flip) if f]); bm.to_mesh(me); bm.free()
orient_out(obangs,False); orient_out(otips,True); orient_out(ohair,False)
# collar: outer wall faces out, inner wall faces in -> recalc on open tube unreliable; set by ring order: faces 0..47 outer, 64..79 inner
me=ocollar.data; bm=bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
fl=[]
for f in bm.faces:
    c=f.calc_center_median(); r=Vector((c.x,c.y-0.003,0)); inner=(f.index>=64)
    want=-1 if inner else 1
    if f.index>=48 and f.index<64: want_up=f.normal.z>0; continue
    if (f.normal.dot(r)>0)!=(want>0): fl.append(f)
bmesh.ops.reverse_faces(bm,faces=fl)
for f in bm.faces:
    if 48<=f.index<64 and f.normal.z<0: bmesh.ops.reverse_faces(bm,faces=[f])
bm.to_mesh(me); bm.free()

# ---------------- UVs ----------------
def uv_planar_face(o, skin_patch_test):
    me=o.data; uvl=me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        c=p.center
        for li in p.loop_indices:
            co=me.vertices[me.loops[li].vertex_index].co
            if skin_patch_test(p):
                uvl.data[li].uv=(0.80+0.15*((co.x+0.1)/0.2),0.05+0.2*((co.z-1.37)/0.3))
            else:
                uvl.data[li].uv=(0.375+co.x*3.75,(co.z-1.41)*4.0)
uv_planar_face(oskull, lambda p: p.center.y>-0.025 or p.normal.y>0.3)
uv_planar_face(oneck, lambda p: True)
me=ocollar.data; uvl=me.uv_layers.new(name='UVMap')
for p in me.polygons:
    for li in p.loop_indices:
        co=me.vertices[me.loops[li].vertex_index].co
        k=math.atan2(co.x,-(co.y-0.003))/(2*math.pi)+0.5
        uvl.data[li].uv=(0.80+0.18*k, 0.45+0.15*((co.z-1.39)/0.045))
me=ohat.data; uvl=me.uv_layers.new(name='UVMap')
for p in me.polygons:
    for li in p.loop_indices:
        co=me.vertices[me.loops[li].vertex_index].co
        if p.index in band: uvl.data[li].uv=(0.1+0.8*(math.atan2(co.x,-co.y)/(2*math.pi)+0.5),0.875)
        else: uvl.data[li].uv=(((co.x+0.2)/0.4)*0.98,((co.y+0.2)/0.4)*0.72+0.02)
for o in (ohair,obangs,otips):
    me=o.data; uvl=me.uv_layers.new(name='UVMap')
    for li,l in enumerate(me.loops):
        co=me.vertices[l.vertex_index].co; uvl.data[li].uv=((co.x+0.2)/0.4,(co.z-1.4)/0.3)

# ---------------- materials ----------------
def setmat(o,mname):
    o.data.materials.clear(); o.data.materials.append(MAT[mname])
for o in (oskull,oneck,ocollar): setmat(o,'M_G2_FACE')
setmat(ohat,'M_G2_HEAD')
for o in (ohair,obangs,otips): setmat(o,'M_G2_HAIR')
# swap images (Blender preview); real GLB gets the jpgs via splice
for mname,fn in (('M_G2_FACE','T_G2_FACE.jpg'),('M_G2_HEAD','T_G2_HEAD.jpg')):
    for n in MAT[mname].node_tree.nodes:
        if n.type=='TEX_IMAGE': n.image=bpy.data.images.load(os.path.join(TEX,fn))

# ---------------- weights ----------------
def vg(o,name): return o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
def weight_all(o,bone):
    g=vg(o,bone); g.add(list(range(len(o.data.vertices))),1.0,'REPLACE')
for o in (oskull,ohat,ohair,obangs,otips): weight_all(o,'head')
vg(oskull,'_tag_skull').add(list(range(len(oskull.data.vertices))),1.0,'REPLACE')
vg(oneck,'_tag_neck').add(list(range(len(oneck.data.vertices))),1.0,'REPLACE')
vg(ocollar,'_tag_collar').add(list(range(len(ocollar.data.vertices))),1.0,'REPLACE')
vg(ohair,'_tag_hair_shell').add(list(range(len(ohair.data.vertices))),1.0,'REPLACE')
vg(ohat,'_tag_hat').add(list(range(len(ohat.data.vertices))),1.0,'REPLACE')
vg(obangs,'hair_bangs').add(list(range(len(obangs.data.vertices))),1.0,'REPLACE')
vg(otips,'hair_tips_back').add(list(range(len(otips.data.vertices))),1.0,'REPLACE')
# skull: lower jaw/neck area blend into neck like original (head 1 above 1.455)
def ramp(o, keys):   # keys: list of (z, {bone:w}) piecewise linear
    for v in o.data.vertices:
        z=v.co.z
        if z<=keys[0][0]: w=keys[0][1]
        elif z>=keys[-1][0]: w=keys[-1][1]
        else:
            for (z0,w0),(z1,w1) in zip(keys,keys[1:]):
                if z0<=z<=z1:
                    t=(z-z0)/(z1-z0); w={b:w0.get(b,0)*(1-t)+w1.get(b,0)*t for b in set(w0)|set(w1)}; break
        for g in list(o.vertex_groups):
            if g.name in w: pass
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
for v in oskull.data.vertices:
    d=v.co-C; n=Vector((d.x/EA.x**2,d.y/EA.y**2,d.z/EA.z**2)).normalized()
    cn.append(n.lerp(v.normal,0.15).normalized())
oskull.data.normals_split_custom_set_from_vertices(cn)
parts=[oskull,oneck,ocollar,ohat,ohair,obangs,otips]
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
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'head_r1_work.blend'))
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
