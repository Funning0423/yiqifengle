# 《咦，起风了》(b) 棋盘全屏定稿 —— Blender 4.5 headless: model + render all board sprites.
# Same recipe as T9 ui-props (work/grokbot/ui-props/src/build_props.py + render_props.py):
#   one material = M_env_palette clone, every face UV-collapsed to a palette swatch,
#   bevel modifier (angle-limited) + shade_smooth_by_angle, Cycles, sky world 0.55 + sun 2.35 from upper-left-front.
# Run: blender -b --factory-startup -P build_board.py -- <outdir> [samples] [only1,only2]
import bpy, bmesh, math, sys, os, json, random
from mathutils import Vector, Matrix
argv=sys.argv[sys.argv.index('--')+1:]
OUT=argv[0]; SAMPLES=int(argv[1]) if len(argv)>1 else 64; ONLY=set(argv[2].split(',')) if len(argv)>2 and argv[2] else None
TEX='/workspace/yiqifengle/work/grokbot/ui-props/textures'
random.seed(7)
def sw(x,row): return ((x+0.5)/256.0, 1.0-(row*16+8.5)/256.0)
SW={k:sw(*v) for k,v in dict(
 red=(30,15),red6=(20,6),orange=(220,6),leaf=(150,0),leafl=(200,0),leafd=(90,0),lime=(200,11),
 blue=(60,7),blue2=(110,7),blued=(10,7),white=(150,15),cream15=(90,15),gold=(250,10),gold2=(220,10),
 acorn=(110,10),acornl=(140,10),cap=(40,8),wood=(102,8),darkwood=(30,8),w5a=(200,5),w5b=(160,5),w5c=(230,5),
 sand=(230,1),teal=(215,9),teal2=(170,9),teal3=(245,9),tealD=(60,9),plaster=(206,4),cream=(130,4),ink=(40,14),
 moss=(110,0),moss2=(60,0),tan=(200,3),slate=(170,7),floor=(70,8),floor2=(55,8),floor3=(85,8),roof=(86,6),
 grey=(250,15),
 # receded board set (Funning: 边框和背景往后退): light, low-contrast woods
 blueL=(110,7),petal=(250,15),lidHi=(250,15),lidLo=(250,15),lidD=(200,2),
 rimL=(100,5),baseL=(60,5),lipL=(80,5),floorL=(120,3),floorL2=(110,3),floorL3=(130,3),pegL=(80,5),pegTopL=(120,5),tileL1=(85,4),tileL2=(105,4)).items()}

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
STRAW_HEX='#ce342e'   # piece-only exception (Funning): truer red, picked by deuteranopia max-min distance vs acorn/leaf
def make_straw():
    m=bpy.data.materials.new('M_piece_strawberry'); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']
    lin=lambda c:c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
    rgb=[lin(int(STRAW_HEX[i:i+2],16)/255) for i in (1,3,5)]
    b.inputs['Base Color'].default_value=(*rgb,1); b.inputs['Roughness'].default_value=0.9; b.inputs['Specular IOR Level'].default_value=0.125
    return m
MAT_STRAW=make_straw()

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

ASSETS={}   # name -> (object, camera kind)
def reg(ob,kind): ASSETS[ob.name]=(ob,kind); return ob

# ---------- v3 helpers: parametric surface + solidify (thick, bevelled low-poly shells) ----------
def surf(fn,nu,nv):
    bm=bmesh.new(); V=[[bm.verts.new(fn(i/nu,j/nv)) for j in range(nv+1)] for i in range(nu+1)]
    for i in range(nu):
        for j in range(nv): bm.faces.new((V[i][j],V[i+1][j],V[i+1][j+1],V[i][j+1]))
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5); return bm
def thick(bm,name,swatch,t=0.05,bev=0.012,mat=None):
    o=finish(bm,name,swatch,mat=mat)
    md=o.modifiers.new('sol','SOLIDIFY'); md.thickness=t; md.offset=0
    bv=o.modifiers.new('bv','BEVEL'); bv.width=bev; bv.segments=2; bv.limit_method='ANGLE'; bv.angle_limit=math.radians(40)
    dg=bpy.context.evaluated_depsgraph_get(); nm=bpy.data.meshes.new_from_object(o.evaluated_get(dg)); o.modifiers.clear(); o.data=nm
    for l in o.data.uv_layers[0].data: l.uv=SW[swatch]
    o.data.materials.clear(); o.data.materials.append(mat or MAT)
    return o
def ground(ob,z=0.0):
    zmin=min((ob.matrix_world@v.co).z for v in ob.data.vertices); ob.data.transform(Matrix.Translation((0,0,z-zmin))); return ob

# ---------- v3 leaf A: thick curled leaf, V-fold (lit / shaded halves), raised veins, stem curling on the ground ----------
def p_leaf():
    P=[]; W=0.30; LEN=0.90
    def w_(v): return W*math.sin(math.pi*min(1,max(0,v)))**0.75*(1-0.30*v)+0.010
    def C(v):   # centreline: rises, leans back a little, tip curls toward the camera (-y) and down
        return Vector((0.0, 0.14*v-0.32*v**3, 0.17+LEN*v-0.08*v**3))   # v3.1: stronger tip curl, blade lifted on its stem
    def S(u,v):
        uu=2*u-1; x=uu*w_(v); c=C(v)
        fold=-1.05*abs(x)**1.05                    # v3.1: deeper V (≈ 2×) — edges forward → V-fold: left half catches light, right half in shade
        twist=0.16*x*(0.3+v)                            # slight twist so the two halves read differently
        return (c.x+x, c.y+fold+twist, c.z+0.05*abs(x)*v)
    blade=thick(surf(S,12,14),'blade','leaf',0.10,0.016)   # v3.1: thicker → side edge reads
    P.append(blade)
    def F(u,v,off):   # point on the front surface, lifted toward the camera
        p=Vector(S(u,v)); return (p.x,p.y-off,p.z)
    P.append(finish(tube([F(0.5,v,0.072) for v in [i/12*0.94 for i in range(13)]],0.026,6,rfn=lambda t:1.0-0.75*t),'rib','lime'))
    for k in range(4):
        v0=0.16+0.17*k
        for side in (0.08,0.92):
            pts=[F(0.5+(side-0.5)*s,v0+0.13*s,0.062) for s in (0,0.35,0.7,1.0)]
            P.append(finish(tube(pts,0.013,5,rfn=lambda t:1.0-0.6*t),'vein','leafl'))
    P.append(finish(tube([(0,0.0,0.20),(0,0.03,0.12),(0.03,0.02,0.05),(0.10,-0.03,0.022),(0.20,-0.08,0.03)],0.034,6,rfn=lambda t:1-0.45*t),'stem','leafd'))   # v3.1: petiole arcs down to the ground and props the blade up
    ob=join(P,'piece_leaf',32)
    ob.data.transform(Matrix.Rotation(math.radians(-8),4,'Y'))
    return ground(ob,0.0)

# ---------- v3 leaf B (candidate): succulent rosette in a small pot ----------
def p_succulent():
    P=[]
    prof=[(0.0,0.0),(0.17,0.0),(0.19,0.02),(0.22,0.24),(0.25,0.25),(0.25,0.30),(0.0,0.30)]
    bm=bmesh.new(); rings=[]; N=10
    for (r,z) in prof: rings.append([bm.verts.new((r*math.cos(2*math.pi*k/N),r*math.sin(2*math.pi*k/N),z)) for k in range(N)])
    for i in range(len(rings)-1):
        for k in range(N): k2=(k+1)%N; bm.faces.new((rings[i][k],rings[i][k2],rings[i+1][k2],rings[i+1][k]))
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-4); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    P.append(finish(bm,'pot','tan',0.0))
    P.append(finish(xform(cyl(0.255,0.255,0.05,N),(0,0,0.285)),'potlip','plaster',0.012,1,40))
    P.append(finish(xform(cyl(0.225,0.225,0.02,N),(0,0,0.30)),'soil','floor2'))
    # rosette: 3 rings of thick pointed leaves, inner rings more upright
    for ring,(n,L,Wd,tilt,r0,sw_) in enumerate([(8,0.30,0.14,16,0.06,'leafd'),(7,0.26,0.13,38,0.04,'leaf'),(5,0.18,0.10,62,0.01,'leafl')]):
        for k in range(n):
            a=2*math.pi*(k+0.5*ring)/n
            def S(u,v,L=L,Wd=Wd):
                uu=2*u-1; w=Wd*math.sin(math.pi*min(1,v*0.92+0.08))**0.6*(1-0.55*v)
                x=uu*w; return (x, L*v, 0.06*(1-uu*uu)*math.sin(math.pi*v*0.9)+0.04*v*v)
            lf=thick(surf(S,4,6),'sl','leaf' if sw_!='leafd' else 'leaf',0.05,0.012)
            for l in lf.data.uv_layers[0].data: l.uv=SW[sw_]
            lf.data.transform(Matrix.Rotation(math.radians(tilt),4,'X'))
            lf.data.transform(Matrix.Translation((0,r0,0)))
            lf.data.transform(Matrix.Rotation(a,4,'Z'))
            lf.data.transform(Matrix.Translation((0,0,0.31)))
            P.append(lf)
    ob=join(P,'piece_leaf_B',32)
    return ground(ob,0.0)

# ---------- v3 flower: cupped petals with crease + up-curled tips, raised dome centre, sepals underneath ----------
def p_flower():
    P=[]
    for k in range(5):
        a=math.radians(90+72*k)
        def S(u,v,a=a):
            t=2*u-1; w=0.19*math.sin(math.pi*(0.12+0.88*v))**0.55*(0.55+0.45*v)
            x=t*w; r=0.05+0.36*v
            h=r*math.tan(math.radians(32))+0.09*v**2.2+1.2*(x*x)-0.035*(1-abs(t))*v   # v3.1: deeper cup, stronger spoon + crease   # cup + tip curl + spoon + crease
            return (r*math.cos(a)-x*math.sin(a), r*math.sin(a)+x*math.cos(a), h)
        P.append(thick(surf(S,6,8),'petal','petal',0.06,0.014))   # v3: lavender-white swatch: lit side still white, shade side cool grey (white clipped before)
    for k in range(5):   # sepals: small green points peeking between petals, underneath (shade)
        a=math.radians(90+36+72*k)
        sp=prism([(-0.05,0),(0,0.17),(0.05,0)],0.03)
        P.append(finish(xform(sp,(0,0,0),[('X',-62),('Z',math.degrees(a)-90)]),'sepal','leafd',0.008))
    P.append(finish(xform(cyl(0.07,0.10,0.10,8),(0,0,-0.03)),'calyx','leafd',0.012))
    dome=uvs(0.12,10,6); deform(dome,lambda c:(c.x,c.y,max(c.z,-0.01)*0.85))
    P.append(finish(xform(dome,(0,0,0.10)),'center','gold',0.0))   # v3.1: raised to clear the deeper cup
    for k in range(9):
        b=2*math.pi*k/9; P.append(finish(xform(ico(0.032,1),(0.13*math.cos(b),0.13*math.sin(b),0.125)),'stamen','gold2'))
    P.append(finish(xform(ico(0.035,1),(0,0,0.21)),'pip','gold2'))
    ob=join(P,'piece_flower',36)
    ob.data.transform(Matrix.Rotation(math.radians(12),4,'X'))   # face tips toward the 32° camera; cup side & sepals show
    return ground(ob,0.0)

# ================= PIECES (stand upright, face -Y, base at z=0, ~0.8 tall) =================
def p_strawberry():
    P=[]
    def f(c):
        t=max(0.0,min(1.0,(c.z+0.36)/0.72))  # 0 bottom..1 top
        k=0.18+0.95*math.sin(min(1,t*1.05)*math.pi*0.62)**1.15
        return (c.x*k*1.0,c.y*k*0.9,c.z*1.05)
    body=deform(uvs(0.36,9,7),f)
    P.append(finish(xform(body,(0,0,0.40)),'body','red',0.0,mat=MAT_STRAW))
    for k in range(5):
        a=math.radians(90+72*k)
        lf=prism([(-0.07,0),(0,0.2),(0.07,0)],0.03)
        P.append(finish(xform(lf,(0,0,0),[('X',-70),('Z',72*k+18)],None),'sep','leafd',0.008))
        P[-1].location=(0,0,0)
        P[-1].data.transform(Matrix.Translation((0.0,0,0.745)))
    P.append(finish(xform(cyl(0.035,0.025,0.14,6),(0,0,0.82)),'stem','leaf',0.01))
    # seeds: tiny gold facets on the front surface
    for (sx,sz) in [(-0.17,0.52),(0.0,0.56),(0.17,0.52),(-0.09,0.38),(0.09,0.38),(-0.2,0.30),(0.2,0.30),(0.0,0.22),(-0.1,0.13),(0.1,0.13),(0.0,0.42),(-0.24,0.43),(0.24,0.43)]:
        z=sz; t=max(0.0,min(1.0,(z-0.40+0.36*1.05)/(0.72*1.05))); k=0.18+0.95*math.sin(min(1,t*1.05)*math.pi*0.62)**1.15
        R=0.36*k*0.9; xx=sx
        yy=-math.sqrt(max(0.001,(R)**2*(1-( (z-0.40)/(0.378))**2 )-xx*xx*0.8))
        s=ico(0.026,0); P.append(finish(xform(s,(xx,yy*0.98,z),scale=(1,0.6,1.4)),'seed','gold'))
    return join(P,'piece_strawberry',30)
def p_blueberry():
    P=[]
    for (x,z,r,yo) in [(-0.21,0.25,0.25,0.02),(0.21,0.26,0.25,0.04),(0.0,0.55,0.255,0.09)]:
        P.append(finish(xform(ico(r,2),(x,yo,z)),'berry','blueL',0.0))
        # crown facing camera-up
        cr=prism(star_profile(5,0.085,0.045),0.04)
        cz=z+r*0.62; cy=yo-r*0.72
        P.append(finish(xform(cr,(0,0,0),[('X',-38)]),'crown','blued',0.006)); P[-1].data.transform(Matrix.Translation((x,cy,cz)))
        P.append(finish(xform(cyl(0.03,0.03,0.03,6),(0,0,0),[('X',52)]),'pit','ink')); P[-1].data.transform(Matrix.Translation((x,cy-0.012,cz+0.008)))
    lf=prism([(0,0),(0.09,0.12),(0.05,0.26),(0,0.3),(-0.05,0.26),(-0.09,0.12)],0.03)
    P.append(finish(xform(lf,(0.28,0.05,0.62),[('Y',-40),('X',-20)]),'lf','leaf',0.01))
    return join(P,'piece_blueberry',22)   # v3 (v3.1 tried 10×8 facets / lighter blue / spread: all measured worse → kept v3)   # v3: lower smoothing angle → faceted like the strawberry
def p_acorn():
    P=[]
    def f(c):
        t=max(0.0,min(1.0,(c.z+0.3)/0.6)); k=0.55+0.5*math.sin(t*math.pi*0.85)
        z=c.z*1.0; 
        if c.z<-0.18: k*=max(0.2,1-(-0.18-c.z)*2.5)
        return (c.x*k,c.y*k,z*1.05)
    body=deform(uvs(0.3,10,8),f)
    P.append(finish(xform(body,(0,0,0.33)),'body','floor3'))   # darker nut body: separates from strawberry under deuteranopia
    P.append(finish(xform(ico(0.06,1),(0,0,0.0),scale=(1,1,1.2)),'tip','cap'))
    cap=uvs(0.34,10,6); deform(cap,lambda c:(c.x,c.y,max(c.z,-0.02)*0.62))
    P.append(finish(xform(cap,(0,0,0.56)),'cap','acornl',0.0))
    # cap scales: ring of knobs
    for ring,(rr,zz,n) in enumerate([(0.33,0.555,12),(0.27,0.64,10),(0.16,0.7,7)]):
        for k in range(n):
            a=2*math.pi*(k+0.5*ring)/n
            P.append(finish(xform(ico(0.05,0),(rr*math.cos(a),rr*math.sin(a),zz)),'knob','acorn'))
    P.append(finish(tube([(0,0,0.7),(0.02,0,0.8),(0.07,0,0.86)],0.035,5),'stem','darkwood'))
    return join(P,'piece_acorn',30)
def p_shell():
    # v2 (Funning: "像珊瑚" → 规整扇贝): fan outline with regular wave-arc rim, broad radial ribs from the hinge
    # (alternating light/dark teal bands, no thin rib lines), two hinge ears at the bottom.
    P=[]; NR=7; SEG=8; RINGS=9; R0=0.46
    a0,a1=math.radians(22),math.radians(158)
    NA=NR*SEG
    bm=bmesh.new(); V={}
    def pos(i,j):
        t=i/NA; a=a0+(a1-a0)*t; s_=j/RINGS
        ph=2*math.pi*NR*t                      # one rib = one full period
        wave=0.5-0.5*math.cos(ph)              # 0 at groove, 1 at rib crest
        r=R0*s_*(0.90+0.10*math.sqrt(wave))    # rim: rounded arcs at crests, notches at grooves
        dome=0.27*math.sin(math.pi*min(1.0,s_)*0.62)
        rib=0.08*s_**0.7*wave
        return (r*math.cos(a),-(dome+rib),r*math.sin(a)*1.12)
    hinge=bm.verts.new((0,-0.01,0))
    for i in range(NA+1):
        for j in range(1,RINGS+1): V[(i,j)]=bm.verts.new(pos(i,j))
    band={}
    for i in range(NA):
        crest=((i//(SEG//2))%2==0)             # half period crest band, half groove band
        f=bm.faces.new((hinge,V[(i,1)],V[(i+1,1)])); band[f.index if f.index>=0 else len(band)]=crest
        for j in range(1,RINGS):
            bm.faces.new((V[(i,j)],V[(i,j+1)],V[(i+1,j+1)],V[(i+1,j)]))
    bm.faces.index_update()
    crest_faces=set()
    for f in bm.faces:
        c=f.calc_center_median(); a=math.atan2(c.z,c.x); t=(a-a0)/(a1-a0)
        ph=(NR*t)%1.0
        if 0.25<=ph<0.75: crest_faces.add(f.index)   # wave crest is at ph=0.5
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    for f in bm.faces:
        if f.normal.y>0: f.normal_flip()
    me=bpy.data.meshes.new('fan'); bm.to_mesh(me); bm.free()
    sh=bpy.data.objects.new('fan',me); bpy.context.collection.objects.link(sh)
    me.uv_layers.new(name='UVMap'); uv=me.uv_layers[0]
    for poly in me.polygons:
        u=SW['teal3'] if poly.index in crest_faces else SW['teal2']
        for li in poly.loop_indices: uv.data[li].uv=u
    me.materials.append(MAT)
    md=sh.modifiers.new('sol','SOLIDIFY'); md.thickness=0.05; md.offset=1
    dg=bpy.context.evaluated_depsgraph_get(); nm=bpy.data.meshes.new_from_object(sh.evaluated_get(dg)); sh.modifiers.clear(); sh.data=nm
    P.append(sh)
    # v3: back valve (mirrored, shallower, darker teal) → closed scallop with real volume, rim thickness shows from the 32° camera
    bk=sh.copy(); bk.data=sh.data.copy(); bpy.context.collection.objects.link(bk)
    bk.data.transform(Matrix.Scale(-0.55,4,(0,1,0))); bk.data.transform(Matrix.Translation((0,0.012,0)))
    for poly in bk.data.polygons: poly.flip()
    for l in bk.data.uv_layers[0].data: l.uv=SW['teal']
    P.append(bk)
    # hinge ears: two wing plates either side of the hinge + a small hinge knuckle
    for sgn in (-1,1):
        pts=[(0.03,-0.06),(0.26,-0.06),(0.24,0.03),(0.10,0.15),(0.03,0.15)]
        if sgn<0: pts=[(-x,z) for x,z in reversed(pts)]
        ear=prism(pts,0.06)
        P.append(finish(xform(ear,(0,-0.06,0.0)),'ear','teal3',0.016,2,40))
        for k in range(2):   # two little ridges on each ear
            P.append(finish(xform(box(0.012,0.02,0.10),(sgn*(0.10+0.07*k),-0.095,0.03),[('Y',sgn*-35)]),'earrib','teal2'))
    P.append(finish(xform(cyl(0.05,0.05,0.12,8),(0,-0.04,-0.03),[('Y',90)]),'knuckle','tealD',0.012))
    ob=join(P,'piece_shell',30)
    ob.data.transform(Matrix.Rotation(math.radians(-22),4,'X'))   # v3: lean back less → dome + back valve read as volume
    return ground(ob,0.0)
PIECES=[p_strawberry(),p_leaf(),p_blueberry(),p_flower(),p_acorn(),p_shell()]   # leaf B (p_succulent) rejected by Funning — kept in source, not built
for o in PIECES: reg(o,'piece')

# ================= SPECIALS (piece camera) =================
def ribbon(name,vertical=False):
    # wind ribbon band in front of the piece, inside one cell; arrowheads show the clearing direction
    P=[]; N=24; L=0.36; Wd=0.17; EL=math.radians(32)
    Y0=-0.42; Z0=(0.42*math.cos(EL)-Y0*math.sin(EL))/math.cos(EL)   # appear centred on the piece
    nrm=Vector((0,-math.cos(EL),math.sin(EL)))
    def path(t): return Vector((t*L,Y0-0.06*math.cos(t*math.pi/2),Z0+0.025*math.sin(t*math.pi*2)))
    for side,swn,off,wd in (('f','plaster',0.0,Wd),('s','teal',0.01,Wd*0.36)):
        bm=bmesh.new(); prev=None
        for i in range(N+1):
            t=-1+2*i/N; p=path(t)
            tg=(path(min(1,t+0.02))-path(max(-1,t-0.02))).normalized()
            d=tg.cross(nrm).normalized()
            v1=bm.verts.new(p+d*wd/2+nrm*off); v2=bm.verts.new(p-d*wd/2+nrm*off)
            if prev: bm.faces.new((prev[0],prev[1],v2,v1))
            prev=(v1,v2)
        bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        o=finish(bm,'rb'+side,swn); md=o.modifiers.new('sol','SOLIDIFY'); md.thickness=0.03
        dg=bpy.context.evaluated_depsgraph_get(); nm=bpy.data.meshes.new_from_object(o.evaluated_get(dg)); o.modifiers.clear(); o.data=nm
        for l in o.data.uv_layers[0].data: l.uv=SW[swn]
        o.data.materials.clear(); o.data.materials.append(MAT); P.append(o)
    for sgn in (-1,1):
        p=path(sgn*1.0)
        ar=prism([(0,0.15),(0.18,0.0),(0,-0.15),(0.04,0.0)],0.05)
        if sgn<0: xform(ar,(0,0,0),scale=(-1,1,1))
        xform(ar,(0,0,0),[('X',-32)])
        P.append(finish(xform(ar,(p.x-sgn*0.01,p.y-0.01,p.z)),'arrow','teal',0.012))
    ob=join(P,name,40)
    if vertical:
        c=Vector((0,0,0.42)); ax=nrm
        ob.data.transform(Matrix.Translation(c)@Matrix.Rotation(math.radians(90),4,ax)@Matrix.Translation(-c))
    return ob
reg(ribbon('special_line_h'),'special'); reg(ribbon('special_line_v',True),'special')
def pinwheel():
    P=[]; R=0.56
    cols=[('orange','roof'),('blue2','blued'),('plaster','cream'),('teal','teal2')]
    for k in range(4):
        a=math.radians(45+90*k); b=a+math.radians(90)
        c=Vector((0,0,0)); p1=Vector((R*math.cos(a),0,R*math.sin(a))); p2=Vector((R*0.72*math.cos(b-0.35),0,R*0.72*math.sin(b-0.35)))
        tip=Vector((R*0.95*math.cos(a+0.45),-0.16,R*0.95*math.sin(a+0.45)))
        bm=bmesh.new(); v=[bm.verts.new(x) for x in (c,p1,tip)]; bm.faces.new(v); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        P.append(finish(bm,'bl',cols[k][0]))
        bm=bmesh.new(); v=[bm.verts.new(x) for x in (c,tip,p2)]; bm.faces.new(v)
        P.append(finish(bm,'bd',cols[k][1]))
    for o in P:
        md=o.modifiers.new('sol','SOLIDIFY'); md.thickness=0.02
        dg=bpy.context.evaluated_depsgraph_get(); nm=bpy.data.meshes.new_from_object(o.evaluated_get(dg)); u=o.data.uv_layers[0].data[0].uv.copy(); o.modifiers.clear(); o.data=nm
        for l in o.data.uv_layers[0].data: l.uv=u
        o.data.materials.clear(); o.data.materials.append(MAT)
    P.append(finish(xform(cyl(0.06,0.05,0.06,8),(0,-0.05,0),[('X',90)]),'pin','plaster',0.01))
    ob=join(P,'special_bomb',20)
    ob.data.transform(Matrix.Rotation(math.radians(-32),4,'X')); ob.data.transform(Matrix.Translation((0,0.30,(0.42*math.cos(math.radians(32))-0.30*math.sin(math.radians(32)))/math.cos(math.radians(32)))))
    return ob
reg(pinwheel(),'special')

# ================= TRAY / TILES / OBSTACLES (tray camera, top-down 72°) =================
G=7; PITCH=1.0; TILE=0.90
def tile(name,swatch):
    t=finish(xform(prism(rrect(TILE,TILE,0.16,3),0.10),(0,0,0.05),[('X',90)]),name,swatch,0.035,2,40)
    # slot rim (shallow groove look): inner lighter top inset
    t2=finish(xform(prism(rrect(TILE-0.14,TILE-0.14,0.11,3),0.02),(0,0,0.105),[('X',90)]),name+'_in',swatch,0.01)
    return join([t,t2],name,40)
reg(tile('tile_a','tileL2'),'tile'); reg(tile('tile_b','tileL1'),'tile')
def tray():
    P=[]; inner=G*PITCH+0.30; OUTW=inner+0.62; rC=0.42
    # base slab (dark wood) + plank floor
    P.append(finish(xform(prism(rrect(OUTW-0.06,OUTW-0.06,rC,4),0.16),(0,0,0.0),[('X',90)]),'base','baseL',0.04,2))
    nP=8; pw=(inner+0.3)/nP
    for i in range(nP):
        x=-(inner+0.3)/2+pw*(i+0.5)
        P.append(finish(xform(box(pw-0.035,inner+0.2,0.06),(x,0,0.10+0.006*((i*37)%3))),'plank',['floorL','floorL2','floorL3','floorL'][i%4],0.012))
        # knot / grain dents
    # rim: swept rounded profile along rounded rect path
    path=[(x,z) for (x,z) in rrect(inner+0.30,inner+0.30,rC,6)]
    prof=[(-0.24,0.0),(0.28,0.0),(0.34,0.14),(0.31,0.34),(0.20,0.44),(-0.12,0.44),(-0.22,0.36),(-0.25,0.18)]
    rim=finish(sweep(path,prof),'rim','rimL',0.02,1,30)
    P.append(rim)
    # inner lip (lighter) to separate rim from floor
    P.append(finish(sweep([(x*0.985,z*0.985) for x,z in rrect(inner+0.02,inner+0.02,rC*0.7,6)],[(-0.03,0.08),(0.03,0.08),(0.03,0.16),(-0.03,0.16)]),'lip','lipL'))
    # corner pegs (dowel caps) — same darkwood as T9 signpost posts
    c=(inner+0.30)/2+0.04
    for sx,sy in ((-1,1),(1,1),(1,-1),(-1,-1)):
        P.append(finish(xform(cyl(0.17,0.17,0.10,10),(sx*c,sy*c,0.47)),'peg','pegL',0.03,2,40))
        P.append(finish(xform(cyl(0.10,0.10,0.03,10),(sx*c,sy*c,0.53)),'pegtop','pegTopL',0.01))
    return join(P,'tray',34)
reg(tray(),'trayframe')
def deco_shell():
    o=p_shell(); o.name='deco_shell'; o.data.transform(Matrix.Scale(0.62,4)); return o
def deco_star():
    st=prism(star_profile(5,0.26,0.11),0.07); o=finish(xform(st,(0,0,0.06),[('X',90)]),'deco_star_m','orange',0.03,2,40)
    for k in range(5):
        a=math.radians(90+72*k); 
        o2=finish(xform(ico(0.022,0),(0.14*math.cos(a),0.14*math.sin(a),0.10)),'dot','plaster')
    return join([o]+[x for x in bpy.data.objects if x.name.startswith('dot')],'deco_star',40)
DS=deco_shell(); reg(DS,'piece'); DST=deco_star(); reg(DST,'tile')

def moss():
    P=[]
    P.append(finish(xform(prism(rrect(TILE+0.04,TILE+0.04,0.24,3),0.08),(0,0,0.13),[('X',90)]),'mat','moss',0.035,2,40))
    rnd=random.Random(3)
    for i in range(26):
        a=rnd.random()*2*math.pi; r=0.30+rnd.random()*0.2
        x=max(-0.47,min(0.47,r*math.cos(a)*1.15)); y=max(-0.47,min(0.47,r*math.sin(a)*1.15))
        s=0.06+rnd.random()*0.07
        P.append(finish(xform(ico(s,1),(x,y,0.17),scale=(1,1,0.7)),'lump',rnd.choice(['moss','leaf','moss2','leaf'])))
    for i in range(7):
        a=rnd.random()*2*math.pi; r=0.36+rnd.random()*0.1
        P.append(finish(xform(ico(0.028,0),(r*math.cos(a),r*math.sin(a),0.24)),'fl','white'))
    return join(P,'obstacle_moss',35)
reg(moss(),'tile')
def roots():
    P=[]
    def bez(a,b,c,n=10): return [tuple((1-t)**2*a[k]+2*(1-t)*t*b[k]+t*t*c[k] for k in range(3)) for t in [i/n for i in range(n+1)]]
    P.append(finish(tube(bez((-0.48,-0.44,0.12),(-0.05,0.02,0.62),(0.47,0.44,0.14)),0.095,7,rfn=lambda t:1.05-0.35*abs(t-0.5)*2),'r1','darkwood'))
    P.append(finish(tube(bez((-0.47,0.43,0.14),(0.04,-0.02,0.58),(0.48,-0.45,0.12)),0.085,7,rfn=lambda t:1.0-0.35*abs(t-0.5)*2),'r2','wood'))
    P.append(finish(tube(bez((-0.46,-0.05,0.10),(-0.36,0.30,0.30),(-0.10,0.46,0.12)),0.05,6),'r3','darkwood'))
    P.append(finish(tube(bez((0.46,0.05,0.10),(0.36,-0.30,0.30),(0.10,-0.46,0.12)),0.05,6),'r4','wood'))
    P.append(finish(xform(ico(0.11,1),(0,0,0.60),scale=(1,1,0.8)),'knot','cap'))
    for (x,y) in [(-0.44,-0.42),(0.45,0.42),(-0.44,0.41),(0.45,-0.43)]:
        P.append(finish(xform(ico(0.075,1),(x,y,0.12)),'end','darkwood'))
    P.append(finish(xform(prism([(0,0),(0.09,0.1),(0.05,0.24),(0,0.27),(-0.05,0.24),(-0.09,0.1)],0.025),(0.05,0.02,0.66),[('X',20),('Z',30)]),'sprout','leafl',0.006))
    return join(P,'obstacle_roots',38)
reg(roots(),'tile')
def shell_lid(name,cracked):
    # v3 (PM): same scallop structure as the shell piece (broad radial ribs, regular wave-arc rim, hinge ears),
    # but a BIG greyish-pale half-shell lying dome-up over the cell and clipped by the cell edge, so only the
    # lower half shows (hinge + ears + ribs). Neutral grey (no teal) → never confused with the upright teal piece.
    NR=7; SEG=8; RINGS=12; R0=0.95; HY=-0.58; LIM=0.47
    a0,a1=math.radians(14),math.radians(166); NA=NR*SEG
    def pos(i,j):
        t=i/NA; a=a0+(a1-a0)*t; s_=j/RINGS
        wave=0.5-0.5*math.cos(2*math.pi*NR*t)
        r=R0*s_*(0.90+0.10*math.sqrt(wave))
        dome=0.30*math.sin(math.pi*min(1.0,s_)*0.62)
        return (r*math.cos(a),HY+r*math.sin(a),0.02+dome+0.075*s_**0.7*wave)
    bm=bmesh.new(); V={}
    hinge=bm.verts.new((0,HY,0.05))
    for i in range(NA+1):
        for j in range(1,RINGS+1): V[(i,j)]=bm.verts.new(pos(i,j))
    for i in range(NA):
        bm.faces.new((hinge,V[(i,1)],V[(i+1,1)]))
        for j in range(1,RINGS): bm.faces.new((V[(i,j)],V[(i+1,j)],V[(i+1,j+1)],V[(i,j+1)]))
    if cracked:   # split into three plates along two grooves, small gaps
        pass
    for co,no in (((LIM,0,0),(1,0,0)),((-LIM,0,0),(-1,0,0)),((0,-LIM,0),(0,-1,0))):
        bmesh.ops.bisect_plane(bm,geom=bm.verts[:]+bm.edges[:]+bm.faces[:],plane_co=co,plane_no=no,clear_outer=True)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    for f in bm.faces:
        if f.normal.z<0: f.normal_flip()
    me=bpy.data.meshes.new('lid'); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new('lid',me); bpy.context.collection.objects.link(o)
    me.uv_layers.new(name='UVMap'); uv=me.uv_layers[0]
    for poly in me.polygons:
        c=poly.center; a=math.atan2(c.y-HY,c.x); t=(a-a0)/(a1-a0); ph=(NR*t)%1.0
        u=SW['lidHi'] if 0.25<=ph<0.75 else SW['lidLo']
        for li in poly.loop_indices: uv.data[li].uv=u
    me.materials.append(MAT)
    md=o.modifiers.new('sol','SOLIDIFY'); md.thickness=0.05; md.offset=-1
    bv=o.modifiers.new('bv','BEVEL'); bv.width=0.012; bv.segments=2; bv.limit_method='ANGLE'
    dg=bpy.context.evaluated_depsgraph_get(); nm=bpy.data.meshes.new_from_object(o.evaluated_get(dg)); o.modifiers.clear(); o.data=nm
    P=[o]
    # hinge + ears sit below the cell edge (clipped away): only the upper half of the big shell shows
    if cracked:   # 1 layer left: two dark crack lines following grooves + a chipped rim notch
        for k,(t0) in enumerate((2.0/NR,5.0/NR)):
            a=a0+(a1-a0)*t0; pts=[]
            for j in range(3,RINGS+1):
                x,y,z=pos(int(round(t0*NA)),j)
                jit=0.025*(1 if j%2 else -1)
                x+=jit*math.sin(a); y-=jit*math.cos(a)
                if abs(x)<LIM-0.03 and y>-LIM+0.03: pts.append((x,y,z+0.03))
            if len(pts)>1: P.append(finish(tube(pts,0.016,4),'crack','ink'))
    return join(P,name,30)
reg(shell_lid('obstacle_shell_2',False),'tile'); reg(shell_lid('obstacle_shell_1',True),'tile')

# ================= HUD + TOOLS (ui camera, 3/4 front, like T9) =================
def coaster(name,R=0.5,sw_='rimL'):
    a=finish(xform(cyl(R,R*0.96,0.16,16),(0,0,0.08)),name+'_d',sw_,0.04,2,40)
    b=finish(xform(cyl(R*0.84,R*0.84,0.03,16),(0,0,0.17)),name+'_t','tileL1',0.012,1,40)
    return [a,b]
def btn_pause():
    P=[]
    P.append(finish(xform(cyl(0.5,0.5,0.16,16),(0,0,0),[('X',90)]),'disc','rimL',0.045,2,40))
    P.append(finish(xform(cyl(0.40,0.40,0.03,16),(0,-0.085,0),[('X',90)]),'face','plaster',0.012))
    for x in (-0.12,0.12):
        P.append(finish(xform(box(0.13,0.08,0.40),(x,-0.12,0)),'bar','wood',0.035,2))
    ob=join(P,'hud_pause',40); ob.data.transform(Matrix.Translation((0,0,0.5)))
    return ob
reg(btn_pause(),'ui')
def plate():
    P=[]; W,H=3.6,1.12
    P.append(finish(xform(prism(rrect(W,H,0.30,4),0.14),(0,0,0)),'board','rimL',0.03,2))
    P.append(finish(xform(prism(rrect(W-0.26,H-0.24,0.20,4),0.05),(0,-0.085,0)),'panel','plaster',0.02))
    # two little nail heads
    for x in (-W/2+0.15,W/2-0.15):
        P.append(finish(xform(cyl(0.045,0.045,0.03,8),(x,-0.075,0),[('X',90)]),'nail','pegL',0.008))
    ob=join(P,'hud_levelplate',40); return ob
reg(plate(),'plate')
def hourglass():
    P=[]
    for z in (0.0,0.62): P.append(finish(xform(cyl(0.26,0.26,0.07,8),(0,0,z)),'cap','wood',0.02))
    for k in range(3):
        a=math.radians(90+120*k); P.append(finish(xform(cyl(0.025,0.025,0.62,6),(0.2*math.cos(a),0.2*math.sin(a),0.31)),'post','darkwood'))
    gl=cyl(0.17,0.04,0.28,8); P.append(finish(xform(gl,(0,0,0.18)),'g1','teal3'))
    gl=cyl(0.04,0.17,0.28,8); P.append(finish(xform(gl,(0,0,0.45)),'g2','teal3'))
    P.append(finish(xform(cyl(0.15,0.05,0.12,8),(0,0,0.10)),'sand','sand'))
    P.append(finish(xform(cyl(0.035,0.12,0.08,8),(0,0,0.44)),'sand2','sand'))
    return join(P,'icon_moves',30)
reg(hourglass(),'ui')
def tool_star():
    P=coaster('ts')
    # v3: faceted, puffy star (front + back apex) → every arm has a lit facet and a shaded facet
    bm=bmesh.new(); ring=[]
    for k in range(10):
        a=math.radians(90+36*k); r=0.38 if k%2==0 else 0.17
        ring.append(bm.verts.new((r*math.cos(a),0,r*math.sin(a))))
    fa=bm.verts.new((0,-0.15,0)); ba=bm.verts.new((0,0.11,0))
    for k in range(10):
        bm.faces.new((ring[k],ring[(k+1)%10],fa)); bm.faces.new((ring[(k+1)%10],ring[k],ba))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    st=finish(bm,'star','gold2',0.018,2,25); st.data.transform(Matrix.Rotation(math.radians(-24),4,'Z')); st.data.transform(Matrix.Rotation(math.radians(-10),4,'X')); st.data.transform(Matrix.Translation((0,0,0.64)))
    P.append(st)
    P.append(finish(xform(cyl(0.045,0.07,0.22,8),(0,0,0.28)),'peg','acornl',0.01))
    g_=finish(xform(ico(0.075,1),(0,-0.15,0),scale=(1,0.7,1)),'gem','teal3'); g_.data.transform(Matrix.Rotation(math.radians(-24),4,'Z')); g_.data.transform(Matrix.Rotation(math.radians(-10),4,'X')); g_.data.transform(Matrix.Translation((0,0,0.64))); P.append(g_)
    return join(P,'tool_starlight',40)
def tool_bell():
    P=coaster('tb')
    prof=[(0.0,0.84),(0.11,0.83),(0.19,0.75),(0.22,0.60),(0.26,0.47),(0.33,0.39),(0.34,0.35),(0.28,0.37),(0.18,0.45),(0.0,0.47)]
    bm=bmesh.new()
    # lathe
    rings=[]
    for (r,z) in prof:
        rings.append([bm.verts.new((r*math.cos(2*math.pi*k/10),r*math.sin(2*math.pi*k/10),z)) for k in range(10)])
    for i in range(len(rings)-1):
        for k in range(10): k2=(k+1)%10; bm.faces.new((rings[i][k],rings[i][k2],rings[i+1][k2],rings[i+1][k]))
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-4); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    P.append(finish(bm,'bell','slate',0.0))
    P.append(finish(tube([(0.05*math.cos(a),0,0.86+0.05*math.sin(a)) for a in [math.radians(x) for x in range(-30,211,30)]],0.016,4),'loop','darkwood'))
    P.append(finish(xform(box(0.15,0.015,0.24),(0.0,-0.02,0.21),[('Z',0)]),'paper','plaster',0.006))
    P.append(finish(tube([(0,0,0.38),(0,-0.02,0.33)],0.008,4),'str','darkwood'))
    P.append(finish(xform(ico(0.05,1),(0,0,0.37)),'clap','gold'))
    piv=Vector((0,0,0.86)); R_=Matrix.Translation(piv)@Matrix.Rotation(math.radians(-16),4,'X')@Matrix.Rotation(math.radians(8),4,'Y')@Matrix.Translation(-piv)
    for o_ in P[2:]: o_.data.transform(R_)
    for o_ in P[2:]: o_.data.transform(Matrix.Translation((0,0,-0.03)))
    ob=join(P,'tool_windbell',35)
    # v3: swing the bell ~14° about its top loop so the dark inside of the mouth shows; coaster stays flat
    return ob
def tool_bottle():
    P=coaster('tbo')
    prof=[(0.0,0.22),(0.16,0.22),(0.25,0.28),(0.29,0.40),(0.27,0.53),(0.19,0.62),(0.09,0.67),(0.09,0.80),(0.0,0.80)]
    bm=bmesh.new(); rings=[]
    for (r,z) in prof: rings.append([bm.verts.new((r*math.cos(2*math.pi*k/10),r*math.sin(2*math.pi*k/10),z)) for k in range(10)])
    for i in range(len(rings)-1):
        for k in range(10): k2=(k+1)%10; bm.faces.new((rings[i][k],rings[i][k2],rings[i+1][k2],rings[i+1][k]))
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-4); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    P.append(finish(bm,'glass','teal3',0.0))
    P.append(finish(xform(cyl(0.27,0.24,0.16,10),(0,0,0.34)),'water','tealD',0.0))
    P.append(finish(xform(cyl(0.085,0.075,0.12,8),(0,0,0.84)),'cork','acornl',0.01))
    P.append(finish(xform(prism(star_profile(4,0.07,0.025),0.02),(0.0,-0.27,0.42)),'spark','plaster'))
    P.append(finish(tube([(0.09,0,0.74),(0.16,-0.05,0.66),(0.15,-0.08,0.58)],0.012,4),'tie','roof'))
    return join(P,'tool_tidebottle',35)
for f in (tool_star,tool_bell,tool_bottle): reg(f(),'tool')

# ======================= render =======================
sc=bpy.context.scene
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SAMPLES; sc.cycles.use_denoising=True
sc.render.film_transparent=True; sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGBA'
sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'
w=bpy.data.worlds.new('sky'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes['Background']; bg.inputs['Color'].default_value=(0.62,0.80,0.95,1); bg.inputs['Strength'].default_value=0.55
sd=bpy.data.lights.new('sun','SUN'); sd.energy=2.35; sd.angle=math.radians(8); sd.color=(1.0,0.97,0.92)
sun=bpy.data.objects.new('sun',sd); sc.collection.objects.link(sun)
sun.rotation_euler=Vector((0.55,0.6,-0.75)).normalized().to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('cam'); cd.type='ORTHO'; cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
catcher=finish(xform(box(30,30,0.01),(0,0,-0.005)),'catcher','sand'); catcher.is_shadow_catcher=True
# ---- v2 focus lighting (pieces / specials / tools): same T9 sky + key sun, plus
#  * soft-highlight material (roughness .5, specular .35) instead of fully matte
#  * key sun lights only the props (light linking) so it never throws a long shadow onto the cell;
#  * an overhead soft sun gives a real contact shadow on the shadow catcher;
#  * a weak cool back/rim sun separates silhouettes (受光面 / 背光面 / 轮廓).
def soft_mat(src,name):
    m=src.copy(); m.name=name; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value=0.36; b.inputs['Specular IOR Level'].default_value=0.7
    return m
MAT_PIECE=soft_mat(MAT,'M_env_palette_piece'); MAT_STRAW_S=soft_mat(MAT_STRAW,'M_piece_strawberry_soft')
FOCUS=('piece','special','tool')
focus=bpy.data.collections.new('focus_props'); sc.collection.children.link(focus)
for name,(ob,kind) in ASSETS.items():
    if kind in FOCUS:
        for i,m in enumerate(ob.data.materials):
            if m==MAT: ob.data.materials[i]=MAT_PIECE
            elif m==MAT_STRAW: ob.data.materials[i]=MAT_STRAW_S
        focus.objects.link(ob)
td=bpy.data.lights.new('top','SUN'); td.energy=0.8; td.angle=math.radians(26)
top=bpy.data.objects.new('top',td); sc.collection.objects.link(top); top.rotation_euler=Vector((0.08,0.18,-1)).normalized().to_track_quat('-Z','Y').to_euler()
rd=bpy.data.lights.new('rim','SUN'); rd.energy=1.1; rd.angle=math.radians(12); rd.color=(0.88,0.94,1.0)
rim=bpy.data.objects.new('rim',rd); sc.collection.objects.link(rim); rim.rotation_euler=Vector((-0.45,-0.75,-0.5)).normalized().to_track_quat('-Z','Y').to_euler()
for L_ in (sun,rim): L_.light_linking.receiver_collection=focus
CAMS={ # kind: (elevation deg, azimuth deg, ortho_scale, res, centre z)
 'piece':(32,0,1.12,192,0.42),
 'special':(32,0,1.80,308,0.42),
 'tile':(72,0,1.16,160,0.10),
 'trayframe':(72,0,8.30,0,0.10),
 'ui':(14,18,1.25,160,0.5),
 'tool':(38,0,1.25,192,0.42),
 'plate':(4,0,3.75,0,0.0),
}
os.makedirs(os.path.join(OUT,'raw'),exist_ok=True)
meta={}
for name,(ob,kind) in ASSETS.items():
    if ONLY and name not in ONLY: continue
    for n2,(o2,k2) in ASSETS.items(): o2.hide_render=(n2!=name); o2.location=(0,0,0)
    PS={'piece_leaf':1.0,'piece_leaf_B':1.12,'piece_blueberry':0.9,'piece_flower':1.16,'piece_shell':1.0}; ob.scale=(PS.get(name,1),)*3
    el,az,osc,res,cz=CAMS[kind]
    isf=kind in FOCUS
    catcher.hide_render = kind not in ('piece','tool')
    top.hide_render = not isf; rim.hide_render = not isf
    sun.light_linking.receiver_collection = focus if isf else None
    bg.inputs['Strength'].default_value = 0.22 if isf else 0.55
    sd.energy = 3.5 if isf else 2.35
    if kind=='trayframe': rx,ry=1080,int(1080*math.sin(math.radians(90-el))+1080*0)  # placeholder
    d=Vector((math.sin(math.radians(az))*math.cos(math.radians(el)),-math.cos(math.radians(az))*math.cos(math.radians(el)),math.sin(math.radians(el))))
    c=Vector((0,0,cz))
    cam.location=c+d*20; cam.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler(); cd.ortho_scale=osc
    if kind=='trayframe':
        sc.render.resolution_x=1080; sc.render.resolution_y=int(1080*math.sin(math.radians(el))+0.5)+int(1080*0.06)
        cd.sensor_fit='HORIZONTAL'
    elif kind=='plate':
        sc.render.resolution_x=808; sc.render.resolution_y=264; cd.sensor_fit='HORIZONTAL'
    else:
        sc.render.resolution_x=sc.render.resolution_y=res; cd.sensor_fit='AUTO'
    sc.render.filepath=os.path.join(OUT,'raw',name+'.png')
    bpy.ops.render.render(write_still=True)
    meta[name]={'kind':kind,'tris':sum(len(p.vertices)-2 for p in ob.data.polygons),'cam':CAMS[kind]}
json.dump(meta,open(os.path.join(OUT,'raw','meta.json'),'w'),indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'board_props.blend'),compress=True)
print('DONE',len(meta))
