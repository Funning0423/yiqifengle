# Usage: blender -b -P concept.py -- autumn|snow out.png
import bpy, bmesh, math, random, sys
from mathutils import Vector, noise
argv = sys.argv[sys.argv.index('--')+1:]
MODE, OUT = argv[0], argv[1]
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.render.resolution_percentage=100
sc.eevee.taa_render_samples = 24
try: sc.eevee.use_shadows = True
except: pass
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Punchy'
except: pass
def hx(h, a=1.0):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    return (*c, a)
MATS={}
def mat(name, col, rough=0.8, emit=None, es=0.0, alpha=1.0, metal=0.0):
    k=(name)
    if k in MATS: return MATS[k]
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=hx(col); b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    if emit: b.inputs['Emission Color'].default_value=hx(emit); b.inputs['Emission Strength'].default_value=es
    if alpha<1:
        b.inputs['Alpha'].default_value=alpha
        try: m.surface_render_method='BLENDED'
        except: pass
    MATS[k]=m; return m
def link(o):
    sc.collection.objects.link(o); return o
def flat(o):
    for p in o.data.polygons: p.use_smooth=False
def add(prim, loc, scale=(1,1,1), rot=(0,0,0), m=None, **kw):
    getattr(bpy.ops.mesh, 'primitive_'+prim+'_add')(location=loc, rotation=rot, **kw)
    o=bpy.context.active_object; o.scale=scale
    if m: o.data.materials.append(m)
    return o
def blob(loc, r, sx=1, sy=1, sz=1, m=None, sub=2, amp=0.25, seed=0):
    o=add('ico_sphere', loc, (r*sx, r*sy, r*sz), m=m, subdivisions=sub)
    for v in o.data.vertices:
        d=noise.noise(v.co*1.7+Vector((seed,seed*2,0)))
        v.co*= (1+amp*d)
    flat(o); return o
def organic_ground(loc, rx, ry, m, seed=0, h=0.4, edge=m if False else None):
    # irregular island: circle with noisy radius, extruded down
    bm=bmesh.new(); n=40; vs=[]
    for i in range(n):
        a=2*math.pi*i/n
        rr=1+0.18*noise.noise(Vector((math.cos(a)*2+seed, math.sin(a)*2, seed)))+0.07*math.sin(a*5+seed)
        vs.append(bm.verts.new((math.cos(a)*rx*rr, math.sin(a)*ry*rr, 0)))
    f=bm.faces.new(vs)
    r=bmesh.ops.extrude_face_region(bm, geom=[f]); 
    top=[e for e in r['geom'] if isinstance(e,bmesh.types.BMVert)]
    for v in top: v.co.z+=h
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me=bpy.data.meshes.new('g'); bm.to_mesh(me); o=bpy.data.objects.new('ground',me); link(o)
    o.location=loc; o.data.materials.append(m); return o
def mountain(loc, r, hgt, m, mcap=None, seed=0):
    # organic massif: overlapping noisy blobs, no cones / no hard corners
    x,y,z=loc; z=z-hgt
    for k in range(4):
        f=1-k*0.22
        o=blob((x+r*0.25*noise.noise(Vector((seed,k,1))), y, z+hgt*(0.55+k*0.42)), r*f*0.75, 1.0, 0.7, hgt/r*0.9, m, sub=3, amp=0.22, seed=seed*5+k)
        if mcap and k>=2:
            o.data.materials.append(mcap)
            for p in o.data.polygons:
                if p.normal.z>0.45+0.2*noise.noise(p.center*3): p.material_index=1
def karst(loc, r, hgt, m, top, seed=0):
    x,y,z=loc
    o=blob((x,y,z+hgt*0.5), r, 1.0, 0.9, hgt/r*0.5, m, sub=3, amp=0.18, seed=seed)
    o.data.materials.append(top)
    for p in o.data.polygons:
        if p.normal.z>0.2 or noise.noise(p.center*1.5+Vector((seed,0,0)))>0.25: p.material_index=1
    return o
def cam(loc, tgt, lens):
    c=bpy.data.cameras.new('c'); c.lens=lens; o=bpy.data.objects.new('cam',c); link(o); o.location=loc
    d=Vector(tgt)-Vector(loc); o.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); sc.camera=o
def sun(rot, col, e, ang=2):
    l=bpy.data.lights.new('s','SUN'); l.energy=e; l.color=hx(col)[:3]; l.angle=math.radians(ang)
    o=bpy.data.objects.new('sun',l); link(o); o.rotation_euler=[math.radians(x) for x in rot]; return o
def point(loc, col, e, r=0.2, kind='POINT'):
    l=bpy.data.lights.new('p',kind); l.energy=e; l.color=hx(col)[:3]; l.shadow_soft_size=r
    o=bpy.data.objects.new('pl',l); link(o); o.location=loc; return o
def world(top, hor, strength=1.0):
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree
    bg=nt.nodes['Background']; tc=nt.nodes.new('ShaderNodeTexCoord'); sep=nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp=nt.nodes.new('ShaderNodeValToRGB'); nt.links.new(tc.outputs['Generated'],sep.inputs[0])
    mp=nt.nodes.new('ShaderNodeMapRange'); mp.inputs[1].default_value=0.5; mp.inputs[2].default_value=0.8
    nt.links.new(sep.outputs['Z'],mp.inputs[0]); nt.links.new(mp.outputs[0],ramp.inputs[0])
    ramp.color_ramp.elements[0].color=hx(hor); ramp.color_ramp.elements[1].color=hx(top)
    nt.links.new(ramp.outputs[0],bg.inputs[0]); bg.inputs[1].default_value=strength
def sky_plane(loc, size, top, bot, rot=(90,0,0), es=1.0):
    # gradient emissive backdrop
    o=add('plane', loc, size, rot=[math.radians(x) for x in rot])
    m=bpy.data.materials.new('sky'); m.use_nodes=True; nt=m.node_tree; nt.nodes.clear()
    out=nt.nodes.new('ShaderNodeOutputMaterial'); em=nt.nodes.new('ShaderNodeEmission'); tc=nt.nodes.new('ShaderNodeTexCoord')
    sep=nt.nodes.new('ShaderNodeSeparateXYZ'); ramp=nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['UV'],sep.inputs[0]); nt.links.new(sep.outputs['Y'],ramp.inputs[0])
    ramp.color_ramp.elements[0].color=hx(bot); ramp.color_ramp.elements[1].color=hx(top)
    nt.links.new(ramp.outputs[0],em.inputs[0]); em.inputs[1].default_value=es; nt.links.new(em.outputs[0],out.inputs[0])
    o.data.materials.append(m); return o
def shaft(p0, p1, w, col, a):
    # light shaft: thin tapered emissive transparent plane strip (cone)
    d=Vector(p1)-Vector(p0); L=d.length
    o=add('cone', (Vector(p0)+Vector(p1))/2, (1,1,1), vertices=8, depth=L, radius1=w, radius2=w*0.25,
          m=mat('shaft'+col+str(a), col, emit=col, es=1.5, alpha=a))
    o.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); return o
def tree_decid(loc, s, cols, trunk, seed):
    x,y,z=loc
    add('cylinder',(x,y,z+0.9*s),(0.12*s,0.12*s,0.9*s),m=trunk,vertices=6)
    for i,(dx,dy,dz,r) in enumerate([(0,0,2.1,0.95),(0.55,0.2,1.7,0.7),(-0.5,-0.1,1.8,0.7),(0.1,0.45,2.6,0.6),(-0.2,-0.4,2.5,0.55),(0.3,-0.3,1.5,0.5)]):
        blob((x+dx*s,y+dy*s,z+dz*s), r*s, m=cols[(i+seed)%len(cols)], sub=1, amp=0.3, seed=seed*3+i)
def tree_pine(loc, s, col, trunk, snow=None):
    x,y,z=loc
    add('cylinder',(x,y,z+0.5*s),(0.09*s,0.09*s,0.5*s),m=trunk,vertices=6)
    for i in range(4):
        r=(0.85-i*0.17)*s
        blob((x,y,z+(0.9+i*0.55)*s), r, 1, 1, 0.55, col, sub=1, amp=0.3, seed=i+int(x*7))
        if snow: blob((x,y,z+(1.12+i*0.55)*s), r*0.75, 1, 1, 0.3, snow, sub=1, amp=0.25, seed=i+int(y*5))

def grow(before, x, y, f=1.5):
    for o in sc.objects:
        if o not in before:
            o.location.x=x+(o.location.x-x)*f; o.location.y=y+(o.location.y-y)*f; o.location.z*=f
            o.scale=[c*f for c in o.scale]
def board(cx, cy, z, n, cell, cellmat_fn, gap=0.05):
    for i in range(n):
        for j in range(n):
            x=cx+(i-(n-1)/2)*cell; y=cy+(j-(n-1)/2)*cell
            cellmat_fn(i,j,x,y)

# ======================================================= AUTUMN
if MODE=='autumn':
    world('#F6A35A','#FFD9A0',0.6)
    M=dict(maple=mat('maple','#D8402A'),maple2=mat('maple2','#F06A2C'),gold=mat('gold','#F2B53A'),gold2=mat('gold2','#FFD45E'),
           larch=mat('larch','#E58F2A'),pine=mat('pine','#2F6B4A'),pineD=mat('pineD','#1F4D3B'),
           trunk=mat('trunk','#5C3B26'),grass=mat('grass','#A9BE3E'),grass2=mat('grass2','#8FA23A'),soil=mat('soil','#7A4E30'),
           rail=mat('rail','#9AA0A6',0.35,metal=0.8),sleeper=mat('sleeper','#7B5236'),ballast=mat('ballast','#8E8378'),
           stone=mat('stone','#B9A58D'),stoneD=mat('stoneD','#8C7864'),rock=mat('rock','#9A8C80'),snowcap=mat('cap','#FFF4E6'),
           mtnF=mat('mtnF','#8C5A6E'),mtnM=mat('mtnM','#A07A9A'),mtnB=mat('mtnB','#C9A3B8'),
           water=mat('water','#2BB3B8',0.08,alpha=0.85),water2=mat('water2','#5FD6C8',0.05,emit='#7FE8D8',es=0.3),
           roof=mat('roof','#B8392B'),wall=mat('wall','#FFF0D6'),wood=mat('wood','#8A5A36'),
           lamp=mat('lamp','#FFD38A',emit='#FFB45A',es=6),green=mat('sig_g','#6CFF8A',emit='#6CFF8A',es=8),
           red=mat('sig_r','#FF5A4A',emit='#FF5A4A',es=8),train=mat('train','#2E6E8E'),trainR=mat('trainR','#C93B2B'),
           cloud=mat('cloud','#FFE7D2',1.0),cloudS=mat('cloudS','#E8A2A0',1.0),leaf=mat('leafp','#E8552C'),
           acorn=mat('acorn','#A0642E'),cap=mat('acap','#6B4A33'),mush=mat('mush','#E0402E'),dot=mat('dot','#FFF6E8'),
           ticket=mat('ticket','#F4E2B0',emit='#FFE6A0',es=0.6),chest=mat('chest','#8B4F2B'),pinecone=mat('pinecone','#7A5230'),
           cellA=mat('cellA','#C98B4E'),cellB=mat('cellB','#B3753F'),fox=mat('fox','#E8762C'))
    sky_plane((0,110,20),(120,80,1),'#F08A5C','#FFD49A',es=1.2)
    # far mountains - organic peaks with snow caps (alpine)
    for i,(x,y,r,h,m) in enumerate([(-18,48,9,13,M['mtnB']),(-4,52,11,17,M['mtnB']),(12,50,9,14,M['mtnB']),(24,46,8,11,M['mtnB']),
                                     (-12,38,7,9,M['mtnM']),(6,40,8,10,M['mtnM']),(18,36,6,8,M['mtnM'])]):
        mountain((x*1.5,y*1.7,h*0.4-2),r*0.8,h*0.55,m,M['snowcap'] if h>10 else None,seed=i)
    # mid forested slopes: blobby hills covered with colored tree blobs
    for i,(x,y,r) in enumerate([(-14,26,9),(0,30,10),(14,24,9)]):
        blob((x,y,-2),r,1.3,0.9,0.55,M['grass2'],sub=3,amp=0.12,seed=i)
        for k in range(28):
            a=random.uniform(0,math.pi*2); rr=random.uniform(0,r*1.1)
            px,py=x+math.cos(a)*rr*1.2,y+math.sin(a)*rr*0.7
            pz=-2+r*0.55*math.sqrt(max(0,1-(rr/(r*1.25))**2))
            blob((px,py,pz),random.uniform(0.9,1.6),m=random.choice([M['maple'],M['gold'],M['larch'],M['pine'],M['maple2']]),sub=1,amp=0.3,seed=k)
    # stone viaduct arcs across mid valley (original curved multi-arch)
    for k in range(6):
        x=-9+k*3.4; y=19+0.12*(x**2)/3
        add('cube',(x,y,4.6),(1.7,0.6,0.35),m=M['stone'])
        p=add('cube',(x-1.5,y,1.8),(0.32,0.5,2.6),m=M['stoneD'])
        a=add('torus',(x,y,3.4),(1.15,1.0,1.1),rot=(math.radians(90),0,0),m=M['stone'],major_radius=1.0,minor_radius=0.22,major_segments=16,minor_segments=4)
    # train on viaduct
    for k,(x,mm) in enumerate([(-2,M['trainR']),(0.4,M['train']),(2.8,M['train'])]):
        y=19+0.12*(x**2)/3
        add('cube',(x,y,5.5),(1.1,0.45,0.55),m=mm); add('cube',(x,y,6.1),(1.15,0.5,0.08),m=M['wall'])
        for w in (-0.5,0,0.5): add('cube',(x+w,y-0.46,5.65),(0.17,0.02,0.15),m=M['lamp'])
    add('cylinder',(-2.7,19.3,6.3),(0.15,0.15,0.35),m=M['sleeper'])
    for k in range(5): blob((-3.0-k*0.7,19.4,6.9+k*0.35),0.3+k*0.12,m=M['cloud'],sub=1)
    # lake (jiuzhai) mid-ground turquoise, organic
    lk=organic_ground((-3,12,-0.2),6.5,2.6,M['water'],seed=3,h=0.05)
    organic_ground((-3,12,-0.3),7.2,3.0,M['water2'],seed=3,h=0.06)
    # main ground island
    g=organic_ground((0,0,-0.6),12,12,M['soil'],seed=1,h=0.5); organic_ground((0,0.3,-0.12),11.6,11.6,M['grass'],seed=1,h=0.06)
    # curved railway around board (frame) : sleepers + rails, sweeping arc
    def railpt(t):
        a=math.radians(200-220*t); return Vector((math.cos(a)*5.6, 1.8+math.sin(a)*4.6, 0.0))
    N=56
    for k in range(N):
        t=k/(N-1); p=railpt(t); q=railpt(min(1,t+0.01)); d=(q-p).normalized(); ang=math.atan2(d.y,d.x)
        s=add('cube',(p.x,p.y,0.02),(0.12,0.62,0.05),rot=(0,0,ang),m=M['sleeper'])
        add('cube',(p.x,p.y,-0.02),(0.22,0.8,0.05),rot=(0,0,ang),m=M['ballast'])
        if k%1==0:
            for off in (-0.4,0.4):
                n=Vector((-d.y,d.x,0))*off
                add('cube',(p.x+n.x,p.y+n.y,0.12),(0.2,0.04,0.05),rot=(0,0,ang),m=M['rail'])
    # signal lamps at corners
    for (x,y,m) in [(-5.2,-2.4,M['green']),(5.2,-2.4,M['red']),(-4.8,5.6,M['green']),(4.8,5.6,M['gold2'])]:
        add('cylinder',(x,y,0.7),(0.06,0.06,0.7),m=M['rail']); add('cube',(x,y,1.45),(0.16,0.12,0.28),m=M['pineD'])
        add('uv_sphere',(x,y-0.13,1.5),(0.09,0.05,0.09),m=m,segments=8,ring_count=6); point((x,y-0.4,1.5),'#FFB060',8,0.1)
    # BOARD: 7x7 leaf-carpet sleepers grid flush with ground; each cell = wooden plank tile, leaves overlapping
    n=7; cell=1.05; cx,cy=0,1.4
    for i in range(n):
        for j in range(n):
            x=cx+(i-3)*cell; y=cy+(j-3)*cell
            add('cube',(x,y,0.0),(cell*0.47,cell*0.47,0.04),rot=(0,0,random.uniform(-0.03,0.03)),m=M['cellA'] if (i+j)%2 else M['cellB'])
            for g_ in range(2):  # plank grooves
                add('cube',(x,y+(g_-0.5)*cell*0.32,0.045),(cell*0.45,0.012,0.01),m=M['soil'])
            for l in range(2):   # scattered fallen leaves on cell
                lf=add('cone',(x+random.uniform(-.35,.35),y+random.uniform(-.35,.35),0.06),(0.16,0.09,0.01),m=random.choice([M['maple'],M['gold'],M['maple2']]),vertices=5,radius1=1,radius2=0,depth=1)
                lf.rotation_euler.z=random.uniform(0,6)
    # pieces
    kinds=['acorn','maple','mush','pinecone','chestnut','ticket']
    for i in range(n):
        for j in range(n):
            x=cx+(i-3)*cell; y=cy+(j-3)*cell; k=random.choice(kinds); z=0.08; _b=set(sc.objects)
            if k=='acorn':
                blob((x,y,z+0.28),0.25,1,1,1.2,M['acorn'],sub=2,amp=0.05); add('uv_sphere',(x,y,z+0.52),(0.27,0.27,0.13),m=M['cap'],segments=10,ring_count=6)
                add('cylinder',(x,y,z+0.66),(0.03,0.03,0.07),m=M['trunk'])
            elif k=='maple':
                for a in range(5):
                    o=add('cone',(x,y,z+0.1+0.01*a),(0.16,0.4,0.03),rot=(0,0,a*2*math.pi/5),m=M['maple2'] if a%2 else M['maple'],vertices=4,radius1=1,radius2=0,depth=1)
                    o.location.x+=math.sin(-a*2*math.pi/5)*0.18; o.location.y+=math.cos(a*2*math.pi/5)*0.18
                    o.rotation_euler.x=math.radians(90)*0+0.0
            elif k=='mush':
                add('cylinder',(x,y,z+0.18),(0.1,0.1,0.18),m=M['dot']); add('uv_sphere',(x,y,z+0.38),(0.32,0.32,0.18),m=M['mush'],segments=12,ring_count=6)
                for d in range(4): add('uv_sphere',(x+0.17*math.cos(d*1.6),y+0.17*math.sin(d*1.6),z+0.47),(0.05,0.05,0.03),m=M['dot'],segments=6,ring_count=4)
            elif k=='pinecone':
                for r_ in range(4): add('cone',(x,y,z+0.12+r_*0.12),(1,1,1),rot=(0,0,r_*0.5),m=M['pinecone'],vertices=7,radius1=0.27-r_*0.05,radius2=0.05,depth=0.16)
            elif k=='chestnut':
                blob((x,y,z+0.22),0.28,1,1,0.8,M['chest'],sub=2,amp=0.06); add('uv_sphere',(x,y,z+0.06),(0.22,0.22,0.06),m=M['stone'],segments=8,ring_count=4)
            else:
                add('cube',(x,y,z+0.2),(0.36,0.22,0.03),rot=(math.radians(60),0,0.1),m=M['ticket']); add('cube',(x,y-0.02,z+0.22),(0.36,0.01,0.012),rot=(math.radians(60),0,0.1),m=M['trainR'])
            grow(_b,x,y,1.45)
    # 'dragged' piece leaf swirl demo (row 2 col 5)
    for k in range(10):
        a=k*0.7; r=0.25+k*0.06
        o=add('cone',(cx+2*cell+math.cos(a)*r,cy-1*cell+math.sin(a)*r,0.3+k*0.07),(0.13,0.08,0.01),rot=(random.uniform(0,1),random.uniform(0,1),a),m=random.choice([M['maple'],M['gold'],M['gold2']]),vertices=5,radius1=1,radius2=0,depth=1)
    # station (original small timber station) left back
    sx,sy=-7.4,7.5
    add('cube',(sx,sy,0.25),(2.2,1.2,0.25),m=M['stone'])
    add('cube',(sx,sy,1.25),(1.6,0.9,0.85),m=M['wall'])
    for d in (-1.1,-0.4,0.4,1.1): add('cube',(sx+d,sy-0.91,1.25),(0.05,0.03,0.85),m=M['wood'])
    for d in (-0.75,0.75): add('cube',(sx+d,sy-0.92,1.35),(0.25,0.02,0.32),m=M['lamp'])
    r=add('cylinder',(sx,sy,2.45),(1,1,1),rot=(0,math.radians(90),0),m=M['roof'],vertices=3,radius=1.4,depth=3.8); r.scale=(1,1.2,1)
    add('cylinder',(sx+0.9,sy,2.8),(0.18,0.18,0.5),m=M['stoneD'])
    add('cube',(sx,sy-1.0,2.0),(0.5,0.04,0.16),m=M['wood']); point((sx,sy-1.6,1.4),'#FFB45A',30,0.3)
    # bench by station
    add('cube',(sx+2.6,sy-0.6,0.45),(0.6,0.18,0.04),m=M['wood'])
    # trees around clearing (instanced style)
    cols=[M['maple'],M['maple2'],M['gold'],M['larch'],M['gold2']]
    for k,(x,y,s) in enumerate([(-9.5,2,1.2),(-8.8,-3,1.0),(8.6,0,1.3),(9.2,5.5,1.1),(6.8,8.2,1.0),(-4,9.8,0.9),(2.5,10.2,1.0),(9,-5,0.9),(-9.5,-7,1.0)]):
        tree_decid((x,y,-0.1),s,cols,M['trunk'],k)
    for (x,y) in [(-6.5,10),(7.8,10.5),(10.5,2.8),(-10.6,5.5)]:
        tree_pine((x,y,-0.1),1.3,M['pine'],M['trunk'])
    # mushrooms, rocks along ground edge
    for k in range(18):
        a=random.uniform(0,6.28); x=math.cos(a)*random.uniform(7,9.5); y=2+math.sin(a)*random.uniform(5.5,7.5)
        blob((x,y,0.1),random.uniform(0.2,0.5),1.2,1,0.6,M['rock'],sub=1,amp=0.3,seed=k)
    # squirrel on top-left signal
    blob((-4.6,5.5,2.0),0.18,m=M['fox'],sub=1); blob((-4.85,5.6,2.15),0.17,0.8,0.8,1.6,M['fox'],sub=1,amp=0.2)
    # clouds: cumulus, one blocking sun path (casts shadow stripe)
    for k,(x,y,z,s) in enumerate([(14,40,20,4),(9,38,22,3),(-12,42,19,3.5),(-18,40,17,2.5),(6,22,13,2.2)]):
        for b in range(6):
            blob((x+random.uniform(-s,s),y,z+random.uniform(-0.5,1)*s*0.4),s*random.uniform(0.5,0.9),1,0.7,0.7,M['cloud'] if b%2 else M['cloudS'],sub=2,amp=0.15,seed=k*9+b)
    # Lighting: low sun upper-right (behind-right), warm; shafts through gaps
    sun((52,0,-38),'#FFB46A',4.2,1.5)
    sun((60,0,140),'#9FB8FF',0.5,8)  # sky fill cool from left
    for k,(x) in enumerate([-2,4]):
        shaft((22,34,22),(x,12,0),0.9,'#FFC27A',0.05)
    # meadow patches for color variation
    for k in range(14):
        organic_ground((random.uniform(-9,9),random.uniform(-6,10),-0.07),random.uniform(0.8,1.8),random.uniform(0.6,1.2),random.choice([M['grass2'],M['gold'],M['larch']]),seed=k+20,h=0.02)
    cam((0,-11.5,11.5),(0,4.2,1.2),30)
# ======================================================= BAMBOO (summer, after rain)
elif MODE=='bamboo':
    world('#4FB8F0','#DDF6F0',0.8)
    M=dict(riverD=mat('riverD','#06475E',0.06),river=mat('river','#0C7480',0.05),shal=mat('shal','#2FA894',0.08),foam=mat('foam','#F0FFF8',emit='#FFFFFF',es=0.5),
           rN=mat('rN','#7E8A7A',0.9),rM=mat('rM','#93AAA6',0.9),rF=mat('rF','#B9D0D6',0.95),rS=mat('rS','#5E685C',0.9),
           gN=mat('gN','#3E9A3A'),gM=mat('gM','#6DB07E'),gF=mat('gF','#A9CFC8'),shrub=mat('shrub','#5BBE3A'),
           bam=mat('bam','#B8C94A',0.45),bamD=mat('bamD','#8AAA3A',0.5),node=mat('node','#56702A'),rope=mat('rope','#D9A860'),
           grass=mat('grass','#5CC24A'),grass2=mat('grass2','#9BDB4F'),sand=mat('sand','#E8D7A8'),
           roof=mat('roof','#4A4440'),wall=mat('wall','#F2E6CC'),wood=mat('wood','#8A5A36'),woodD=mat('woodD','#5E3C24'),
           melon=mat('melon','#E0646A'),rind=mat('rind','#2E9A3E'),seed=mat('seed','#2A1E1A'),pod=mat('pod','#C8D04A'),podH=mat('podH','#8A6A10'),
           hat=mat('hat','#F0B050'),hatB=mat('hatB','#9A6A2A'),peb=mat('peb','#4F86C8',0.4),lotus=mat('lotus','#EE8CB8'),
           dfly=mat('dfly','#8A62D0'),wing=mat('wing','#F2F8FF',0.2),cloud=mat('cloud','#FFFFFF'),cloudS=mat('cloudS','#C8DCEC'),
           buff=mat('buff','#4E4A55'),bird=mat('bird','#22262E'),skin=mat('skin','#F6CBA8'),hair=mat('hair','#2A1A14'),
           dress=mat('dress','#2F6FD8'),scarf=mat('scarf','#FF4A3A'),win=mat('win','#FFD38A',emit='#FFB45A',es=1.5))
    sky_plane((0,170,40),(200,110,1),'#0560D8','#8FE2FF',es=0.85)
    random.seed(11)
    # limestone karst peaks: dome tops, steep walls, rock striation faces, shrubs; 3 layers with mist bands between
    def vcmat(name):
        m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
        at=nt.nodes.new('ShaderNodeVertexColor'); at.layer_name='Col'; nt.links.new(at.outputs['Color'],b.inputs['Base Color'])
        b.inputs['Roughness'].default_value=0.9
        nz=nt.nodes.new('ShaderNodeTexVoronoi'); nz.inputs['Scale'].default_value=2.2; tc=nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(tc.outputs['Object'],nz.inputs['Vector'])
        bp=nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=0.45; nt.links.new(nz.outputs['Distance'],bp.inputs['Height']); nt.links.new(bp.outputs['Normal'],b.inputs['Normal'])
        return m
    PK=vcmat('peakVC')
    def peak(x,y,r,h,rockc,greenc,seed,kind):
        # original cone / hump karst: wide flared foot, tapering top; slope-based shrub vs rock colouring
        bm=bmesh.new(); NR,NS=14,14; rings=[]
        lean=random.uniform(-0.22,0.22); ex=random.uniform(0.8,1.3); pw=random.uniform(0.7,1.1)
        for k in range(NR+1):
            t=k/NR; z=-0.6+t*h
            if kind=='cone': prof=max((1-t)**pw*0.9,0.34*math.sqrt(max(0,1-t*t)))
            else: prof=math.sqrt(max(0,1-t**2.2))*(1-0.3*t)
            prof=prof*(1+0.4*max(0,0.12-t)/0.12)   # flared foot joins neighbours
            if k==NR: prof=0.06
            ring=[]
            for a_ in range(NS):
                a=2*math.pi*a_/NS
                rr=r*prof*(1+0.18*noise.noise(Vector((math.cos(a)*1.4+seed,math.sin(a)*1.4,t*3.5))))
                ring.append(bm.verts.new((x+lean*z*(t)+math.cos(a)*rr*ex,y+math.sin(a)*rr,z)))
            rings.append(ring)
        for k in range(NR):
            for a_ in range(NS): bm.faces.new((rings[k][a_],rings[k][(a_+1)%NS],rings[k+1][(a_+1)%NS],rings[k+1][a_]))
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me=bpy.data.meshes.new('pk'); bm.to_mesh(me); o=bpy.data.objects.new('peak',me); link(o)
        me.materials.append(PK)
        for p_ in me.polygons: p_.use_smooth=True
        ca=me.color_attributes.new('Col','FLOAT_COLOR','POINT')
        rc=hx(rockc); gc=hx(greenc)
        for v in me.vertices:
            n=v.normal; c=v.co
            f=(n.z-0.18)/0.3+0.9*noise.noise(Vector((c.x*0.45,c.y*0.45,c.z*0.6+seed)))
            f=max(0,min(1,f)); f=f*f*(3-2*f)
            sh=0.88+0.12*noise.noise(Vector((c.x,c.y,c.z*2)))
            ca.data[v.index].color=tuple(sh*(gc[i]*f+rc[i]*(1-f)) for i in range(3))+(1,)
        return o
    layers=[(122,'#A9BACB','#9DB7C2',11,(12,24),(4.5,7.5)),(92,'#7F8F8C','#5E9A7C',9,(10,19),(3.8,6.0)),(68,'#646E66','#2F7A3E',6,(7,14),(3.2,5.0))]
    for L,(y,rockc,greenc,n_,hs,rr) in enumerate(layers):
        span=50-L*9
        xs=sorted(random.uniform(-span,span) for _ in range(n_))
        for k,x in enumerate(xs):
            if L==2 and abs(x)<8: x=8.5*(1 if x>=0 else -1)+x*0.3
            hh=random.uniform(*hs)*(1.25 if random.random()<0.25 else 1)
            peak(x,y+random.uniform(-6,6),random.uniform(*rr),hh,rockc,greenc,L*30+k,random.choice(['cone','cone','hump']))
    # ground-hugging mist: camera-facing round billboards, radial falloff x bottom-up fade x noise; no straight edges
    mist=bpy.data.materials.new('mistBB'); mist.use_nodes=True; nt=mist.node_tree; nt.nodes.clear()
    out=nt.nodes.new('ShaderNodeOutputMaterial'); mix=nt.nodes.new('ShaderNodeMixShader'); tr=nt.nodes.new('ShaderNodeBsdfTransparent'); em=nt.nodes.new('ShaderNodeEmission')
    em.inputs[0].default_value=hx('#EEF7F6'); em.inputs[1].default_value=1.0
    tc=nt.nodes.new('ShaderNodeTexCoord'); sep=nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'],sep.inputs[0])
    gr=nt.nodes.new('ShaderNodeTexGradient'); gr.gradient_type='SPHERICAL'
    mpp=nt.nodes.new('ShaderNodeMapping'); mpp.inputs['Location'].default_value=(-1,-1,0); mpp.inputs['Scale'].default_value=(2,2,1)
    nt.links.new(tc.outputs['UV'],mpp.inputs[0]); nt.links.new(mpp.outputs[0],gr.inputs['Vector'])
    vf=nt.nodes.new('ShaderNodeMath'); vf.operation='POWER'; nt.links.new(sep.outputs['Y'],vf.inputs[0]); vf.inputs[1].default_value=1.0
    inv=nt.nodes.new('ShaderNodeMath'); inv.operation='SUBTRACT'; inv.inputs[0].default_value=1.0; nt.links.new(sep.outputs['Y'],inv.inputs[1])
    nz=nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=3.0; nt.links.new(tc.outputs['Object'],nz.inputs['Vector'])
    m1=nt.nodes.new('ShaderNodeMath'); m1.operation='MULTIPLY'; nt.links.new(gr.outputs['Fac'],m1.inputs[0]); nt.links.new(inv.outputs[0],m1.inputs[1])
    m2=nt.nodes.new('ShaderNodeMath'); m2.operation='MULTIPLY'; nt.links.new(m1.outputs[0],m2.inputs[0]); nt.links.new(nz.outputs['Fac'],m2.inputs[1])
    m3=nt.nodes.new('ShaderNodeMath'); m3.operation='MULTIPLY'; nt.links.new(m2.outputs[0],m3.inputs[0]); m3.inputs[1].default_value=0.9
    nt.links.new(m3.outputs[0],mix.inputs[0]); nt.links.new(tr.outputs[0],mix.inputs[1]); nt.links.new(em.outputs[0],mix.inputs[2]); nt.links.new(mix.outputs[0],out.inputs[0])
    try: mist.surface_render_method='BLENDED'
    except: pass
    for L,(y,_,_,_,_,_) in enumerate(layers):
        span=50-L*9
        for q in range(9 if L<2 else 7):
            if random.random()<0.3: continue
            w=random.uniform(9,16); hgt=random.uniform(2.2,4.0)
            o=add('plane',(random.uniform(-span,span),y-7+random.uniform(-3,3),hgt*0.5-0.3),(w,hgt*0.5,1),rot=(math.radians(80),0,0))
            o.data.uv_layers.active and None; o.data.materials.append(mist)
    # river: deep channel + shallows near banks, flow streaks along current (toward camera)
    organic_ground((0,40,-0.5),40,75,M['riverD'],seed=5,h=0.2)
    organic_ground((0,22,-0.36),15,40,M['river'],seed=6,h=0.08)
    # ripple bump on water mats -> sun glints break up
    for wm in (M['riverD'],M['river'],M['shal']):
        nt=wm.node_tree; b=nt.nodes['Principled BSDF']; tx=nt.nodes.new('ShaderNodeTexNoise'); tx.inputs['Scale'].default_value=9.0
        try: tx.inputs['Detail'].default_value=6
        except: pass
        mp=nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value=(1.0,0.25,1.0); tc=nt.nodes.new('ShaderNodeTexCoord')
        nt.links.new(tc.outputs['Object'],mp.inputs[0]); nt.links.new(mp.outputs[0],tx.inputs['Vector'])
        bp=nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=0.25; nt.links.new(tx.outputs['Fac'],bp.inputs['Height']); nt.links.new(bp.outputs['Normal'],b.inputs['Normal'])
    flow=mat('flow','#DFF6F0',1.0,emit='#DFF6F0',es=0.15,alpha=0.06)
    # warm sun reflection: soft gold sheen on upper-right water + fine glints (flat on water, no beams)
    gl=mat('glint','#FFF2C8',emit='#FFE2A0',es=6)
    for k in range(50):
        u=random.gauss(0,0.7); v=random.gauss(0,0.7)
        x=5.2+u*2.2; y=26+v*4.5
        if x<2.5 or y<16: continue
        add('plane',(x,y,-0.24),(random.uniform(0.03,0.09),random.uniform(0.012,0.03),1),rot=(0,0,random.uniform(-.2,.2)),m=gl)
    # banks (left village/ferry, right waterwheel/buffalo), organic edges + shallows
    for (x,y,rx,ry,sd) in [(-8.6,10,3.6,6,1),(8.6,8,3.4,6,2)]:
        organic_ground((x,y,-0.45),rx+1.2,ry+1.2,M['shal'],seed=sd,h=0.12)
        organic_ground((x,y,-0.35),rx+0.4,ry+0.4,M['sand'],seed=sd,h=0.25); organic_ground((x,y,-0.1),rx,ry,M['grass'],seed=sd,h=0.3)
    def bamboo_clump(x,y,n):
        for k in range(n):
            px,py=x+random.uniform(-0.8,0.8),y+random.uniform(-0.8,0.8); h=random.uniform(3,4.6); tilt=random.uniform(-.2,.2)
            add('cylinder',(px,py,h/2),(0.06,0.06,h/2),rot=(tilt,random.uniform(-.2,.2),0),m=M['bamD'],vertices=6)
            for s_ in range(4): add('torus',(px+tilt*0.0,py,0.6+s_*0.9),(1,1,1),m=M['node'],major_radius=0.07,minor_radius=0.015,major_segments=6,minor_segments=3)
            for c in range(3): blob((px-math.sin(tilt)*h*0.5+random.uniform(-.5,.5),py+random.uniform(-.3,.3),h-0.2+c*0.25),random.uniform(0.35,0.6),1.4,0.9,0.5,M['shrub'] if c%2 else M['grass2'],sub=1,amp=0.35,seed=k*3+c+int(x))
    # LEFT: stilt house + ferry pier + moored small raft + bamboo grove
    hx_,hy_=-9.0,12.0
    for px in (-1,1):
        for py in (-0.7,0.7): add('cylinder',(hx_+px,hy_+py,0.4),(0.07,0.07,0.6),m=M['wood'],vertices=6)
    add('cube',(hx_,hy_,1.5),(1.3,0.9,0.6),m=M['wall'])
    for d in (-0.8,0,0.8): add('cube',(hx_+d,hy_-0.91,1.5),(0.04,0.02,0.6),m=M['woodD'])
    add('cube',(hx_+0.4,hy_-0.92,1.55),(0.25,0.02,0.22),m=M['win'])
    r=add('cylinder',(hx_,hy_,2.45),(1,1,1),rot=(0,math.radians(90),0),m=M['roof'],vertices=3,radius=1.15,depth=3.0); r.scale=(1,1.35,1)
    for k in range(7): add('cube',(-6.9+k*0.35,8.2,0.12),(0.16,0.55,0.04),m=M['wood'])     # pier planks into river
    for k in (0,3,6):
        for e in (-0.5,0.5): add('cylinder',(-6.9+k*0.35,8.2+e,-0.1),(0.06,0.06,0.4),m=M['woodD'],vertices=6)
    add('cylinder',(-4.6,8.2,0.5),(0.07,0.07,0.7),m=M['woodD'],vertices=6)   # ferry post with lantern
    add('uv_sphere',(-4.6,8.2,1.25),(0.14,0.14,0.18),m=M['scarf'],segments=8,ring_count=6)
    for k in range(5): add('cylinder',(-4.6,9.0+k*0.18,-0.05),(0.08,0.08,0.9),rot=(0,math.radians(90),0),m=M['bam'],vertices=6)  # moored small raft
    bamboo_clump(-10.5,8.0,6); bamboo_clump(-7.6,14.5,5)
    # RIGHT: water wheel on bank edge + buffalo in shallows + bamboo grove
    wx,wy=6.4,8.6
    add('torus',(wx,wy,1.0),(1,1,1),rot=(0,math.radians(90),0),m=M['woodD'],major_radius=1.1,minor_radius=0.06,major_segments=16,minor_segments=4)
    add('torus',(wx+0.3,wy,1.0),(1,1,1),rot=(0,math.radians(90),0),m=M['woodD'],major_radius=1.1,minor_radius=0.06,major_segments=16,minor_segments=4)
    for k in range(10):
        a=k*2*math.pi/10
        add('cube',(wx+0.15,wy+math.cos(a)*0.6,1.0+math.sin(a)*0.6),(0.03,0.03,0.6),rot=(-a,0,0),m=M['wood'])
        add('cube',(wx+0.15,wy+math.cos(a)*1.15,1.0+math.sin(a)*1.15),(0.22,0.05,0.16),rot=(-a,0,0),m=M['bam'])
    add('cylinder',(wx+0.15,wy,1.0),(0.12,0.12,0.4),rot=(0,math.radians(90),0),m=M['woodD'],vertices=8)
    for k in range(6): add('cylinder',(wx+0.8+k*0.5,wy+1.2,2.0-k*0.05),(0.07,0.07,0.28),rot=(0,math.radians(90),0),m=M['bam'],vertices=6)  # aqueduct
    for k in range(5): add('ico_sphere',(wx+0.15,wy-1.1+k*0.1,0.1+k*0.25),(1,1,1),m=M['foam'],subdivisions=1,radius=0.1)
    bx_,by_=9.2,5.6
    blob((bx_,by_,0.0),0.75,1.6,0.95,0.75,M['buff'],sub=2,amp=0.06,seed=3); blob((bx_-1.15,by_-0.1,0.25),0.4,1.1,0.9,0.9,M['buff'],sub=1,seed=4)
    for e in (-1,1): add('cylinder',(bx_-1.25,by_+e*0.35,0.65),(0.05,0.05,0.25),rot=(e*0.9,0,0),m=M['sand'],vertices=5)
    for k in range(3): add('torus',(bx_,by_,-0.22),(1,1,1),m=M['foam'],major_radius=1.4+k*0.4,minor_radius=0.03,major_segments=16,minor_segments=3)
    bamboo_clump(10.2,10.5,6); bamboo_clump(8.0,13.5,4)
    _raft0=set(sc.objects)
    # BOARD = bamboo raft, smaller & higher; straight edges with rope lashings and nodes, no foam ring
    n=7; cell=0.98; bx,by=0,2.7
    W=n*cell
    for j in range(n):
        y=by+(j-3)*cell
        for t in (-1,0,1):
            add('cylinder',(bx,y+t*cell*0.31,0.0),(0.14,0.14,W/2),rot=(0,math.radians(90),0),m=M['bam'] if (j+t)%2 else M['bamD'],vertices=8)
        for i in range(n+1):
            add('cylinder',(bx-W/2+i*cell,y,0.0),(0.16,0.46,0.16),rot=(0,math.radians(90),0),m=M['node'],vertices=8)
    for i in (0,2,4,6):  # cross lashing bars + rope wraps
        x=bx+(i-3)*cell
        add('cube',(x,by,0.17),(0.05,W/2,0.04),m=M['woodD'])
        for j in range(n):
            add('torus',(x,by+(j-3)*cell+cell*0.45,0.12),(1,1,1),rot=(0,math.radians(90),0),m=M['rope'],major_radius=0.17,minor_radius=0.03,major_segments=8,minor_segments=3)
    for e in (-1,1):
        add('cylinder',(bx+e*(W/2+0.2),by,0.03),(0.2,0.2,W/2+0.15),rot=(math.radians(90),0,0),m=M['bamD'],vertices=10)
        for j in range(n): add('torus',(bx+e*(W/2+0.2),by+(j-3)*cell,0.03),(1,1,1),rot=(math.radians(90),0,0),m=M['node'],major_radius=0.21,minor_radius=0.03,major_segments=10,minor_segments=3)
    # raft reflection on near water: dark tinted soft band + faint bamboo-coloured broken streaks
    for q,(a_,ext) in enumerate([(0.26,0.9),(0.16,1.5),(0.08,2.2)]):
        rm=mat('refl%d'%q,'#173A2A',1.0,alpha=a_)
        add('plane',(bx,by-W/2-ext/2-0.1,-0.248+0.001*q),(W/2+0.1,ext/2,1),m=rm)
    rs=mat('reflS','#9FB040',1.0,alpha=0.14)
    for k in range(18):
        add('plane',(bx-W/2+random.uniform(0,W),by-W/2-random.uniform(0.2,1.8),-0.244),(random.uniform(0.3,0.9),0.035,1),m=rs)
    # bow-wake ripples only at upstream edge (shows flow)
    for k in range(3): add('cylinder',(bx,by+W/2+0.5+k*0.45,-0.24),(W/2*(0.9-k*0.15),0.05,0.01),m=M['foam'],vertices=8)
    # pieces: equal size, centered, distinct shape+color
    kinds=['melon','pod','hat','peb','dfly','lotus']
    rr_=random.Random(2026)
    while True:
        bag=[kinds[q%6] for q in range(49)]; rr_.shuffle(bag); G={}
        ok=True
        for i in range(n):
            for j in range(n):
                G[i,j]=bag[i*n+j]
        for i in range(n):
            for j in range(n):
                if i>=2 and G[i,j]==G[i-1,j]==G[i-2,j]: ok=False
                if j>=2 and G[i,j]==G[i,j-1]==G[i,j-2]: ok=False
        if ok: break
    from collections import Counter; print('PIECE_COUNTS',Counter(G.values()))
    for i in range(n):
        for j in range(n):
            x=bx+(i-3)*cell; y=by+(j-3)*cell; k=G[i,j]; z=0.16; _b=set(sc.objects)
            if k=='melon':
                add('cylinder',(x,y,z+0.2),(1,1,1),rot=(math.radians(35),0,0),m=M['melon'],vertices=12,radius=0.24,depth=0.1)
                add('cylinder',(x,y+0.02,z+0.19),(1,1,1),rot=(math.radians(35),0,0),m=M['rind'],vertices=12,radius=0.27,depth=0.08)
                for d in range(3): add('uv_sphere',(x-0.1+d*0.1,y-0.07,z+0.25),(0.025,0.01,0.04),m=M['seed'],segments=6,ring_count=4)
            elif k=='pod':
                add('cylinder',(x,y,z+0.15),(0.27,0.27,0.13),m=M['pod'],vertices=12)
                for d in range(6): add('cylinder',(x+0.15*math.cos(d*1.05),y+0.15*math.sin(d*1.05),z+0.29),(0.045,0.045,0.01),m=M['podH'],vertices=6)
                add('cylinder',(x,y,z+0.29),(0.045,0.045,0.01),m=M['podH'],vertices=6)
            elif k=='hat':
                add('cone',(x,y,z+0.16),(1,1,1),m=M['hat'],vertices=14,radius1=0.33,radius2=0.02,depth=0.24)
                add('torus',(x,y,z+0.05),(1,1,1),m=M['hatB'],major_radius=0.32,minor_radius=0.025,major_segments=14,minor_segments=3)
            elif k=='peb':
                blob((x,y,z+0.14),0.27,1.0,1.0,0.6,M['peb'],sub=2,amp=0.04,seed=i+j)
            elif k=='dfly':
                add('cylinder',(x,y,z+0.2),(0.05,0.05,0.28),rot=(0,math.radians(90),0),m=M['dfly'],vertices=6)
                add('uv_sphere',(x+0.28,y,z+0.2),(0.07,0.07,0.07),m=M['dfly'],segments=8,ring_count=4)
                for d in (-1,1):
                    for e in (-0.05,0.1): add('uv_sphere',(x+e,y+d*0.17,z+0.22),(0.07,0.17,0.012),m=M['wing'],segments=8,ring_count=4)
            else:
                for d in range(6): add('uv_sphere',(x+0.13*math.cos(d*1.05),y+0.13*math.sin(d*1.05),z+0.18),(0.11,0.18,0.07),rot=(0.5,0,d*1.05+1.57),m=M['lotus'],segments=8,ring_count=5)
                add('uv_sphere',(x,y,z+0.23),(0.08,0.08,0.06),m=M['pod'],segments=8,ring_count=4)
            grow(_b,x,y,1.25)
    for o in sc.objects:
        if o not in _raft0 and o.location.z>-0.2: o.location.z-=0.22   # raft sits into the water
    # waterline: contact shadow, wet dark band, ripple rings
    for q,(a_,g) in enumerate([(0.35,0.15),(0.18,0.45),(0.08,0.8)]):
        add('plane',(bx+0.25,by-0.15,-0.252+0.0005*q),(W/2+0.3+g,W/2+0.2+g,1),m=mat('cshad%d'%q,'#0A2A30',1.0,alpha=a_))
    wet=mat('wet','#4E5E22',0.3)
    for e in (-1,1):
        add('cube',(bx+e*(W/2+0.2),by,-0.22),(0.215,W/2+0.15,0.03),m=wet)
        add('cube',(bx,by+e*(W/2+0.05),-0.22),(W/2+0.35,0.05,0.03),m=wet)
    rip=mat('rip','#DFF6F0',1.0,emit='#DFF6F0',es=0.15,alpha=0.045)
    for r_ in range(3):   # asymmetric, broken faint ripples (trail longer downstream / toward camera)
        for k in range(44):
            a=2*math.pi*k/44
            if noise.noise(Vector((math.cos(a)*1.7,math.sin(a)*1.7,r_*3.1)))+random.uniform(-0.25,0.25)<0.0: continue
            sx=(W/2+0.5+0.35*r_+0.25*noise.noise(Vector((a,r_,0))))*1.05
            sy=sx*(1.0+(0.35*(1-math.sin(a))*0.5 if math.sin(a)<0 else 0))
            px=bx+math.cos(a)*sx; py=by+math.sin(a)*sy-0.2*r_
            o=add('plane',(px,py,-0.236),(random.uniform(0.25,0.45),0.018,1),rot=(0,0,a+math.pi/2),m=rip)
    # 阿芳 standing on small moored raft at top-right of board, with pole, readable size
    fx,fy=4.6,6.6
    for k in range(5): add('cylinder',(fx,fy-0.6+k*0.3,0.0),(0.13,0.13,1.0),rot=(0,math.radians(90),0),m=M['bam'],vertices=6)
    add('cone',(fx,fy,0.65),(1,1,1),m=M['dress'],vertices=10,radius1=0.38,radius2=0.16,depth=1.0)
    add('cylinder',(fx,fy,1.25),(0.15,0.15,0.18),m=M['dress'],vertices=8)
    add('torus',(fx,fy,1.42),(1,1,0.8),m=M['scarf'],major_radius=0.16,minor_radius=0.06,major_segments=10,minor_segments=4)
    add('cube',(fx+0.12,fy+0.2,1.25),(0.05,0.18,0.03),rot=(0.3,0,0),m=M['scarf'])
    add('uv_sphere',(fx,fy,1.68),(0.24,0.24,0.25),m=M['skin'],segments=12,ring_count=8)
    add('uv_sphere',(fx,fy+0.04,1.76),(0.26,0.25,0.22),m=M['hair'],segments=12,ring_count=8)
    add('cone',(fx,fy,1.98),(1,1,1),m=M['hat'],vertices=14,radius1=0.5,radius2=0.02,depth=0.28)
    add('cylinder',(fx-0.35,fy,1.4),(0.03,0.03,1.6),rot=(0,0.25,0),m=M['woodD'],vertices=6)
    # cormorant on raft corner
    blob((bx-W/2-0.1,by+W/2,0.45),0.2,0.9,0.9,1.4,M['bird'],sub=1); blob((bx-W/2-0.1,by+W/2-0.08,0.82),0.11,m=M['bird'],sub=1)
    # near-water foreground: reeds corners, ducks, net floats, raft reflection darkening
    reed=mat('reed','#4E9A3A'); reed2=mat('reed2','#8CC24A'); duck=mat('duck','#F4F0E6'); bill=mat('bill','#F09A30'); flt=mat('flt','#E8553A'); fltW=mat('fltW','#F4EEDC')
    for (cx_,cy_,nn) in [(-3.3,-3.9,22),(4.6,-2.6,18),(-4.6,-1.6,10)]:
        for k in range(nn):
            px,py=cx_+random.gauss(0,0.7),cy_+random.gauss(0,0.5); hh=random.uniform(0.8,1.8)
            o=add('cone',(px,py,hh/2-0.25),(1,1,1),rot=(random.uniform(-.25,.25),random.uniform(-.25,.25),random.uniform(0,6)),m=reed if k%3 else reed2,vertices=3,radius1=0.05,radius2=0.0,depth=hh)
        for k in range(4): blob((cx_+random.uniform(-1,1),cy_+random.uniform(-.6,.6),-0.25),0.35,1.4,1,0.08,M['grass'],sub=1,amp=0.2,seed=k)
    for k,(dx,dy) in enumerate([(-2.4,-3.2),(-1.7,-3.6),(-1.1,-3.9)]):
        sc_=1.0 if k==0 else 0.7
        blob((dx,dy,-0.12),0.28*sc_,1.4,0.9,0.7,duck,sub=1,amp=0.08,seed=k); blob((dx-0.28*sc_,dy,0.12),0.15*sc_,m=duck,sub=1)
        add('cone',(dx-0.45*sc_,dy,0.1),(1,1,1),rot=(0,math.radians(-90),0),m=bill,vertices=5,radius1=0.06*sc_,radius2=0,depth=0.14*sc_)
        for r_ in range(2): add('torus',(dx+0.1,dy,-0.24),(1,1,1),m=flow,major_radius=(0.45+r_*0.3)*sc_,minor_radius=0.02,major_segments=14,minor_segments=3)
    for k in range(6):   # fishing-net float line arcing across near water
        t=k/5; px=1.0+t*4.0; py=-4.4+0.6*math.sin(t*math.pi)
        add('uv_sphere',(px,py,-0.2),(0.13,0.13,0.1),m=flt if k%2 else fltW,segments=8,ring_count=5)
    for k in range(5): add('cylinder',(1.4+k*0.8,-4.4+0.6*math.sin((k+0.5)/5*math.pi),-0.22),(0.01,0.42,0.01),rot=(0,math.radians(90),math.radians(90)+0.3),m=M['rope'],vertices=4)
    # clouds in sky + shadow clouds on sun path over peaks and river
    for k,(x,y,z,s) in enumerate([(26,150,30,10),(-6,155,34,9),(-34,145,27,8),(46,140,24,7)]):
        for b in range(6): blob((x+random.uniform(-s,s),y,z+random.uniform(-0.4,0.6)*s*0.4),s*random.uniform(0.5,0.9),1,0.7,0.7,M['cloud'] if b%3 else M['cloudS'],sub=2,amp=0.15,seed=k*9+b)
    S_=sun((58,0,-108),'#FFE2A8',9.0,0.6)   # strong low side light from right
    dv=Vector((0,0,-1)); dv.rotate(S_.rotation_euler)
    for k,tg in enumerate([(-3,24,0),(4,40,0),(-12,66,5),(12,92,6),(-20,125,8),(2,14,0)]):
        t=(26-tg[2])/(-dv.z); c=Vector(tg)-dv*t
        for b in range(4): blob((c.x+random.uniform(-3,3),c.y+random.uniform(-2,2),c.z),random.uniform(3,4.5),1.4,1.1,0.4,M['cloud'],sub=2,amp=0.15,seed=90+k*4+b)
    sun((60,0,60),'#7FC8FF',0.5,8)
    try: sc.eevee.use_raytracing=True
    except Exception as e: print('rt',e)
    try: sc.eevee.shadow_resolution_scale=1.0
    except: pass
    import os
    if os.environ.get('PEAKCAM'): cam((6,30,6),(10,80,9),40)
    else: cam((0,-12.5,9.0),(0,6.5,1.3),30)
# ======================================================= SNOW
else:
    world('#1A2A5A','#3A5490',1.2)
    M=dict(snow=mat('snow','#EEF3F8',0.6),snowB=mat('snowB','#BFD0EA',0.6),ice=mat('ice','#7CC4E8',0.08,alpha=0.85),
           iceD=mat('iceD','#3E7FB8',0.05),rock=mat('rock','#3B4866'),rockD=mat('rockD','#2A3350'),
           pine=mat('pine','#1E4A4A'),trunk=mat('trunk','#4A3328'),wood=mat('wood','#7A4E32'),woodD=mat('woodD','#553522'),
           dome=mat('dome','#C9D6E8',0.3,metal=0.6),copper=mat('copper','#B87A4A',0.35,metal=0.7),
           warm=mat('warm','#FFC27A',emit='#FFA14A',es=8),star=mat('star','#FFE08A',emit='#FFD46A',es=6),
           starB=mat('starB','#FFF6D8',emit='#FFF2C0',es=10),line=mat('line','#9FE8FF',emit='#8FE0FF',es=5),
           aurG=mat('aurG','#3DFFB0',emit='#3DFFB0',es=3,alpha=0.45),aurP=mat('aurP','#B46CFF',emit='#C77CFF',es=2.5,alpha=0.35),
           mtnF=mat('mtnF','#2E3E6E'),mtnB=mat('mtnB','#4A5C92'),cap=mat('cap','#DDE8FF'),
           cocoa=mat('cocoa','#B8653A'),mug=mat('mug','#E8463C'),glove=mat('glove','#E85A8A'),needle=mat('needle','#2F7A56'),
           crystal=mat('crystal','#A8E6FF',0.1,emit='#8FD8FF',es=1.5),owl=mat('owl','#B89A7A'),eye=mat('eye','#FFD34A',emit='#FFD34A',es=4),
           cloud=mat('cloud','#5A6A9A',1.0),carrot=mat('carrot','#FF7A2A'),scarf=mat('scarf','#D8402A'),frost=mat('frost','#E8F8FF',emit='#CFF0FF',es=2))
    sky_plane((0,110,25),(120,80,1),'#0A1230','#2B3F7A',es=1.0)
    # stars
    for k in range(260):
        add('ico_sphere',(random.uniform(-60,60),105,random.uniform(5,70)),(1,1,1),m=M['starB'] if k%5==0 else M['star'],subdivisions=1,radius=random.uniform(0.08,0.25))
    # aurora: wavy ribbons
    for r_,(m,z0,yy) in enumerate([(M['aurG'],22,58),(M['aurP'],26,60),(M['aurG'],19,56)]):
        bm=bmesh.new(); prev=None
        for k in range(60):
            x=-60+k*2.1; z=z0*1.6+3*math.sin(k*0.18+r_)+1.5*math.sin(k*0.07)
            a=bm.verts.new((x,yy*1.6+2*math.sin(k*0.11),z)); b=bm.verts.new((x,yy*1.6+2*math.sin(k*0.11),z+8+2*math.sin(k*0.23+r_)))
            if prev: bm.faces.new((prev[0],a,b,prev[1]))
            prev=(a,b)
        me=bpy.data.meshes.new('aur'); bm.to_mesh(me); o=bpy.data.objects.new('aur',me); link(o); me.materials.append(m)
    # moon
    add('uv_sphere',(-24,100,48),(1,1,1),m=mat('moon','#FFF4DA',emit='#FFF0D0',es=6),radius=3.2)
    # far snowy peaks
    for i,(x,y,r,h) in enumerate([(-20,46,10,16),(-5,50,12,21),(11,48,10,17),(24,44,9,13)]):
        mountain((x*1.5,y*1.7,h*0.4-2),r*0.8,h*0.55,M['mtnB'],M['cap'],seed=i)
    for i,(x,y,r,h) in enumerate([(-13,34,8,10),(4,36,9,11),(17,32,7,8)]):
        mountain((x*1.4,y*1.6,h*0.3-3),r*0.8,h*0.5,M['mtnF'],M['snowB'],seed=i+5)
    # clouds band partially blocking moonlight
    for k in range(14):
        blob((random.uniform(-40,10),70,random.uniform(30,38)),random.uniform(1.5,3),1.4,0.6,0.5,M['cloud'],sub=2,amp=0.2,seed=k)
    # plateau ground (snow, organic)
    organic_ground((0,3,-1.0),12,10,M['rockD'],seed=2,h=0.8); organic_ground((0,3.3,-0.25),11.6,9.6,M['snow'],seed=2,h=0.1)
    for k in range(12): blob((random.choice([-1,1])*random.uniform(6.5,10),random.uniform(-6,12),-0.1),random.uniform(0.6,1.4),1.4,1,0.45,M['snowB'] if k%2 else M['snow'],sub=2,amp=0.2,seed=k)
    # observatory upper-left back
    ox,oy=-6.2,9.5
    add('cylinder',(ox,oy,1.2),(2.2,2.2,1.2),m=M['wood'],vertices=16)
    for k in range(16):
        a=k*2*math.pi/16; add('cube',(ox+math.cos(a)*2.21,oy+math.sin(a)*2.21,1.2),(0.05,0.05,1.2),rot=(0,0,a),m=M['woodD'])
    add('uv_sphere',(ox,oy,2.4),(2.3,2.3,2.1),m=M['dome'],segments=16,ring_count=8)
    add('cube',(ox+0.6,oy-1.2,3.4),(0.35,1.0,0.9),rot=(0.4,0,0.4),m=M['rockD'])  # dome slit
    add('cylinder',(ox+0.9,oy-1.5,4.0),(0.22,0.22,1.4),rot=(0.7,0,0.4),m=M['copper'],vertices=10)  # telescope
    for d in (-0.9,0.9): add('cube',(ox+d,oy-2.21,1.2),(0.32,0.03,0.4),m=M['warm'])
    add('cube',(ox,oy-2.22,0.6),(0.4,0.03,0.6),m=M['woodD'])
    point((ox,oy-3.2,1.3),'#FFA14A',120,0.6)
    # snow on dome rim
    add('torus',(ox,oy,2.45),(1,1,0.4),m=M['snow'],major_radius=2.25,minor_radius=0.18,major_segments=16,minor_segments=4)
    # cabin right back
    cx_,cy_=7.4,8.4
    add('cube',(cx_,cy_,0.9),(1.5,1.1,0.9),m=M['wood'])
    for z in range(6): add('cylinder',(cx_,cy_-1.12,0.2+z*0.3),(0.13,0.13,1.5),rot=(0,math.radians(90),0),m=M['woodD'],vertices=6)
    add('cube',(cx_,cy_-1.15,0.95),(0.4,0.03,0.35),m=M['warm']); point((cx_,cy_-2,1.0),'#FFA14A',60,0.4)
    r=add('cylinder',(cx_,cy_,2.3),(1,1,1),rot=(math.radians(90),0,math.radians(90)),m=M['snow'],vertices=3,radius=1.5,depth=2.6); r.scale=(1,1.3,1)
    add('cube',(cx_+0.8,cy_,2.9),(0.2,0.2,0.5),m=M['rock'])
    for k in range(4): blob((cx_+0.8+k*0.2,cy_,3.6+k*0.5),0.25+k*0.1,m=M['snowB'],sub=1)
    # pines
    for (x,y,s) in [(-10,3,1.4),(-9.4,-3,1.1),(10,2,1.5),(9.6,-4,1.1),(-2,12,1.2),(3,12.5,1.3),(11,10,1.2),(-10.5,9,1.3),(5,11,0.9)]:
        tree_pine((x,y,-0.15),s,M['pine'],M['trunk'],M['snow'])
    # BOARD: frozen pond star-map, 7x7 ice tiles, organic pond rim
    organic_ground((0,1.4,-0.2),5.0,4.8,M['iceD'],seed=8,h=0.18)
    n=7; cell=1.05; bx,by=0,1.4
    for i in range(n):
        for j in range(n):
            x=bx+(i-3)*cell; y=by+(j-3)*cell
            add('cube',(x,y,0.0),(cell*0.47,cell*0.47,0.03),rot=(0,0,random.uniform(-.04,.04)),m=M['ice'])
            for c in range(2): add('ico_sphere',(x+random.uniform(-.4,.4),y+random.uniform(-.4,.4),0.04),(1,1,1),m=M['starB'],subdivisions=1,radius=0.025)
    # snow rim with icicle-hung log frame (organic, snow banks)
    for k in range(40):
        a=k*2*math.pi/40; rr=4.9+0.25*math.sin(a*3)
        blob((bx+math.cos(a)*rr,by+math.sin(a)*rr,0.05),random.uniform(0.45,0.7),1.3,1,0.5,M['snow'],sub=1,amp=0.25,seed=k)
    # pieces
    kinds=['crystal','star','cocoa','glove','pine','scope']
    frozen=set([(1,1),(5,2),(2,5),(4,4)])
    for i in range(n):
        for j in range(n):
            x=bx+(i-3)*cell; y=by+(j-3)*cell; k=random.choice(kinds); z=0.06; _b=set(sc.objects)
            if k=='crystal':
                for a in range(3): add('cube',(x,y,z+0.12),(0.42,0.05,0.03),rot=(0,0,a*math.pi/3),m=M['crystal'])
            elif k=='star':
                o=add('cone',(x,y,z+0.12),(0.36,0.36,0.08),m=M['star'],vertices=5,radius1=1,radius2=0,depth=1)
                add('cone',(x,y,z+0.12),(0.36,0.36,0.08),rot=(0,0,math.pi/5),m=M['star'],vertices=5,radius1=1,radius2=0,depth=1)
            elif k=='cocoa':
                add('cylinder',(x,y,z+0.2),(0.22,0.22,0.2),m=M['mug'],vertices=12); add('cylinder',(x,y,z+0.39),(0.19,0.19,0.02),m=M['cocoa'],vertices=12)
                add('torus',(x+0.24,y,z+0.2),(1,1,1),rot=(math.radians(90),0,0),m=M['mug'],major_radius=0.1,minor_radius=0.03,major_segments=8,minor_segments=4)
                for s_ in range(2): blob((x+0.03*s_,y,z+0.55+0.15*s_),0.07,m=M['snow'],sub=1)
            elif k=='glove':
                blob((x,y,z+0.2),0.24,0.9,0.5,1.1,M['glove'],sub=2,amp=0.05); blob((x+0.2,y,z+0.18),0.09,m=M['glove'],sub=1)
                add('cylinder',(x,y,z-0.0+0.02),(0.2,0.12,0.06),m=M['snow'],vertices=10)
            elif k=='pine':
                for b in range(3): add('cone',(x+(b-1)*0.1,y,z+0.15),(0.1,0.32,0.03),rot=(0,0,(b-1)*0.5),m=M['needle'],vertices=4,radius1=1,radius2=0,depth=1)
                add('uv_sphere',(x,y-0.15,z+0.12),(0.07,0.07,0.07),m=M['mug'],segments=8,ring_count=4)
            else:
                add('cylinder',(x,y,z+0.22),(0.1,0.1,0.32),rot=(math.radians(60),0,0.3),m=M['copper'],vertices=8); add('cylinder',(x,y,z+0.06),(0.18,0.18,0.04),m=M['woodD'],vertices=8)
            grow(_b,x,y,1.45)
            if (i,j) in frozen:
                blob((x,y,z+0.25),0.45,1,1,0.7,M['ice'],sub=2,amp=0.12,seed=i*7+j)
    # constellation lines linking star tiles (demo of star-map) + frost trail drag
    pts=[(0,0),(1,2),(3,3),(5,2),(6,4)]
    for a,b in zip(pts,pts[1:]):
        p=Vector((bx+(a[0]-3)*cell,by+(a[1]-3)*cell,0.1)); q=Vector((bx+(b[0]-3)*cell,by+(b[1]-3)*cell,0.1)); d=q-p
        o=add('cylinder',(p+q)/2,(0.03,0.03,d.length/2),m=M['line'],vertices=6); o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
        add('ico_sphere',p,(1,1,1),m=M['starB'],subdivisions=1,radius=0.12)
    for k in range(9):
        add('ico_sphere',(bx+1.5-k*0.2,by-2.3+k*0.05,0.08+0.02*math.sin(k)),(1,1,1),m=M['frost'],subdivisions=1,radius=0.05+0.02*(k%3))
    # owl on observatory telescope, snowman at board corner
    sx,sy=4.6,-2.3
    for k,(r,z) in enumerate([(0.55,0.4),(0.42,1.1),(0.3,1.65)]): blob((sx,sy,z),r,m=M['snow'],sub=2,amp=0.06,seed=k)
    add('cone',(sx,sy-0.35,1.65),(1,1,1),rot=(math.radians(90),0,0),m=M['carrot'],vertices=6,radius1=0.06,radius2=0,depth=0.3)
    add('torus',(sx,sy,1.38),(1,1,0.6),m=M['scarf'],major_radius=0.32,minor_radius=0.07,major_segments=10,minor_segments=4)
    blob((ox+0.7,oy-2.3,3.0),0.3,0.9,0.8,1.2,M['owl'],sub=1,amp=0.1)
    for e in (-0.1,0.1): add('uv_sphere',(ox+0.7+e,oy-2.56,3.15),(0.06,0.03,0.06),m=M['eye'],segments=6,ring_count=4)
    # lights: cool moon key from upper-left behind, warm windows, aurora green fill
    sun((55,0,200),'#9DB8FF',2.8,1.0)
    sun((70,0,10),'#5CFFC0',0.25,10)
    point((bx,by,5),'#8FE0FF',260,3)
    # moon shafts through cloud gaps
    for x in (-8,-2):
        shaft((-24,90,45),(x,6,0),0.8,'#BFD4FF',0.02)
    # falling snow
    for k in range(120):
        add('ico_sphere',(random.uniform(-10,10),random.uniform(-10,14),random.uniform(0.5,12)),(1,1,1),m=M['snow'],subdivisions=1,radius=0.04)
    cam((0,-11.5,11.5),(0,4.2,1.2),30)
tri=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in sc.objects if o.type=='MESH')
print('TRIS_SCENE', tri, 'OBJS', len([o for o in sc.objects if o.type=='MESH']), 'MATS', len(bpy.data.materials))
sc.render.filepath=OUT
bpy.ops.render.render(write_still=True)
print('DONE', OUT)
