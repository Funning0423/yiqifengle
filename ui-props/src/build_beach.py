# Blender 4.5 headless: low-poly beach props (palms + small animals) for the 《咦，起风了》 island.
# Reuses the helpers + M_env_palette clone from build_props.py (one material, UVs collapsed to palette swatches).
# Run: blender -b --factory-startup -P src/build_beach.py -- <ui-props dir>
import bpy, bmesh, math, sys, os, json, random
from mathutils import Vector, Matrix
OUT = sys.argv[sys.argv.index('--')+1]
src=open(os.path.join(OUT,'src','build_props.py')).read()
exec(src[:src.index('# ---------- 1) Signpost')])   # helpers, SW, MAT (and unused MAT_LAMP)
SW.update({
 'leaf':     sw(160, 0),   # #5fa046 palm frond green (island grass family)
 'leafhi':   sw(200, 0),   # #85b154 lighter frond green
 'leafdk':   sw(110, 0),   # #3b8545 frond midrib / under
 'trunk':    sw(110, 5),   # #c3aa80 palm trunk tan
 'trunkdk':  sw(70, 5),    # #b39b73 trunk ring
 'coco':     sw(60, 8),    # #79512b coconut brown
 'crab':     sw(150, 6),   # #d2692e crab orange-red (lighthouse roof family)
 'crabhi':   sw(200, 6),   # #e08239 crab claw tips lighter
 'eye':      sw(20, 14),   # #231e19 eyes
 'white':    sw(250, 4),   # #fef9ee gull body
 'grey':     sw(250, 15),  # #c8c8c6 gull wing
 'tip':      sw(120, 14),  # #3a2f26 gull wing tip
 'beak':     sw(232, 6),   # #ea9642 beak + legs
 'shell':    sw(70, 11),   # #4d793b turtle shell
 'shellhi':  sw(140, 11),  # #819f49 shell rim / plates
 'skin':     sw(200, 11),  # #b5c162 turtle skin
})
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
random.seed(7)

def sphere(r, u=8, v=6):
    bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=u,v_segments=v,radius=r); return bm
def ico(r, sub=1):
    bm=bmesh.new(); bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r); return bm
def taper_tube(pts, radii, sides=6):
    bm=bmesh.new(); rings=[]
    for i,p in enumerate(pts):
        p=Vector(p); t=(Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(i-1,0)])).normalized()
        up=Vector((0,1,0)) if abs(t.y)<0.9 else Vector((1,0,0))
        a=t.cross(up).normalized(); b=t.cross(a).normalized()
        rings.append([bm.verts.new(p+radii[i]*(math.cos(2*math.pi*k/sides)*a+math.sin(2*math.pi*k/sides)*b)) for k in range(sides)])
    for i in range(len(rings)-1):
        for k in range(sides):
            k2=(k+1)%sides; bm.faces.new((rings[i][k],rings[i][k2],rings[i+1][k2],rings[i+1][k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); return bm

# ---------------- palms ----------------
def frond(base, yaw, length, lift, droop, width, n=8):
    """V-folded serrated frond: centreline arcs up then droops; 3 verts across (edge, rib, edge)."""
    bm=bmesh.new(); d=Vector((math.cos(yaw),math.sin(yaw),0)); side=Vector((-d.y,d.x,0))
    rows=[]
    for i in range(n+1):
        t=i/n
        c=Vector(base)+d*(length*t)+Vector((0,0,lift*t-droop*t*t))
        w=width*math.sin(math.pi*min(1,t*1.15))**0.8*(1.0 if i%2==0 else 0.78)  # serration
        if i==n: w=0.0
        rib=c+Vector((0,0,width*0.18*(1-t)))
        rows.append((bm.verts.new(c+side*w), bm.verts.new(rib), bm.verts.new(c-side*w)))
    for i in range(n):
        a,b=rows[i],rows[i+1]
        bm.faces.new((a[0],a[1],b[1],b[0])); bm.faces.new((a[1],a[2],b[2],b[1]))
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5)
    return bm

def palm(name, height, lean, nfr, seed, light=False):
    random.seed(seed); P=[]
    segs=9; pts=[]; radii=[]
    for i in range(segs+1):
        t=i/segs
        pts.append((lean*height*(t**1.6), 0.0, height*t))
        radii.append(0.20*(1-0.45*t)+0.02)
    # trunk as stacked segments (alternate tan / ring tan -> reads as palm bark rings)
    for i in range(segs):
        sl=[pts[i],pts[i+1]]; rr=[radii[i]*1.03,radii[i+1]*0.97]
        P.append(finish(taper_tube(sl,rr,6),'trunk%d'%i,'trunk' if i%2==0 else 'trunkdk'))
    top=Vector(pts[-1])
    P.append(finish(xform(ico(radii[-1]*1.5,1),tuple(top)),'crown','trunkdk'))
    for k in range(nfr):
        yaw=2*math.pi*k/nfr+random.uniform(-0.2,0.2)
        L=height*random.uniform(0.42,0.52)
        sw_='leafhi' if (k%2==0)==light else 'leaf'
        P.append(finish(frond(top+Vector((0,0,0.05)),yaw,L,L*0.55,L*1.05,L*0.13),'frond%d'%k,sw_))
    for k in range(3):
        a=2*math.pi*k/3+0.5
        P.append(finish(xform(sphere(0.12,8,6),tuple(top+Vector((0.17*math.cos(a),0.17*math.sin(a),-0.16)))),'coco%d'%k,'coco'))
    ob=join(P,name); return ob

# ---------------- crab ----------------
def crab():
    P=[]
    P.append(finish(xform(sphere(0.5,10,6),(0,0,0.16),scale=(0.30,0.22,0.12)),'body','crab'))
    for s in (-1,1):
        # eye stalks + eyes
        P.append(finish(xform(cyl(0.012,0.012,0.08,4),(0.04*s,-0.06,0.25)),'stalk','crab'))
        P.append(finish(xform(sphere(0.026,6,4),(0.04*s,-0.06,0.30)),'eye','eye'))
        # arm + claw
        P.append(finish(tube([(0.12*s,-0.07,0.15),(0.19*s,-0.13,0.17),(0.20*s,-0.18,0.20)],0.022,4),'arm','crab'))
        P.append(finish(xform(sphere(0.5,10,6),(0.20*s,-0.21,0.21),scale=(0.10,0.08,0.075)),'claw','crabhi'))
        P.append(finish(xform(box(0.025,0.07,0.03),(0.18*s,-0.27,0.235),[('Z',12*s)]),'pincer','crabhi'))
        # 3 legs each side
        for j,yy in enumerate((-0.02,0.04,0.09)):
            P.append(finish(tube([(0.13*s,yy,0.13),(0.21*s,yy+0.02,0.14),(0.25*s,yy+0.03,0.0)],0.011,4),'leg','crab'))
    return join(P,'beach_crab')

# ---------------- seagull ----------------
def gull():
    P=[]; bz=0.17
    P.append(finish(xform(sphere(0.5,10,7),(0,0.02,bz),scale=(0.17,0.34,0.17),rot=[('X',-10)]),'body','white'))
    P.append(finish(xform(sphere(0.085,8,6),(0,-0.14,bz+0.13)),'head','white'))
    P.append(finish(xform(cyl(0.024,0.004,0.09,5),(0,-0.25,bz+0.12),[('X',-95)]),'beak','beak'))
    for s in (-1,1):
        P.append(finish(xform(sphere(0.016,5,4),(0.06*s,-0.19,bz+0.16)),'eye','eye'))
        # folded wing hugging the flank, grey, with a dark tip running out past the tail
        P.append(finish(xform(sphere(0.5,8,5),(0.075*s,0.07,bz+0.03),scale=(0.045,0.30,0.11),rot=[('X',6)]),'wing','grey'))
        P.append(finish(xform(sphere(0.5,6,4),(0.06*s,0.23,bz+0.0),scale=(0.03,0.13,0.035),rot=[('X',10)]),'tip','tip'))
        P.append(finish(tube([(0.04*s,-0.01,bz-0.08),(0.045*s,-0.01,0.0)],0.012,4),'leg','beak'))
        P.append(finish(xform(box(0.05,0.07,0.012),(0.045*s,-0.04,0.006)),'foot','beak'))
    P.append(finish(xform(box(0.11,0.10,0.025),(0,0.21,bz+0.02),[('X',8)]),'tail','white',0.01))
    return join(P,'beach_gull')

# ---------------- turtle ----------------
def turtle():
    P=[]
    bm=sphere(0.5,10,6)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z< -0.01],context='VERTS')
    bm.faces.new([v for v in sorted([v for v in bm.verts if abs(v.co.z)<0.02],key=lambda v: math.atan2(v.co.y,v.co.x))])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    P.append(finish(xform(bm,(0,0,0.07),scale=(0.40,0.50,0.26)),'shell','shell'))
    P.append(finish(xform(cyl(0.5,0.5,0.04,10),(0,0,0.07),scale=(0.44,0.54,1)),'rim','shellhi',0.01))
    # three raised scute bumps for a hand-made look
    for (x,y) in ((0,-0.08),(0,0.10),(0.0,0.01)):
        P.append(finish(xform(cyl(0.07,0.05,0.03,6),(x,y,0.19+0.015-abs(y)*0.25)),'scute','shellhi',0.008))
    P.append(finish(xform(sphere(0.5,8,6),(0,-0.32,0.10),scale=(0.13,0.14,0.11)),'head','skin'))
    for s in (-1,1):
        P.append(finish(xform(sphere(0.02,5,4),(0.045*s,-0.37,0.13)),'eye','eye'))
        P.append(finish(xform(sphere(0.5,6,4),(0.20*s,-0.16,0.04),scale=(0.20,0.08,0.03),rot=[('Z',-30*s)]),'fl','skin'))
        P.append(finish(xform(sphere(0.5,6,4),(0.16*s,0.20,0.035),scale=(0.12,0.07,0.03),rot=[('Z',30*s)]),'bl','skin'))
    P.append(finish(xform(cyl(0.03,0.005,0.08,4),(0,0.28,0.05),[('X',90)]),'tail','skin'))
    return join(P,'beach_turtle')

props=[palm('beach_palm_tall',4.6,0.16,8,3), palm('beach_palm_short',3.0,0.28,7,11,light=True), crab(), gull(), turtle()]
# ground + centre each mesh; lay out in the .blend
for i,ob in enumerate(props):
    vs=[v.co for v in ob.data.vertices]; mz=min(v.z for v in vs)
    if ob.name.startswith('beach_palm'): cx,cy=0,0   # keep trunk base at origin (not bbox centre)
    else: cx=(min(v.x for v in vs)+max(v.x for v in vs))/2; cy=(min(v.y for v in vs)+max(v.y for v in vs))/2
    ob.data.transform(Matrix.Translation((-cx,-cy,-mz)))
    ob.location=(i*3.0,0,0)
info={}
for ob in props:
    me=ob.data; me.calc_loop_triangles()
    vs=[v.co for v in me.vertices]; dims=[max(c[i] for c in vs)-min(c[i] for c in vs) for i in range(3)]
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
    loc=ob.location.copy(); ob.location=(0,0,0)
    common=dict(export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_texcoords=True,
        export_normals=True,export_yup=True,export_cameras=False,export_lights=False,export_animations=False)
    p=os.path.join(OUT,'beach-props','glb',ob.name+'.glb')
    bpy.ops.export_scene.gltf(filepath=p,export_image_format='NONE',export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,**common)
    p2=os.path.join(OUT,'beach-props','glb-preview',ob.name+'.glb')
    bpy.ops.export_scene.gltf(filepath=p2,export_image_format='AUTO',export_draco_mesh_compression_enable=False,**common)
    ob.location=loc
    info[ob.name]={'tris':len(me.loop_triangles),'verts':len(me.vertices),'bbox_m':[round(d,3) for d in dims],'glb_bytes':os.path.getsize(p),'preview_glb_bytes':os.path.getsize(p2)}
json.dump(info,open(os.path.join(OUT,'beach-props','beach_props_info.json'),'w'),indent=1)
print(json.dumps(info,indent=1))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'beach-props','beach_props.blend'),compress=True)
