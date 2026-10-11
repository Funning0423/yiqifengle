# Blender 4.5 headless: builds 4 low-poly UI props for 《咦，起风了》 island screen.
# All faces are UV-collapsed onto swatches of the game's own palette texture
# (env_palette_256.png, used by M_env_palette). One material, no new textures.
# Run: blender -b -P build_props.py -- <outdir>
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--')+1]
TEX = os.path.join(OUT, 'textures')

def sw(x, row):  # texel centre of palette (256x256, 16 rows of 16px) -> glTF/Blender UV
    return ((x+0.5)/256.0, 1.0-(row*16+8.5)/256.0)
# swatch = (palette x, row); see README for sampled-reference mapping
SW = {
 'plaster':  sw(206, 4),   # #f8f2e2  lighthouse cream plaster
 'cream':    sw(130, 4),   # #eee4cd  compass face (cream, a step below plaster)
 'roof':     sw(86, 6),    # #c65f2d  lighthouse roof terracotta
 'slate':    sw(170, 7),   # #6d93ba  cottage roof slate blue
 'wood':     sw(102, 8),   # #956737  door / fence wood
 'darkwood': sw(30, 8),    # #6e4826  bench / dark trim wood
 'glow':     sw(182, 13),  # #ffde99  window warm yellow (row 13 is the emissive row)
 'gold':     sw(250, 10),  # #eac777  warm yellow, non-emissive (book star)
}

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)

# ---------- material: M_env_palette clone ----------
def make_mat():
    m = bpy.data.materials.new('M_env_palette'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (1,1,1,1); b.inputs['Roughness'].default_value = 0.9; b.inputs['Metallic'].default_value = 0.0
    b.inputs['Specular IOR Level'].default_value = 0.4*0.5/0.5*0.5  # ~ specularFactor .4 -> soft
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(TEX,'env_palette_256.png')); t.interpolation='Closest'
    e = nt.nodes.new('ShaderNodeTexImage'); e.image = bpy.data.images.load(os.path.join(TEX,'env_palette_emissive_256.png')); e.interpolation='Closest'
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(e.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 1.0
    return m
MAT = make_mat()

# ---------- helpers ----------
def finish(bm, name, swatch, bevel=0.0, seg=1, angle=35, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    if bevel > 0:
        md = ob.modifiers.new('bev','BEVEL'); md.width = bevel; md.segments = seg
        md.limit_method='ANGLE'; md.angle_limit = math.radians(angle); md.harden_normals=False
        md.use_clamp_overlap = True
        dg = bpy.context.evaluated_depsgraph_get()
        nm = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); ob.modifiers.clear()
        old = ob.data; ob.data = nm; bpy.data.meshes.remove(old)
    me = ob.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    uv = me.uv_layers[0]; u = SW[swatch]
    for l in uv.data: l.uv = u
    me.materials.clear(); me.materials.append(MAT)
    return ob

def prism(profile, depth, axis='Y'):
    """profile: list of (a,b) in XZ plane; extrude along Y centred."""
    bm = bmesh.new(); f=[]; r=[]
    for (x,z) in profile:
        f.append(bm.verts.new((x,-depth/2,z))); r.append(bm.verts.new((x,depth/2,z)))
    n=len(profile)
    bm.faces.new(f[::-1] if True else f); bm.faces.new(r)
    for i in range(n):
        j=(i+1)%n; bm.faces.new((f[i],f[j],r[j],r[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def rrect(w,h,r,seg=3):
    pts=[]
    for cx,cz,a0 in ((w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)):
        for k in range(seg+1):
            a=math.radians(a0+90*k/seg); pts.append((cx+r*math.cos(a), cz+r*math.sin(a)))
    return pts

def xform(bm, loc=(0,0,0), rot=None, scale=None):
    if scale: bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    if rot:
        for ax,deg in rot: bmesh.ops.rotate(bm, cent=(0,0,0), matrix=Matrix.Rotation(math.radians(deg),3,ax), verts=bm.verts)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts); return bm

def box(sx,sy,sz):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1.0); bmesh.ops.scale(bm,vec=(sx,sy,sz),verts=bm.verts); return bm

def cyl(r1,r2,depth,seg):  # along Z, centred
    bm=bmesh.new(); bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=seg,radius1=r1,radius2=r2,depth=depth); return bm

def tube(points, radius, sides=4):
    """square/hex tube along polyline (for brackets, strap, loop)."""
    bm=bmesh.new(); rings=[]
    for i,p in enumerate(points):
        p=Vector(p)
        t=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
        up=Vector((0,1,0)) if abs(t.y)<0.9 else Vector((1,0,0))
        a=t.cross(up).normalized(); b=t.cross(a).normalized()
        ring=[]
        for k in range(sides):
            ang=2*math.pi*k/sides+math.pi/sides
            ring.append(bm.verts.new(p+radius*(math.cos(ang)*a+math.sin(ang)*b)))
        rings.append(ring)
    for i in range(len(rings)-1):
        for k in range(sides):
            k2=(k+1)%sides; bm.faces.new((rings[i][k],rings[i][k2],rings[i+1][k2],rings[i+1][k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); return bm

def star_profile(n, ro, ri, rot=90):
    pts=[]
    for k in range(2*n):
        a=math.radians(rot+180*k/n); r=ro if k%2==0 else ri; pts.append((r*math.cos(a), r*math.sin(a)))
    return pts

def join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join(); ob=bpy.context.active_object; ob.name=name; ob.data.name=name
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    # origin at bottom centre
    vs=[v.co for v in ob.data.vertices]
    mn=Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs)))
    mx=Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
    off=Vector(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))
    ob.data.transform(Matrix.Translation(-off)); ob.location=(0,0,0)
    ob['shift']=list(-off)
    return ob

# ---------- 1) Signpost ----------
def signpost():
    P=[]
    W,H,D=2.0,0.92,0.12; zc=0.98
    P.append(finish(xform(prism(rrect(W,H,0.2,3),D),(0,0,zc)),'board','wood',0.025))
    P.append(finish(xform(prism(rrect(1.62,0.6,0.13,3),0.05),(0,-D/2-0.012,zc)),'panel','plaster',0.018))
    for x in (-0.66,0.66):
        P.append(finish(xform(box(0.15,0.13,1.0),(x,0.10,0.5)),'post','darkwood',0.03))
    # left post rises above board to carry the bracket
    P.append(finish(xform(box(0.11,0.11,0.42),(-0.66,0.10,1.48)),'postTop','darkwood',0.025))
    # curled bracket: arm out to the left then a scroll curling up
    pts=[(-0.62,0.10,1.64),(-0.9,0.10,1.64),(-1.18,0.10,1.64),(-1.36,0.10,1.66)]
    cx,cz,r=-1.38,1.77,0.11
    for k in range(1,10):
        a=math.radians(-80+k*42); rr=r*(1-0.06*k)
        pts.append((cx+rr*math.cos(a),0.10,cz+rr*math.sin(a)))
    P.append(finish(tube(pts,0.03,4),'bracket','darkwood'))
    # lantern hanging beside the board (board left edge x=-1.0)
    lx,ly=-1.24,0.06
    P.append(finish(tube([(lx,0.10,1.62),(lx,ly,1.52)],0.014,4),'chain','darkwood'))
    P.append(finish(xform(cyl(0.045,0.045,0.025,6),(lx,ly,1.50),[('X',90)]),'ring','darkwood'))
    P.append(finish(xform(cyl(0.20,0.04,0.14,6),(lx,ly,1.405)),'cap','darkwood',0.015))
    P.append(finish(xform(cyl(0.18,0.18,0.04,6),(lx,ly,1.32)),'topplate','darkwood',0.012))
    P.append(finish(xform(cyl(0.145,0.145,0.34,6),(lx,ly,1.13)),'glass','glow'))
    for k in range(6):
        a=math.radians(60*k)
        P.append(finish(xform(box(0.034,0.034,0.34),(lx+0.15*math.cos(a),ly+0.15*math.sin(a),1.13),[('Z',60*k)]),'bar','darkwood'))
    P.append(finish(xform(cyl(0.17,0.13,0.06,6),(lx,ly,0.93)),'base','darkwood',0.012))
    return join(P,'ui_signpost')

# ---------- 2) Satchel ----------
def satchel():
    P=[]
    P.append(finish(xform(box(0.84,0.42,0.6),(0,0,0.3)),'body','slate',0.09,2,30))
    # flap: top lid + front drop with rounded bottom
    P.append(finish(xform(box(0.86,0.45,0.1),(0,0,0.58)),'lid','wood',0.045,2,30))
    fp=rrect(0.74,0.42,0.16,3)
    P.append(finish(xform(prism(fp,0.06),(0,-0.225,0.43)),'flap','wood',0.022))
    P.append(finish(xform(cyl(0.055,0.055,0.04,8),(0,-0.27,0.31),[('X',90)]),'button','plaster',0.012))
    # handle strap arc over the top
    arc=[(-0.32+0.64*k/8, 0.0, 0.63+0.26*math.sin(math.pi*k/8)) for k in range(9)]
    P.append(finish(tube(arc,0.035,4),'strap','wood'))
    # side buckles
    for x in (-0.32,0.32):
        P.append(finish(xform(box(0.1,0.06,0.08),(x,-0.0,0.64)),'buckle','darkwood',0.015))
    # front pocket hint (slightly raised panel below flap)
    P.append(finish(xform(prism(rrect(0.5,0.18,0.06,2),0.03),(0,-0.215,0.11)),'pocket','slate',0.01))
    return join(P,'ui_satchel')

# ---------- 3) Notebook ----------
def notebook():
    P=[]
    W,H,T=0.64,0.84,0.07
    for y in (-0.105,0.105):
        P.append(finish(xform(prism(rrect(W,H,0.06,2),T),(0,y,H/2)),'cover','roof',0.02))
    P.append(finish(xform(box(0.09,0.28,H),(-W/2+0.03,0,H/2)),'spine','roof',0.035,2))
    P.append(finish(xform(box(W-0.06,0.15,H-0.07),(0.015,0,H/2)),'pages','plaster',0.01))
    st=star_profile(5,0.17,0.075)
    P.append(finish(xform(prism(st,0.04),(0.03,-0.145,H/2+0.02)),'star','gold',0.012,1,30))
    # spine bands + bookmark ribbon
    for z in (0.14,H-0.14):
        P.append(finish(xform(box(0.11,0.3,0.035),(-W/2+0.03,0,z)),'band','darkwood',0.008))
    P.append(finish(xform(box(0.06,0.02,0.16),(0.16,0.0,-0.03+0.06)),'ribbon','slate'))
    return join(P,'ui_notebook')

# ---------- 4) Compass ----------
def compass():
    P=[]; R=0.42; zc=R+0.0
    P.append(finish(xform(cyl(R,R,0.16,16),(0,0,zc),[('X',90)]),'rim','plaster',0.035,1))
    P.append(finish(xform(cyl(0.34,0.34,0.03,16),(0,-0.075,zc),[('X',90)]),'face','cream'))
    # top loop + crown
    P.append(finish(xform(cyl(0.075,0.075,0.09,8),(0,0,zc+R+0.03)),'crown','plaster',0.015))
    loop=[(0.07*math.cos(math.radians(a)),0,zc+R+0.13+0.07*math.sin(math.radians(a))) for a in range(-60,241,45)]
    P.append(finish(tube(loop,0.022,4),'loop','wood'))
    # 4-point star needle: N/S long, E/W short; halves coloured
    def kite(tip, side, w, col, name):
        # flat diamond half (tip, two side points, centre) extruded
        prof=[(0,0),(w,side*0.0+w*0.0),(0,tip)]
        prof=[(-w,0),(0,tip),(w,0)] if tip>0 else [(w,0),(0,tip),(-w,0)]
        return prof
    def needle(dx,dz,length,w,col,name,y=-0.1,thick=0.035):
        # diamond pointing along (dx,dz)
        ang=math.degrees(math.atan2(dz,dx))-90
        prof=[(-w,0),(0,length),(w,0),(0,-0.0+0.0)]
        prof=[(-w,0),(0,length),(w,0)]
        bm=prism(prof,thick)
        return finish(xform(bm,(0,y,zc),[('Y',-ang)]),name,col,0.006)
    P.append(needle(0,1,0.29,0.07,'roof','n'))
    P.append(needle(0,-1,0.29,0.07,'slate','s'))
    P.append(needle(1,0,0.18,0.055,'slate','e',-0.095,0.03))
    P.append(needle(-1,0,0.18,0.055,'roof','w',-0.095,0.03))
    P.append(finish(xform(cyl(0.035,0.035,0.05,8),(0,-0.115,zc),[('X',90)]),'pin','wood'))
    for k in range(4):
        a=math.radians(45+90*k)
        P.append(finish(xform(box(0.03,0.012,0.05),(0.29*math.cos(a),-0.092,zc+0.29*math.sin(a)),[('Y',-(45+90*k)+90)]),'tick','wood'))
    ob=join(P,'ui_compass')
    ob.data.transform(Matrix.Rotation(math.radians(-8),4,'X'))  # lean back slightly
    return ob

props=[signpost(), satchel(), notebook(), compass()]
TEXT_QUAD=[(-0.72,-0.122,1.22),(0.72,-0.122,1.22),(0.72,-0.122,0.74),(-0.72,-0.122,0.74)]
# lay them out in the .blend
for i,ob in enumerate(props):
    ob.location.x = [0,-1.2,0,1.2][i]; ob.location.y = [0,-2,-2,-2][i]
# re-ground compass after lean
for ob in props:
    vs=[v.co for v in ob.data.vertices]; mz=min(v.z for v in vs)
    cx=(min(v.x for v in vs)+max(v.x for v in vs))/2; cy=(min(v.y for v in vs)+max(v.y for v in vs))/2
    ob.data.transform(Matrix.Translation((-cx,-cy,-mz)))
    sh=ob.get('shift',[0,0,0]); ob['shift']=[sh[0]-cx,sh[1]-cy,sh[2]-mz]

import json
info={}
os.makedirs(os.path.join(OUT,'glb'),exist_ok=True)
for ob in props:
    me=ob.data; me.calc_loop_triangles()
    vs=[v.co for v in me.vertices]
    dims=[max(c[i] for c in vs)-min(c[i] for c in vs) for i in range(3)]
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
    loc=ob.location.copy(); ob.location=(0,0,0)
    common=dict(export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',
        export_texcoords=True,export_normals=True,export_yup=True,export_cameras=False,export_lights=False,
        export_animations=False)
    # in-game asset: Draco (game pipeline already uses KHR_draco_mesh_compression), material named
    # M_env_palette with NO embedded image -> rebind to the existing M_env_palette in Cocos.
    p=os.path.join(OUT,'glb',ob.name+'.glb')
    bpy.ops.export_scene.gltf(filepath=p,export_image_format='NONE',export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=10,export_draco_position_quantization=14,
        export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,**common)
    # reference/preview copy: uncompressed, palette textures embedded (opens correctly in any viewer)
    os.makedirs(os.path.join(OUT,'glb-preview'),exist_ok=True)
    p2=os.path.join(OUT,'glb-preview',ob.name+'.glb')
    bpy.ops.export_scene.gltf(filepath=p2,export_image_format='AUTO',export_draco_mesh_compression_enable=False,**common)
    ob.location=loc
    info[ob.name]={'tris':len(me.loop_triangles),'verts':len(me.vertices),'bbox_m':[round(d,3) for d in dims],'glb_bytes':os.path.getsize(p),'preview_glb_bytes':os.path.getsize(p2)}
sh=props[0]['shift']; info['ui_signpost']['text_quad_local']=[[round(a+b,4) for a,b in zip(q,sh)] for q in TEXT_QUAD]
json.dump(info,open(os.path.join(OUT,'props_info.json'),'w'),indent=1)
print(json.dumps(info,indent=1))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'ui_props.blend'),compress=True)
