# S2 竹筏山水·夏 — engine-ready scene build (Blender 5.2 headless).
#   blender -b -P scripts/build_s2.py -- OUT.blend [PREVIEW.png]
# Templates live in hidden collection ASSETS (one mesh each, vertex colour 'Col', identity transform);
# placed instances are linked duplicates named <TPL>_i<n> in BG / RAFT_BOARD collections.
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, noise, Matrix
argv=sys.argv[sys.argv.index('--')+1:]; OUT=argv[0]; PREV=argv[1] if len(argv)>1 else None
random.seed(15)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene; vl=bpy.context.view_layer
def hx(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c)
def coll(name,parent=None):
    c=bpy.data.collections.new(name); (parent or sc.collection).children.link(c); return c
ASSETS=coll('ASSETS'); BG=coll('BG'); BOARD=coll('RAFT_BOARD'); FX=coll('FX')
def vcmat(name,rough=0.8,alpha=None,emit=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; b=nt.nodes['Principled BSDF']
    a=nt.nodes.new('ShaderNodeVertexColor'); a.layer_name='Col'; nt.links.new(a.outputs['Color'],b.inputs['Base Color'])
    b.inputs['Roughness'].default_value=rough
    if emit: nt.links.new(a.outputs['Color'],b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value=emit
    if alpha is not None:
        b.inputs['Alpha'].default_value=alpha
        try: m.surface_render_method='BLENDED'
        except: pass
    return m
M_OPA=vcmat('M_BR'); M_WATER=vcmat('M_BR_water',0.06); M_MIST=vcmat('M_BR_mist',1.0,alpha=0.22,emit=0.4)
# ---------- primitive helpers: every part carries its colour as a custom prop until baked ----------
PARTS=[]
def _reg(o,col):
    o['bc']=col; PARTS.append(o); return o
def prim(kind,loc,scale=(1,1,1),rot=(0,0,0),col='#888888',**kw):
    getattr(bpy.ops.mesh,'primitive_'+kind+'_add')(location=loc,rotation=rot,**kw)
    o=bpy.context.active_object; o.scale=scale; return _reg(o,col)
def blob(loc,r,sx=1,sy=1,sz=1,col='#888888',sub=1,amp=0.25,seed=0):
    o=prim('ico_sphere',loc,(r*sx,r*sy,r*sz),col=col,subdivisions=sub)
    for v in o.data.vertices: v.co*=(1+amp*noise.noise(v.co*1.7+Vector((seed,seed*2,0))))
    return o
def ground(loc,rx,ry,col,seed=0,h=0.3,n=28):
    bm=bmesh.new(); vs=[]
    for i in range(n):
        a=2*math.pi*i/n; rr=1+0.18*noise.noise(Vector((math.cos(a)*2+seed,math.sin(a)*2,seed)))+0.07*math.sin(a*5+seed)
        vs.append(bm.verts.new((math.cos(a)*rx*rr,math.sin(a)*ry*rr,0)))
    f=bm.faces.new(vs); r=bmesh.ops.extrude_face_region(bm,geom=[f])
    for v in [e for e in r['geom'] if isinstance(e,bmesh.types.BMVert)]: v.co.z+=h
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new('g'); bm.to_mesh(me); o=bpy.data.objects.new('g',me); sc.collection.objects.link(o); o.location=loc
    return _reg(o,col)
def template(name,fn,mat=None,smooth=False):
    PARTS.clear(); fn()
    objs=list(PARTS)
    for o in objs:
        me=o.data
        if 'Col' not in me.color_attributes:
            ca=me.color_attributes.new('Col','BYTE_COLOR','CORNER'); c=hx(o['bc'])+(1,)
            for d in ca.data: d.color=c
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    vl.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    o=vl.objects.active
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    me=o.data; me.materials.clear(); me.materials.append(mat or M_OPA)
    for p in me.polygons: p.use_smooth=smooth
    o.name=name; me.name=name
    for c in o.users_collection: c.objects.unlink(o)
    ASSETS.objects.link(o); return me
N={}
def inst(tpl,loc,rz=0.0,s=1.0,c=None,rx=0.0,ry=0.0):
    k=N.get(tpl,0); N[tpl]=k+1
    o=bpy.data.objects.new('%s_i%d'%(tpl,k),bpy.data.meshes[tpl]); (c or BG).objects.link(o)
    o.location=loc; o.rotation_euler=(rx,ry,rz); o.scale=(s,s,s) if not isinstance(s,tuple) else s; return o
# ====================================== TEMPLATES ======================================
def peak_parts(r,h,kind,rockc,greenc,seed,shrubs):
    R=random.Random(seed); bm=bmesh.new(); NR,NS=10,12; rings=[]; pw=R.uniform(0.7,1.1)
    for k in range(NR+1):
        t=k/NR; z=-0.6+t*h
        prof=max((1-t)**pw*0.9,0.34*math.sqrt(max(0,1-t*t))) if kind=='cone' else math.sqrt(max(0,1-t**2.2))*(1-0.3*t)
        prof*=(1+0.4*max(0,0.12-t)/0.12)
        if k==NR: prof=0.06
        ring=[]
        for a_ in range(NS):
            a=2*math.pi*a_/NS; rr=r*prof*(1+0.18*noise.noise(Vector((math.cos(a)*1.4+seed,math.sin(a)*1.4,t*3.5))))
            ring.append(bm.verts.new((math.cos(a)*rr,math.sin(a)*rr,z)))
        rings.append(ring)
    for k in range(NR):
        for a_ in range(NS): bm.faces.new((rings[k][a_],rings[k][(a_+1)%NS],rings[k+1][(a_+1)%NS],rings[k+1][a_]))
    bm.faces.new(rings[-1]); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    me=bpy.data.meshes.new('pk'); bm.to_mesh(me); o=bpy.data.objects.new('pk',me); sc.collection.objects.link(o)
    ca=me.color_attributes.new('Col','BYTE_COLOR','CORNER'); rc=hx(rockc); gc=hx(greenc); vn={}
    for v in me.vertices:
        f=(v.normal.z-0.18)/0.3+0.9*noise.noise(Vector((v.co.x*0.45,v.co.y*0.45,v.co.z*0.6+seed))); f=max(0,min(1,f)); f=f*f*(3-2*f)
        sh=0.88+0.12*noise.noise(Vector((v.co.x,v.co.y,v.co.z*2))); vn[v.index]=tuple(sh*(gc[i]*f+rc[i]*(1-f)) for i in range(3))+(1,)
    for l in me.loops: ca.data[l.index].color=vn[l.vertex_index]
    _reg(o,rockc)
    if shrubs:
        cand=[v for v in me.vertices if v.normal.z>0.42 and 0.08*h<v.co.z<0.85*h]; R.shuffle(cand)
        for i,v in enumerate(cand[:shrubs]):
            rr_=r*R.uniform(0.12,0.2)
            blob(tuple(v.co-v.normal*rr_*0.35),rr_,1.25,1.1,0.75,greenc if i%2 else '#4E9A3A',sub=0,amp=0.25,seed=seed+i)
PEAKDEF={'BR_peak_near_A':(4.2,13,'cone','#646E66','#2F7A3E',12),'BR_peak_near_B':(4.6,10,'hump','#646E66','#2F7A3E',12),
    'BR_peak_near_C':(3.6,15,'cone','#646E66','#2F7A3E',10),'BR_peak_mid_A':(5.0,17,'cone','#7F8F8C','#5E9A7C',0),
    'BR_peak_mid_B':(5.4,13,'hump','#7F8F8C','#5E9A7C',0),'BR_peak_far_A':(6.0,22,'cone','#A9BACB','#9DB7C2',0),'BR_peak_far_B':(6.5,16,'hump','#A9BACB','#9DB7C2',0)}
for i,(nm,a) in enumerate(PEAKDEF.items()):
    template(nm,lambda a=a,i=i: peak_parts(*a[:5],i*17+3,a[5]),smooth=True)
# water & banks
template('BR_river',lambda:(ground((0,0,-0.2),40,75,'#06475E',seed=5,h=0.2,n=40),ground((0,-18,0.0),15,40,'#0C7480',seed=6,h=0.02,n=36)),mat=M_WATER)
def bank(seed,rx,ry):
    ground((0,0,-0.45),rx+1.2,ry+1.2,'#2FA894',seed=seed,h=0.12); ground((0,0,-0.35),rx+0.4,ry+0.4,'#E8D7A8',seed=seed,h=0.25); ground((0,0,-0.1),rx,ry,'#5CC24A',seed=seed,h=0.3)
template('BR_bank_L',lambda:bank(1,3.6,6)); template('BR_bank_R',lambda:bank(2,3.4,6))
def house():
    for px in (-1,1):
        for py in (-0.7,0.7): prim('cylinder',(px,py,0.4),(0.07,0.07,0.6),col='#8A5A36',vertices=6)
    prim('cube',(0,0,1.5),(1.3,0.9,0.6),col='#F2E6CC')
    for d in (-0.8,0,0.8): prim('cube',(d,-0.91,1.5),(0.04,0.02,0.6),col='#5E3C24')
    prim('cube',(0.4,-0.92,1.55),(0.25,0.02,0.22),col='#FFD38A')
    r=prim('cylinder',(0,0,2.45),(1,1.35,1),rot=(0,math.radians(90),0),col='#4A4440',vertices=3,radius=1.15,depth=3.0)
template('BR_stilt_house',house)
def pier():
    for k in range(7): prim('cube',(k*0.35,0,0.12),(0.16,0.55,0.04),col='#8A5A36')
    for k in (0,3,6):
        for e in (-0.5,0.5): prim('cylinder',(k*0.35,e,-0.1),(0.06,0.06,0.4),col='#5E3C24',vertices=6)
    prim('cylinder',(2.3,0,0.5),(0.07,0.07,0.7),col='#5E3C24',vertices=6); prim('uv_sphere',(2.3,0,1.25),(0.14,0.14,0.18),col='#FF4A3A',segments=8,ring_count=5)
template('BR_pier',pier)
template('BR_moored_raft',lambda:[prim('cylinder',(0,k*0.18,-0.05),(0.08,0.08,0.9),rot=(0,math.radians(90),0),col='#B8C94A',vertices=6) for k in range(5)])
def bamboo():
    R=random.Random(4)
    for k in range(5):
        px,py=R.uniform(-0.8,0.8),R.uniform(-0.8,0.8); h=R.uniform(3,4.6); tilt=R.uniform(-.2,.2)
        prim('cylinder',(px,py,h/2),(0.06,0.06,h/2),rot=(tilt,R.uniform(-.2,.2),0),col='#8AAA3A',vertices=5)
        for c in range(2): blob((px-math.sin(tilt)*h*0.5+R.uniform(-.5,.5),py+R.uniform(-.3,.3),h-0.2+c*0.3),R.uniform(0.4,0.6),1.4,0.9,0.5,'#5BBE3A' if c else '#9BDB4F',sub=1,amp=0.35,seed=k*3+c)
template('BR_bamboo_clump',bamboo)
def wheel():
    for dx in (0,0.3): prim('torus',(dx,0,1.0),rot=(0,math.radians(90),0),col='#5E3C24',major_radius=1.1,minor_radius=0.06,major_segments=12,minor_segments=3)
    for k in range(8):
        a=k*2*math.pi/8
        prim('cube',(0.15,math.cos(a)*0.6,1.0+math.sin(a)*0.6),(0.03,0.03,0.6),rot=(-a,0,0),col='#8A5A36')
        prim('cube',(0.15,math.cos(a)*1.15,1.0+math.sin(a)*1.15),(0.22,0.05,0.16),rot=(-a,0,0),col='#B8C94A')
    prim('cylinder',(0.15,0,1.0),(0.12,0.12,0.4),rot=(0,math.radians(90),0),col='#5E3C24',vertices=8)
    for k in range(5): prim('cylinder',(0.8+k*0.5,1.2,2.0-k*0.05),(0.07,0.07,0.28),rot=(0,math.radians(90),0),col='#B8C94A',vertices=6)
template('BR_waterwheel',wheel)
def buffalo():
    blob((0,0,0),0.75,1.6,0.95,0.75,'#4E4A55',sub=1,amp=0.06,seed=3); blob((-1.15,-0.1,0.25),0.4,1.1,0.9,0.9,'#4E4A55',sub=1,seed=4)
    for e in (-1,1): prim('cylinder',(-1.25,e*0.35,0.65),(0.05,0.05,0.25),rot=(e*0.9,0,0),col='#E8D7A8',vertices=5)
template('BR_buffalo',buffalo)
template('BR_cormorant',lambda:(blob((0,0,0.45),0.2,0.9,0.9,1.4,'#22262E',sub=1),blob((0,-0.08,0.82),0.11,col='#22262E',sub=1),prim('cone',(0,-0.2,0.82),rot=(math.radians(90),0,0),col='#E8A030',vertices=4,radius1=0.03,radius2=0,depth=0.14)))
def reeds():
    R=random.Random(9)
    for k in range(9):
        hh=R.uniform(0.8,1.8); prim('cone',(R.gauss(0,0.5),R.gauss(0,0.35),hh/2-0.25),rot=(R.uniform(-.25,.25),R.uniform(-.25,.25),R.uniform(0,6)),col='#4E9A3A' if k%3 else '#8CC24A',vertices=3,radius1=0.05,radius2=0,depth=hh)
template('BR_reed_clump',reeds)
template('BR_lilypad',lambda:blob((0,0,0),0.35,1.4,1,0.08,'#5CC24A',sub=1,amp=0.2,seed=1))
def duck(s=1.0):
    blob((0,0,0),0.28*s,1.4,0.9,0.7,'#F4F0E6',sub=1,amp=0.08,seed=1); blob((-0.28*s,0,0.24*s),0.15*s,col='#F4F0E6',sub=1)
    prim('cone',(-0.45*s,0,0.22*s),rot=(0,math.radians(-90),0),col='#F09A30',vertices=5,radius1=0.06*s,radius2=0,depth=0.14*s)
template('BR_duck',duck); template('BR_duckling',lambda:duck(0.65))
def netline():
    for k in range(6):
        t=k/5; prim('uv_sphere',(t*4.0,0.6*math.sin(t*math.pi),0.05),(0.13,0.13,0.1),col='#E8553A' if k%2 else '#F4EEDC',segments=8,ring_count=4)
    for k in range(5): prim('cylinder',(0.4+k*0.8,0.6*math.sin((k+0.5)/5*math.pi),0.03),(0.01,0.42,0.01),rot=(0,math.radians(90),math.radians(90)+0.3),col='#C99B5A',vertices=4)
template('BR_net_floats',netline)
def cloud():
    R=random.Random(2)
    for b in range(5): blob((R.uniform(-1,1),0,R.uniform(-0.2,0.3)),R.uniform(0.5,0.9),1,0.7,0.7,'#FFFFFF' if b%3 else '#C8DCEC',sub=1,amp=0.15,seed=b)
template('BR_cloud',cloud)
template('BR_mist_card',lambda:prim('plane',(0,0,0),(1,0.5,1),rot=(math.radians(80),0,0),col='#EEF7F6'),mat=M_MIST)
# ---- board: the raft itself is the board; each cell is a bamboo basket lashed to the raft ----
n=7; cell=0.98; W=n*cell
def raft():
    for j in range(n):
        y=(j-3)*cell
        for t in (-1,0,1): prim('cylinder',(0,y+t*cell*0.31,0),(0.14,0.14,W/2),rot=(0,math.radians(90),0),col='#B8C94A' if (j+t)%2 else '#8AAA3A',vertices=6)
        for i in range(0,n+1,2): prim('cylinder',(-W/2+i*cell,y,0),(0.16,0.46,0.16),rot=(0,math.radians(90),0),col='#56702A',vertices=6)
    for i in (0,2,4,6):
        x=(i-3)*cell; prim('cube',(x,0,0.17),(0.05,W/2,0.04),col='#5E3C24')
        for j in range(n): prim('torus',(x,(j-3)*cell+cell*0.45,0.12),rot=(0,math.radians(90),0),col='#D9A860',major_radius=0.17,minor_radius=0.03,major_segments=6,minor_segments=3)
    for e in (-1,1):
        prim('cylinder',(e*(W/2+0.2),0,0.03),(0.2,0.2,W/2+0.15),rot=(math.radians(90),0,0),col='#8AAA3A',vertices=8)
        for j in range(n): prim('torus',(e*(W/2+0.2),(j-3)*cell,0.03),rot=(math.radians(90),0,0),col='#56702A',major_radius=0.21,minor_radius=0.03,major_segments=8,minor_segments=3)
        prim('cube',(e*(W/2+0.2),0,-0.2),(0.215,W/2+0.15,0.03),col='#4E5E22')   # wet waterline band
        prim('cube',(0,e*(W/2+0.05),-0.2),(W/2+0.35,0.05,0.03),col='#4E5E22')
template('BR_raft',raft)
def basket():
    prim('cylinder',(0,0,0.1),(0.36,0.36,0.08),col='#C9A35A',vertices=8)            # woven bamboo basket, open top
    prim('torus',(0,0,0.19),col='#8A6A30',major_radius=0.37,minor_radius=0.035,major_segments=8,minor_segments=3)
    for k in range(4): prim('cube',(0,0,0.1),(0.37,0.012,0.085),rot=(0,0,k*math.pi/4),col='#A88440')
template('BR_basket',basket)
template('BR_contact_shadow',lambda:prim('plane',(0,0,0),(W/2+0.6,W/2+0.5,1),col='#0A2A30'),mat=vcmat('M_BR_shadow',1.0,alpha=0.35))
template('BR_ripple_arc',lambda:prim('plane',(0,0,0),(0.35,0.018,1),col='#DFF6F0'),mat=vcmat('M_BR_ripple',1.0,alpha=0.35,emit=0.3))
def corner_pole():
    prim('cylinder',(0,0,0.8),(0.04,0.04,0.8),col='#5E3C24',vertices=5); prim('cone',(0,0,1.62),col='#E8C77A',vertices=8,radius1=0.32,radius2=0.02,depth=0.18)
template('BR_corner_hat_pole',corner_pole)
# pieces (sit inside baskets; same footprint ~0.5 m)
def p_melon():
    prim('cylinder',(0,0,0.2),rot=(math.radians(35),0,0),col='#E0646A',vertices=10,radius=0.24,depth=0.1)
    prim('cylinder',(0,0.02,0.19),rot=(math.radians(35),0,0),col='#2E9A3E',vertices=10,radius=0.27,depth=0.08)
def p_pod():
    prim('cylinder',(0,0,0.15),(0.27,0.27,0.13),col='#C8D04A',vertices=10)
    for d in range(6): prim('cylinder',(0.15*math.cos(d*1.05),0.15*math.sin(d*1.05),0.29),(0.045,0.045,0.01),col='#8A6A10',vertices=5)
def p_hat():
    prim('cone',(0,0,0.16),col='#F0B050',vertices=10,radius1=0.33,radius2=0.02,depth=0.24); prim('torus',(0,0,0.05),col='#9A6A2A',major_radius=0.32,minor_radius=0.025,major_segments=10,minor_segments=3)
def p_peb(): blob((0,0,0.14),0.27,1,1,0.6,'#4F86C8',sub=1,amp=0.04,seed=2)
def p_dfly():
    prim('cylinder',(0,0,0.2),(0.05,0.05,0.28),rot=(0,math.radians(90),0),col='#8A62D0',vertices=5); prim('uv_sphere',(0.28,0,0.2),(0.07,0.07,0.07),col='#8A62D0',segments=6,ring_count=4)
    for d in (-1,1):
        for e in (-0.05,0.1): prim('uv_sphere',(e,d*0.17,0.22),(0.07,0.17,0.012),col='#F2F8FF',segments=6,ring_count=3)
def p_lotus():
    for d in range(6): prim('uv_sphere',(0.13*math.cos(d*1.05),0.13*math.sin(d*1.05),0.18),(0.11,0.18,0.07),rot=(0.5,0,d*1.05+1.57),col='#EE8CB8',segments=6,ring_count=4)
    prim('uv_sphere',(0,0,0.23),(0.08,0.08,0.06),col='#C8D04A',segments=6,ring_count=3)
PIECES={'BR_piece_melon':p_melon,'BR_piece_pod':p_pod,'BR_piece_hat':p_hat,'BR_piece_pebble':p_peb,'BR_piece_dragonfly':p_dfly,'BR_piece_lotus':p_lotus}
for k,f in PIECES.items(): template(k,f)
ASSETS.hide_render=True; ASSETS.hide_viewport=True
for lc in vl.layer_collection.children:
    if lc.collection==ASSETS: lc.exclude=True
# ====================================== LAYOUT ======================================
WL=-0.25   # water level (top of river plane)
inst('BR_river',(0,40,-0.05))
R=random.Random(7)
for L,(y,names,nn,span,sr) in enumerate([(122,['BR_peak_far_A','BR_peak_far_B'],10,50,(0.8,1.2)),(92,['BR_peak_mid_A','BR_peak_mid_B'],8,41,(0.75,1.15)),(68,['BR_peak_near_A','BR_peak_near_B','BR_peak_near_C'],6,32,(0.8,1.1))]):
    xs=sorted(R.uniform(-span,span) for _ in range(nn))
    for k,x in enumerate(xs):
        if L==2 and abs(x)<8: x=8.5*(1 if x>=0 else -1)+x*0.3
        s=R.uniform(*sr); inst(R.choice(names),(x,y+R.uniform(-6,6),0),rz=R.uniform(0,6.28),s=(s,s,s*R.uniform(0.85,1.3)))
    for q in range(8 if L<2 else 6):
        if R.random()<0.3: continue
        inst('BR_mist_card',(R.uniform(-span,span),y-7+R.uniform(-3,3),1.2),s=(R.uniform(9,16),1,R.uniform(2.2,4.0)))
inst('BR_bank_L',(-8.6,10,0)); inst('BR_bank_R',(8.6,8,0))
inst('BR_stilt_house',(-9,12,0)); inst('BR_pier',(-6.9,8.2,0)); inst('BR_moored_raft',(-4.6,9.0,0))
for p in [(-10.5,8.0),(-7.6,14.5),(10.2,10.5),(8.0,13.5)]: inst('BR_bamboo_clump',(p[0],p[1],0),rz=R.uniform(0,6.28),s=R.uniform(0.9,1.1))
inst('BR_waterwheel',(6.4,8.6,0)); inst('BR_buffalo',(9.2,5.6,0),rz=0.2)
for p in [(-3.3,-3.9),(4.6,-2.6),(-4.6,-1.6),(-2.6,-4.6),(5.4,-3.6)]: inst('BR_reed_clump',(p[0],p[1],0),rz=R.uniform(0,6.28),s=R.uniform(0.8,1.2))
for p in [(-3.9,-3.0),(-2.9,-2.8),(4.2,-1.7),(5.2,-2.9),(-4.6,-4.1)]: inst('BR_lilypad',(p[0],p[1],WL+0.01),rz=R.uniform(0,6.28),s=R.uniform(0.8,1.3))
inst('BR_duck',(-2.4,-3.2,WL+0.13)); inst('BR_duckling',(-1.7,-3.6,WL+0.09)); inst('BR_duckling',(-1.1,-3.9,WL+0.09),rz=0.15)
inst('BR_net_floats',(1.0,-4.4,WL))
for k,(x,y,z,s) in enumerate([(26,150,30,10),(-6,155,34,9),(-34,145,27,8),(46,140,24,7)]): inst('BR_cloud',(x,y,z),s=s)
# clouds on the sun path -> real cloud shadows on river (same method as concept)
sun_rot=(math.radians(58),0,math.radians(-108)); dv=Vector((0,0,-1)); dv.rotate(__import__('mathutils').Euler(sun_rot))
for k,tg in enumerate([(-3,24,0),(4,40,0),(-12,66,5),(2,14,0)]):
    t=(26-tg[2])/(-dv.z); c=Vector(tg)-dv*t; inst('BR_cloud',tuple(c),rz=R.uniform(0,6),s=(4,3,1.4))
# board (raft) — sunk 0.22 into water
bx,by=0,2.7; RZ=WL+0.03
inst('BR_contact_shadow',(bx+0.25,by-0.15,WL+0.005),c=BOARD)
inst('BR_raft',(bx,by,RZ),c=BOARD)
for e1 in (-1,1):
    for e2 in (-1,1): inst('BR_corner_hat_pole',(bx+e1*(W/2+0.2),by+e2*(W/2-0.1),RZ+0.1),c=BOARD)
inst('BR_cormorant',(bx-W/2-0.1,by+W/2,RZ+0.05),c=BOARD)
kinds=list(PIECES); rr=random.Random(2026)
while True:
    bag=[kinds[q%6] for q in range(49)]; rr.shuffle(bag); G={(i,j):bag[i*n+j] for i in range(n) for j in range(n)}
    if not any((i>=2 and G[i,j]==G[i-1,j]==G[i-2,j]) or (j>=2 and G[i,j]==G[i,j-1]==G[i,j-2]) for i in range(n) for j in range(n)): break
for i in range(n):
    for j in range(n):
        x=bx+(i-3)*cell; y=by+(j-3)*cell
        inst('BR_basket',(x,y,RZ+0.14),rz=rr.uniform(-0.2,0.2),c=BOARD)
        inst(G[i,j],(x,y,RZ+0.18),s=1.2,c=BOARD)
for r_ in range(3):
    for k in range(44):
        a=2*math.pi*k/44
        if noise.noise(Vector((math.cos(a)*1.7,math.sin(a)*1.7,r_*3.1)))+rr.uniform(-0.25,0.25)<0.0: continue
        sx=(W/2+0.5+0.35*r_+0.25*noise.noise(Vector((a,r_,0))))*1.05; sy=sx*(1.0+(0.175*(1-math.sin(a)) if math.sin(a)<0 else 0))
        inst('BR_ripple_arc',(bx+math.cos(a)*sx,by+math.sin(a)*sy-0.2*r_,WL+0.012),rz=a+math.pi/2,s=rr.uniform(0.75,1.3),c=BOARD)
# ====================================== CAMERA / LIGHTS / PREVIEW ======================================
cd=bpy.data.cameras.new('CAM_board'); cd.lens=30; cd.clip_start=0.1; cd.clip_end=1000
co=bpy.data.objects.new('CAM_board',cd); sc.collection.objects.link(co); co.location=(0,-12.5,9.0)
co.rotation_euler=(Vector((0,6.5,1.3))-Vector(co.location)).to_track_quat('-Z','Y').to_euler(); sc.camera=co
def sun(name,rot,col,e,ang):
    l=bpy.data.lights.new(name,'SUN'); l.energy=e; l.color=hx(col); l.angle=math.radians(ang)
    o=bpy.data.objects.new(name,l); sc.collection.objects.link(o); o.rotation_euler=rot; return o
sun('SUN_key',sun_rot,'#FFE2A8',9.0,0.6); sun('SUN_sky_fill',(math.radians(60),0,math.radians(60)),'#7FC8FF',0.5,8)
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(*hx('#8FD0F0'),1); w.node_tree.nodes['Background'].inputs[1].default_value=0.8
# sky backdrop helper (FX_, not exported)
bpy.ops.mesh.primitive_plane_add(location=(0,170,40),rotation=(math.radians(90),0,0)); sk=bpy.context.active_object; sk.name='FX_sky'; sk.scale=(200,110,1)
m=bpy.data.materials.new('M_FX_sky'); m.use_nodes=True; nt=m.node_tree; nt.nodes.clear(); out=nt.nodes.new('ShaderNodeOutputMaterial'); em=nt.nodes.new('ShaderNodeEmission')
tc=nt.nodes.new('ShaderNodeTexCoord'); sp=nt.nodes.new('ShaderNodeSeparateXYZ'); rp=nt.nodes.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['UV'],sp.inputs[0]); nt.links.new(sp.outputs['Y'],rp.inputs[0]); rp.color_ramp.elements[0].color=(*hx('#8FE2FF'),1); rp.color_ramp.elements[1].color=(*hx('#0560D8'),1)
nt.links.new(rp.outputs[0],em.inputs[0]); em.inputs[1].default_value=0.85; nt.links.new(em.outputs[0],out.inputs[0]); sk.data.materials.append(m)
for c_ in sk.users_collection: c_.objects.unlink(sk)
FX.objects.link(sk)
sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x,sc.render.resolution_y=720,1280; sc.eevee.taa_render_samples=24
sc.view_settings.view_transform='AgX'
try: sc.view_settings.look='AgX - Punchy'
except: pass
try: sc.eevee.use_raytracing=True
except: pass
tri=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in sc.objects if o.type=='MESH' and o.name.endswith(tuple('0123456789')) and '_i' in o.name)
print('S2_SCENE_TRIS',tri,'INSTANCES',sum(N.values()),'TEMPLATES',len(ASSETS.objects))
os.makedirs(os.path.dirname(OUT),exist_ok=True); bpy.ops.wm.save_as_mainfile(filepath=OUT)
if PREV:
    sc.render.filepath=PREV; bpy.ops.render.render(write_still=True); print('PREVIEW_DONE',PREV)
