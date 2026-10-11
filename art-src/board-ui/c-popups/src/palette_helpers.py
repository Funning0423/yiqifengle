TEX='/workspace/yiqifengle/work/grokbot/ui-props/textures'
random.seed(7)
def sw(x,row): return ((x+0.5)/256.0, 1.0-(row*16+8.5)/256.0)
SW={k:sw(*v) for k,v in dict(
 red=(30,15),red6=(20,6),orange=(220,6),leaf=(150,0),leafl=(200,0),leafd=(90,0),lime=(200,11),
 blue=(60,7),blue2=(110,7),blued=(10,7),white=(150,15),cream15=(90,15),gold=(250,10),gold2=(220,10),
 acorn=(110,10),acornl=(140,10),cap=(40,8),wood=(102,8),darkwood=(30,8),w5a=(200,5),w5b=(160,5),w5c=(230,5),
 sand=(230,1),teal=(215,9),teal2=(170,9),teal3=(245,9),tealD=(60,9),plaster=(206,4),cream=(130,4),ink=(40,14),
 moss=(110,0),moss2=(60,0),tan=(200,3),slate=(170,7),floor=(70,8),floor2=(55,8),floor3=(85,8),roof=(86,6),
 grey=(250,15)).items()}

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
def make_mat():
    m=bpy.data.materials.new('M_env_palette'); m.use_nodes=True
    nt=m.node_tree; b=nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(1,1,1,1); b.inputs['Roughness'].default_value=0.9; b.inputs['Metallic'].default_value=0.0
    b.inputs['Specular IOR Level'].default_value=0.125
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(os.path.join(TEX,'env_palette_256.png')); t.interpolation='Closest'
    nt.links.new(t.outputs['Color'],b.inputs['Base Color'])
    return m
MAT=make_mat()
def make_glass():
    m=bpy.data.materials.new('M_glass_preview'); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(0.55,0.82,0.80,1); b.inputs['Roughness'].default_value=0.25
    b.inputs['Alpha'].default_value=0.55; m.blend_method='BLEND' if hasattr(m,'blend_method') else None
    return m
GLASS=make_glass()

# ---------- helpers (same as T9) ----------
def finish(bm,name,swatch,bevel=0.0,seg=1,angle=35,mat=None):
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob)
    if bevel>0:
        md=ob.modifiers.new('bev','BEVEL'); md.width=bevel; md.segments=seg
        md.limit_method='ANGLE'; md.angle_limit=math.radians(angle); md.use_clamp_overlap=True
        dg=bpy.context.evaluated_depsgraph_get(); nm=bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); ob.modifiers.clear()
        old=ob.data; ob.data=nm; bpy.data.meshes.remove(old)
    me=ob.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    u=SW[swatch]
    for l in me.uv_layers[0].data: l.uv=u
    me.materials.clear(); me.materials.append(mat or MAT)
    return ob
def prism(profile,depth):
    bm=bmesh.new(); f=[]; r=[]
    for (x,z) in profile: f.append(bm.verts.new((x,-depth/2,z))); r.append(bm.verts.new((x,depth/2,z)))
    n=len(profile); bm.faces.new(f[::-1]); bm.faces.new(r)
    for i in range(n): j=(i+1)%n; bm.faces.new((f[i],f[j],r[j],r[i]))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); return bm
def rrect(w,h,r,seg=3):
    pts=[]
    for cx,cz,a0 in ((w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)):
        for k in range(seg+1):
            a=math.radians(a0+90*k/seg); pts.append((cx+r*math.cos(a),cz+r*math.sin(a)))
    return pts
def xform(bm,loc=(0,0,0),rot=None,scale=None):
    if scale: bmesh.ops.scale(bm,vec=scale,verts=bm.verts)
    if rot:
        for ax,deg in rot: bmesh.ops.rotate(bm,cent=(0,0,0),matrix=Matrix.Rotation(math.radians(deg),3,ax),verts=bm.verts)
    bmesh.ops.translate(bm,vec=loc,verts=bm.verts); return bm
def box(sx,sy,sz):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0); bmesh.ops.scale(bm,vec=(sx,sy,sz),verts=bm.verts); return bm
def cyl(r1,r2,depth,seg):
    bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=seg,radius1=r1,radius2=r2,depth=depth); return bm
def ico(r,sub=1):
    bm=bmesh.new(); bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r); return bm
def uvs(r,seg=10,rings=7):
    bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=seg,v_segments=rings,radius=r); return bm
def tube(points,radius,sides=6,closed=False,rfn=None):
    bm=bmesh.new(); rings=[]; n=len(points)
    for i,p in enumerate(points):
        p=Vector(p)
        if closed: t=(Vector(points[(i+1)%n])-Vector(points[(i-1)%n])).normalized()
        else: t=(Vector(points[min(i+1,n-1)])-Vector(points[max(i-1,0)])).normalized()
        up=Vector((0,0,1)) if abs(t.z)<0.9 else Vector((1,0,0))
        a=t.cross(up).normalized(); b=t.cross(a).normalized()
        rr=radius*(rfn(i/(n-1)) if rfn else 1)
        rings.append([bm.verts.new(p+rr*(math.cos(2*math.pi*k/sides+math.pi/sides)*a+math.sin(2*math.pi*k/sides+math.pi/sides)*b)) for k in range(sides)])
    m=n if closed else n-1
    for i in range(m):
        i2=(i+1)%n
        for k in range(sides):
            k2=(k+1)%sides; bm.faces.new((rings[i][k],rings[i][k2],rings[i2][k2],rings[i2][k]))
    if not closed: bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); return bm
def sweep(path,profile,closed=True):
    """profile: list of (u,v) — u along path-normal (in XY plane), v = up (Z). path in XY plane at z=0."""
    bm=bmesh.new(); rings=[]; n=len(path)
    for i,p in enumerate(path):
        p=Vector((p[0],p[1],0))
        t=(Vector((*path[(i+1)%n],0))-Vector((*path[(i-1)%n],0))).normalized()
        nrm=Vector((t.y,-t.x,0))
        rings.append([bm.verts.new(p+u*nrm+Vector((0,0,v))) for (u,v) in profile])
    m=len(profile)
    for i in range(n):
        i2=(i+1)%n
        for k in range(m):
            k2=(k+1)%m; bm.faces.new((rings[i][k],rings[i][k2],rings[i2][k2],rings[i2][k]))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); return bm
def star_profile(n,ro,ri,rot=90):
    return [((ro if k%2==0 else ri)*math.cos(math.radians(rot+180*k/n)),(ro if k%2==0 else ri)*math.sin(math.radians(rot+180*k/n))) for k in range(2*n)]
def deform(bm,fn):
    for v in bm.verts: v.co=Vector(fn(v.co.copy()))
    return bm
def join(parts,name,smooth=34):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join(); ob=bpy.context.active_object; ob.name=name; ob.data.name=name
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    return ob
