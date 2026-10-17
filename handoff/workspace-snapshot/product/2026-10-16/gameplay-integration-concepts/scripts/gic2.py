# 玩法融合方案集 v2   blender -b -P gic2.py -- <scene> <out.png>
import bpy, math, random, sys
from mathutils import Vector, Euler, Matrix
from bpy_extras.object_utils import world_to_camera_view as w2c
argv=sys.argv[sys.argv.index('--')+1:]; SCENE,OUT=argv[0],argv[1]
random.seed(11); R=math.radians
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE'; sc.eevee.taa_render_samples=48
sc.render.resolution_x=720; sc.render.resolution_y=1280; sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX'
try: sc.view_settings.look='AgX - Punchy'
except Exception: pass
MATS={}
def mat(c,e=0.0,rough=0.75,a=1.0):
    k=(tuple(round(x,3) for x in c),e,rough,a)
    if k in MATS: return MATS[k]
    m=bpy.data.materials.new('m%d'%len(MATS)); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*c,1); b.inputs['Roughness'].default_value=rough
    if e>0: b.inputs['Emission Color'].default_value=(*c,1); b.inputs['Emission Strength'].default_value=e
    if a<1:
        b.inputs['Alpha'].default_value=a
        try: m.surface_render_method='BLENDED'
        except Exception: pass
    MATS[k]=m; return m
def put(o,c,e=0,rough=0.75,a=1):
    o.data.materials.append(mat(c,e,rough,a))
    for p in o.data.polygons: p.use_smooth=False
    return o
def box(loc,s,c,rot=(0,0,0),bevel=0,seg=2,**k):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot); o=bpy.context.object; o.scale=s
    if bevel:
        bpy.ops.object.transform_apply(scale=True); m=o.modifiers.new('b','BEVEL'); m.width=bevel; m.segments=seg
    return put(o,c,**k)
def cyl(loc,rad,d,c,v=8,rot=(0,0,0),r2=None,**k):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=rad,depth=d,location=loc,rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=rad,radius2=r2,depth=d,location=loc,rotation=rot)
    return put(bpy.context.object,c,**k)
def ico(loc,rad,c,sub=1,s=(1,1,1),rot=(0,0,0),**k):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=rad,location=loc,rotation=rot); o=bpy.context.object; o.scale=s
    return put(o,c,**k)
def torus(loc,R1,r1,c,rot=(0,0,0),**k):
    bpy.ops.mesh.primitive_torus_add(major_radius=R1,minor_radius=r1,location=loc,rotation=rot,major_segments=16,minor_segments=6); return put(bpy.context.object,c,**k)
def poly(pts,loc,c,th=0.06,rot=(0,0,0),s=1.0,**k):
    me=bpy.data.meshes.new('p'); n=len(pts)
    vs=[(x*s,y*s,-th/2) for x,y in pts]+[(x*s,y*s,th/2) for x,y in pts]
    fs=[list(range(n))[::-1],list(range(n,2*n))]+[[i,(i+1)%n,n+(i+1)%n,n+i] for i in range(n)]
    me.from_pydata(vs,[],fs); o=bpy.data.objects.new('p',me); sc.collection.objects.link(o)
    o.location=loc; o.rotation_euler=rot; return put(o,c,**k)
def star_pts(Ro=0.38,ri=0.17,n=5): return [((Ro if i%2==0 else ri)*math.sin(i*math.pi/n),(Ro if i%2==0 else ri)*math.cos(i*math.pi/n)) for i in range(2*n)]
def sky(cols,strength=0.8):
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; N=nt.nodes
    bg=N['Background']; tc=N.new('ShaderNodeTexCoord'); sp=N.new('ShaderNodeSeparateXYZ'); mr=N.new('ShaderNodeMapRange'); cr=N.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'],sp.inputs[0]); nt.links.new(sp.outputs[2],mr.inputs[0]); mr.inputs[1].default_value=-0.6; mr.inputs[2].default_value=0.8
    nt.links.new(mr.outputs[0],cr.inputs[0]); nt.links.new(cr.outputs[0],bg.inputs[0]); e=cr.color_ramp
    e.elements[0].position=cols[0][0]; e.elements[0].color=(*cols[0][1],1); e.elements[1].position=cols[-1][0]; e.elements[1].color=(*cols[-1][1],1)
    for p,c in cols[1:-1]: e.elements.new(p).color=(*c,1)
    bg.inputs[1].default_value=strength
def sun(rot,energy,c,ang=4):
    d=bpy.data.lights.new('s','SUN'); d.energy=energy; d.color=c; d.angle=R(ang)
    o=bpy.data.objects.new('s',d); sc.collection.objects.link(o); o.rotation_euler=[R(a) for a in rot]
def point(loc,energy,c,r=0.5):
    d=bpy.data.lights.new('p','POINT'); d.energy=energy; d.color=c; d.shadow_soft_size=r
    o=bpy.data.objects.new('p',d); sc.collection.objects.link(o); o.location=loc
ORANGE=[(0.95,0.32,0.04),(0.85,0.1,0.04),(1.0,0.62,0.05),(0.7,0.06,0.05),(0.95,0.45,0.08)]
# ------------- pieces (local z-up, centred at loc, footprint ~0.8*s) -------------
def piece(kind,loc,s=1.0):
    x,y,z=loc; S=s
    if kind=='leaf':
        poly([(0,.42),(.15,.22),(.38,.25),(.25,.05),(.33,-.18),(.09,-.13),(0,-.4),(-.09,-.13),(-.33,-.18),(-.25,.05),(-.38,.25),(-.15,.22)],(x,y,z+.06*S),(0.9,0.12,0.04),th=.1*S,s=S)
    elif kind=='acorn': ico((x,y-.04*S,z+.2*S),.26*S,(0.75,0.42,0.12),s=(1,1,.85)); cyl((x,y+.14*S,z+.2*S),.27*S,.14*S,(0.38,0.2,0.07),rot=(R(90),0,0),r2=.18*S)
    elif kind=='mush': cyl((x,y-.1*S,z+.1*S),.1*S,.2*S,(0.97,0.92,0.8)); ico((x,y+.05*S,z+.2*S),.36*S,(0.92,0.1,0.1),s=(1,1,.5)); [ico((x+dx*S,y+dy*S,z+.36*S),.05*S,(1,1,1)) for dx,dy in((.1,.05),(-.12,.12),(.02,-.12))]
    elif kind=='cone':
        for k in range(4): cyl((x,y,z+(.1+k*.13)*S),(.3-k*.06)*S,.14*S,(0.5-k*.04,0.26,0.08),v=7,r2=(.22-k*.05)*S)
    elif kind=='chest': ico((x,y,z+.2*S),.32*S,(0.5,0.18,0.06),s=(1,.85,.62),sub=2,rough=.35); ico((x,y+.15*S,z+.3*S),.12*S,(0.85,0.75,0.55),s=(1,.6,.4))
    elif kind=='ticket': box((x,y,z+.07*S),(.72*S,.46*S,.1*S),(1.0,0.75,0.08),bevel=.04*S); box((x+.18*S,y,z+.13*S),(.05*S,.4*S,.02*S),(0.75,0.25,0.1))
    elif kind=='star': poly(star_pts(),(x,y,z+.1*S),(1.0,0.75,0.15),th=.16*S,s=S,e=1.6)
    elif kind=='moon':
        pts=[(math.cos(a)*.38,math.sin(a)*.38) for a in [R(d) for d in range(-120,121,20)]]+[(math.cos(a)*.24+.14,math.sin(a)*.3) for a in [R(d) for d in range(110,-111,-20)]]
        poly(pts,(x,y,z+.1*S),(1.0,0.92,0.55),th=.16*S,s=S,e=1.0)
    elif kind=='comet': ico((x+.15*S,y+.15*S,z+.18*S),.17*S,(0.55,0.95,1.0),e=2); poly([(0,.12),(-.42,-.36),(.12,0)],(x+.1*S,y+.1*S,z+.12*S),(0.3,0.75,1.0),th=.06*S,s=S,e=1.2)
    elif kind=='planet': ico((x,y,z+.22*S),.24*S,(0.95,0.4,0.55),sub=2,rough=.4); cyl((x,y,z+.2*S),.4*S,.03*S,(1,0.7,0.3),v=16)
    elif kind=='scope': cyl((x,y,z+.15*S),.12*S,.62*S,(0.4,0.3,0.85),rot=(R(90),0,R(35)),r2=.07*S); cyl((x,y,z+.06*S),.2*S,.08*S,(0.75,0.6,0.25))
    elif kind=='book': box((x+.03*S,y,z+.07*S),(.52*S,.6*S,.12*S),(0.98,0.95,0.85)); box((x,y,z+.15*S),(.58*S,.66*S,.04*S),(0.1,0.6,0.45)); poly(star_pts(.12,.05),(x,y,z+.18*S),(1,0.8,0.2),th=.02,s=S)
    elif kind=='cloud':
        for dx,dz,r in ((-.17,.17,.18),(.17,.17,.18),(0,.27,.24)): ico((x+dx*S,y,z+dz*S),r*S,(1,0.98,1),sub=2)
    elif kind=='dawn': ico((x,y,z+.22*S),.3*S,(1.0,0.45,0.15),sub=1,e=.8,rough=.3)
    elif kind=='crane':
        poly([(-.42,0),(0,.12),(.42,0),(0,-.08)],(x,y,z+.2*S),(1,1,1),th=.04*S,s=S); poly([(0,0),(.14,0),(0,.36)],(x,y,z+.14*S),(0.95,0.3,0.35),th=.04*S,s=S,rot=(R(90),0,0))
    elif kind=='feather': ico((x,y,z+.12*S),.38*S,(0.1,0.7,0.85),s=(.35,1,.25),rot=(0,0,R(30)))
    elif kind=='whistle': cyl((x,y,z+.18*S),.15*S,.5*S,(1.0,0.78,0.1),rot=(0,R(90),R(20)),v=10,rough=.3); torus((x-.25*S,y-.1*S,z+.18*S),.08*S,.025*S,(0.6,0.4,0.2))
    elif kind=='pinebranch':
        cyl((x,y,z+.1*S),.03*S,.7*S,(0.4,0.25,0.12),rot=(R(90),0,R(20)))
        for k in range(3): ico((x+(k-1)*.12*S,y+(k-1)*.2*S,z+.18*S),.18*S,(0.1,0.5,0.25),s=(1.4,1,.5))
    elif kind=='jar': cyl((x,y,z+.25*S),.22*S,.5*S,(0.75,0.95,0.9),v=10,a=.4,rough=.1); cyl((x,y,z+.53*S),.16*S,.07*S,(0.6,0.35,0.15)); ico((x,y,z+.28*S),.13*S,(1,0.8,0.15),e=8)
    elif kind=='dand': cyl((x,y,z+.12*S),.025*S,.24*S,(0.3,0.6,0.25)); ico((x,y,z+.36*S),.3*S,(0.98,0.98,0.95),sub=2,e=.3)
    elif kind=='env': box((x,y,z+.06*S),(.66*S,.46*S,.08*S),(0.98,0.93,0.8),bevel=.03*S); poly([(-.33,.23),(.33,.23),(0,-.04)],(x,y,z+.11*S),(0.9,0.3,0.25),th=.01,s=S); ico((x,y+.0,z+.12*S),.07*S,(0.8,0.1,0.15))
    elif kind=='scarf': torus((x,y,z+.12*S),.22*S,.1*S,(1.0,0.75,0.05)); box((x+.15*S,y-.25*S,z+.06*S),(.14*S,.32*S,.06*S),(1.0,0.75,0.05),rot=(0,0,.4))
    elif kind=='strawb': ico((x,y,z+.22*S),.27*S,(0.95,0.12,0.18),s=(1,1,1.15),rough=.35); ico((x,y,z+.48*S),.13*S,(0.2,0.65,0.2),s=(1.3,1.3,.4))
    elif kind=='sandw': box((x,y,z+.1*S),(.64*S,.64*S,.08*S),(0.95,0.8,0.5),rot=(0,0,R(45)),bevel=.03*S); box((x,y,z+.16*S),(.6*S,.6*S,.05*S),(0.4,0.75,0.25),rot=(0,0,R(45))); box((x,y,z+.22*S),(.64*S,.64*S,.08*S),(0.95,0.8,0.5),rot=(0,0,R(45)),bevel=.03*S)
    elif kind=='plane': poly([(0,.42),(.34,-.3),(0,-.14),(-.34,-.3)],(x,y,z+.12*S),(0.3,0.6,1.0),th=.05*S,s=S)
    elif kind=='ribbon':
        torus((x-.12*S,y,z+.1*S),.13*S,.06*S,(0.95,0.2,0.6),rot=(0,R(90),0)); torus((x+.12*S,y,z+.1*S),.13*S,.06*S,(0.95,0.2,0.6),rot=(0,R(90),0)); ico((x,y,z+.1*S),.08*S,(0.95,0.2,0.6))
    elif kind=='bell': cyl((x,y,z+.2*S),.3*S,.4*S,(1.0,0.72,0.15),v=10,r2=.12*S,rough=.25); ico((x,y,z+.42*S),.07*S,(0.8,0.5,0.1))
    elif kind=='fish': ico((x,y,z+.18*S),.3*S,(0.1,0.65,0.95),s=(1,.5,.5)); poly([(0,0),(.22,.18),(.22,-.18)],(x+.28*S,y,z+.18*S),(0.1,0.5,0.9),th=.05*S,s=S)
    elif kind=='balloon': ico((x,y,z+.3*S),.27*S,(0.95,0.35,0.15),sub=2,s=(1,1,1.1)); box((x,y,z+.03*S),(.14*S,.14*S,.1*S),(0.55,0.35,0.15))
    elif kind=='kitebadge': poly([(0,.42),(.3,.06),(0,-.38),(-.3,.06)],(x,y,z+.08*S),(0.95,0.15,0.25),th=.09*S,s=S); poly([(0,.42),(.3,.06),(0,.06)],(x,y,z+.13*S),(1,0.8,0.1),th=.01,s=S)
# ------------- board on tilted carrier -------------
TILT=None
def carrier(center,tilt):
    global TILT
    e=bpy.data.objects.new('board',None); sc.collection.objects.link(e); e.location=center; e.rotation_euler=(R(tilt),0,0); TILT=e; return e
class Local:
    def __enter__(s): s.n=set(bpy.data.objects.keys()); return s
    def __exit__(s,*a):
        for o in bpy.data.objects:
            if o.name not in s.n and o is not TILT and o.parent is None: o.parent=TILT
def fill(kinds,CY,z,ps=1.0,clear=(),pattern=None):
    for i in range(7):
        for j in range(7):
            k=kinds[(i*2+j*3+(i*j)%5+(j//2))%6] if pattern is None else kinds[pattern(i,j)]
            piece(k,((i-3),(j-3)*CY,z),ps*(1.18 if (i,j) in clear else 1.0))
def ring(i,j,CY,z,col=(1,0.95,0.7)):
    torus(((i-3),(j-3)*CY,z),.47,.04,col,e=5); 
def setup_cam(center,tilt,pitch,lens=55,far_frac=0.88,cy=0.33,z=0.0):
    cd=bpy.data.cameras.new('c'); cd.lens=lens; cd.sensor_fit='VERTICAL'; cd.sensor_height=24; cd.clip_end=800
    cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
    cam.rotation_euler=Euler((R(90-pitch),0,0)); fwd=cam.rotation_euler.to_matrix()@Vector((0,0,-1))
    M=Matrix.Translation(Vector(center))@Euler((R(tilt),0,0)).to_matrix().to_4x4()
    CY=1.0
    for it in range(6):
        W=lambda x,y: M@Vector((x,y*CY,z))
        lo,hi=3,400
        for _ in range(40):
            d=(lo+hi)/2; cam.location=Vector(center)-fwd*d; cd.shift_y=0; bpy.context.view_layer.update()
            a,b=w2c(sc,cam,W(-3.5,3.5)),w2c(sc,cam,W(3.5,3.5))
            if b.x-a.x>far_frac: lo=d
            else: hi=d
        p=[w2c(sc,cam,W(x,y)) for x,y in ((-.5,-.5),(.5,-.5),(-.5,.5))]
        wpx=(p[1].x-p[0].x)*720; hpx=(p[2].y-p[0].y)*1280; CY*=wpx/hpx
    ys=[w2c(sc,cam,W(x,y)).y for x,y in ((-3.5,-3.5),(3.5,3.5))]
    cd.shift_y=((ys[0]+ys[1])/2-cy)*1.0; bpy.context.view_layer.update()
    rep=[]
    for j in (0,3,6):
        q=[w2c(sc,cam,W(x,y)) for x,y in ((-.5,j-3.5),(.5,j-3.5),(-.5,j-2.5))]
        rep.append('row%d %dx%d'%(j,round((q[1].x-q[0].x)*720),round((q[2].y-q[0].y)*1280)))
    ne=[w2c(sc,cam,W(x,-3.5)).x for x in (-3.5,3.5)]; fe=[w2c(sc,cam,W(-3.5,3.5)).y,w2c(sc,cam,W(-3.5,-3.5)).y]
    print('CELL_PX',SCENE,' '.join(rep),'nearEdgeX %.3f-%.3f boardY %.2f-%.2f CY %.3f'%(ne[0],ne[1],fe[1],fe[0],CY))
    return CY
def tree_round(x,y,s,col,z0=0):
    cyl((x,y,z0+1.0*s),.14*s,2*s,(0.35,0.18,0.08),v=5)
    for k in range(3): ico((x+random.uniform(-.5,.5)*s,y+random.uniform(-.3,.3)*s,z0+(2.1+k*.55)*s),random.uniform(.75,1.05)*s,col,sub=1)
def tree_cone(x,y,s,col,snow=False,z0=0):
    cyl((x,y,z0+.4*s),.12*s,.8*s,(0.3,0.16,0.07),v=5)
    for k in range(3):
        cyl((x,y,z0+(1.0+k*.75)*s),(1.0-k*.25)*s,1.1*s,col,v=7,r2=0.05*s)
        if snow: cyl((x,y,z0+(1.33+k*.75)*s),(0.55-k*.15)*s,.48*s,(0.88,0.93,1.0),v=7,r2=0.04*s)
def mountain(x,y,rad,h,col,cap=None):
    cyl((x,y,h/2),rad,h,col,v=7,r2=rad*0.12)
    if cap: cyl((x,y,h*0.82),rad*0.3,h*0.36,cap,v=7,r2=rad*0.04)
def hz(x,y): return 0.0
# =====================================================================
if SCENE=='A_rail_crates':   # 侧面码放的货箱车厢（立面棋盘）
    sky([(0.0,(1.0,0.5,0.2)),(0.43,(1.0,0.62,0.3)),(0.5,(0.35,0.62,1.0)),(1.0,(0.05,0.28,0.95))],0.9)
    sun((55,0,-40),4.0,(1,0.85,0.62))
    box((0,30,-0.5),(200,140,1),(0.55,0.42,0.12))
    # 前景铁轨 + 平板车
    for yy in (-0.9,0.9): box((0,yy,.12),(200,.14,.14),(0.55,0.55,0.6),rough=.3)
    for k in range(-60,61): box((k*.8,0,.03),(.3,2.6,.1),(0.35,0.2,0.1))
    box((0,0,0),(200,4,0.2),(0.5,0.45,0.4))
    box((0,0,1.15),(8.4,2.4,.36),(0.75,0.12,0.08),bevel=.1)
    for xx in (-3,-1.6,1.6,3): cyl((xx,-1.0,.62),.46,.18,(0.15,0.15,0.17),v=12,rot=(R(90),0,0))
    box((0,-1.22,.85),(7.6,.12,.22),(0.2,0.2,0.22))
    # 两侧立柱 + 绑带
    for xx in (-3.95,3.95): box((xx,-0.2,4.9),(.22,.3,7.6),(0.45,0.25,0.12),bevel=.05)
    # 远处：红叶山坡、石拱高架桥+小火车、雪山
    for k in range(14): ico((-90+k*14,125+random.uniform(-6,6),4),random.uniform(8,11),random.choice([(0.85,0.3,0.05),(0.7,0.15,0.05),(0.9,0.55,0.1)]),sub=2,s=(1.3,1,0.75))
    for _ in range(420):
        x=random.uniform(-60,60); y=random.uniform(30,135); tree_round(x,y,random.uniform(1.6,2.6),random.choice(ORANGE),z0=max(0,(y-62)*0.14))
    for _ in range(70): x=random.uniform(-60,60); y=random.uniform(30,150); tree_cone(x,y,random.uniform(1.8,2.8),(0.1,0.38,0.2),z0=max(0,(y-62)*0.14))
    for _ in range(40): tree_round(random.uniform(-12,12),random.uniform(5,25),random.uniform(.8,1.2),random.choice(ORANGE))
    # 高架桥 y=34
    box((0,110,21),(90,2,11),(0.8,0.56,0.4))
    for k in range(-8,9):
        box((k*5,110,8),(2.2,2,16),(0.78,0.55,0.4)); 
    box((0,110,26.6),(80,2.4,1.4),(0.8,0.58,0.42))
    for k in range(-8,8): box((k*5+2.5,108.95,18.5),(2.8,.1,5),(0.22,0.12,0.1)); cyl((k*5+2.5,108.9,21.0),1.4,.12,(0.22,0.12,0.1),v=10,rot=(R(90),0,0))
    box((-8,110,28.6),(5,2,2.6),(0.1,0.4,0.3),bevel=.25); cyl((-9.8,110,30.4),.3,1,(0.15,0.15,0.15))
    for k in range(3): box((-2+k*5.2,110,28.4),(4.8,1.9,2.2),(0.75,0.12,0.1),bevel=.25); box((-2+k*5.2,108.9,28.8),(3.8,.05,.7),(1,0.9,0.6),e=1.5)
    for k in range(9): mountain(-120+k*30,220,random.uniform(22,30),random.uniform(36,48),(0.3,0.38,0.75),cap=(0.95,0.97,1.0))
    cyl((4.6,6,2.2),.1,4.4,(0.3,0.3,0.32)); box((4.6,6,4.6),(.6,.3,1.0),(0.15,0.15,0.17)); ico((4.6,5.82,4.85),.16,(1,0.25,0.15),e=6)
    TILTc=(0,-0.2,1.33+3.5*1.0)
    CY=setup_cam((0,-0.2,1.33+3.5),90,4,lens=55,far_frac=0.9,cy=0.37,z=0.0)
    E=carrier((0,-0.2,1.33+3.5*CY),90)
    with Local():
        for i in range(7):
            for j in range(7):
                t=[(0.88,0.62,0.32),(0.78,0.5,0.24),(0.92,0.7,0.4)][(i*3+j)%3]
                box((i-3,(j-3)*CY,-0.45),(.96,.96*CY,.9),t,bevel=.06)
                box((i-3,(j-3)*CY,0.0),(.8,.8*CY,.04),(0.55,0.32,0.14))
        fill(['leaf','acorn','mush','cone','chest','ticket'],CY,.03,ps=1.05,clear={(4,5),(5,5),(6,5)})
        ring(1,2,CY,.12)
        for k in range(14):
            a=k*.8; poly([(0,.14),(.09,0),(0,-.14),(-.09,0)],(2+math.cos(a)*(.3+k*.06),(2.6+k*.09)*CY,.6+math.sin(a)*.2),random.choice(ORANGE),th=.02,rot=(a,a*.5,a))
elif SCENE=='B_snow_starmap':   # 斜面星图台
    sky([(0.0,(0.12,0.12,0.35)),(0.4,(0.2,0.18,0.48)),(0.6,(0.08,0.1,0.32)),(1.0,(0.02,0.03,0.12))],0.9)
    sun((65,0,35),0.9,(0.55,0.65,1.0)); point((0,-3,6),500,(1,0.65,0.35),3); point((-3,14,4),800,(1,0.6,0.3),2)
    cyl((0,15,-0.5),45,1,(0.72,0.8,0.98),v=24)
    box((0,0,.15),(12,9,.3),(0.45,0.25,0.12),bevel=.15)
    for k in range(-5,6): box((k*1.1,-4.4,.8),(.14,.14,1.3),(0.4,0.22,0.1)); 
    box((0,-4.4,1.4),(12,.16,.16),(0.4,0.22,0.1))
    # 观星台 + 小木屋
    cyl((0,40,7),9,4,(0.6,0.62,0.78),v=9,r2=7); cyl((0,40,11),5,6,(0.82,0.4,0.25),v=16); ico((0,40,14),5.0,(0.75,0.8,0.92),sub=2,s=(1,1,.85),rough=.3)
    box((0,35.8,15.2),(1.3,.8,4.0),(0.05,0.05,0.12)); cyl((0,35.4,16.8),.7,6,(0.85,0.7,0.35),rot=(R(55),0,0),rough=.3)
    for xx in (-2.2,2.2): box((xx,35.15,10.6),(1.1,.1,1.4),(1,0.7,0.35),e=5)
    box((0,35.05,9.4),(1.4,.1,2.4),(0.4,0.2,0.1))
    box((-12,30,6),(5,4,4),(0.55,0.3,0.15)); cyl((-12,30,8.6),3.4,1.8,(0.92,0.95,1.0),v=4,rot=(0,0,R(45)),r2=.2); box((-12,27.95,6.2),(1.2,.1,1.2),(1,0.7,0.35),e=5)
    for _ in range(45):
        x=random.uniform(-22,22); y=random.uniform(6,34)
        if abs(x)<8 and y<48: continue
        tree_cone(x,y,random.uniform(1.4,2.6),(0.05,0.32,0.28),snow=True,z0=max(0,(y-15)*0.3))
    for k in range(12): mountain(-160+k*30,180,random.uniform(20,28),random.uniform(18,30),(0.3,0.32,0.58),cap=(0.85,0.9,1.0))
    for k in range(10): mountain(-120+k*28,110,random.uniform(14,20),random.uniform(8,14),(0.22,0.25,0.5),cap=(0.85,0.9,1.0))
    for band,(col,z0) in enumerate((((0.1,0.95,0.55),26),((0.55,0.35,1.0),34))):
        for k in range(120):
            x=-90+k*1.5; z=z0+math.sin(k*.18+band)*5
            box((x,230+band*10,z),(3.0,.2,5+2*math.sin(k*.3)),col,e=1.0,a=.15)
    for _ in range(420): ico((random.uniform(-160,160),240,random.uniform(20,140)),.4,(1,1,0.9),sub=0,e=8)
    ico((40,240,36),6,(1,0.95,0.8),sub=2,e=4)
    for _ in range(90): ico((random.uniform(-7,7),random.uniform(-6,8),random.uniform(.5,9)),.05,(1,1,1),sub=0,e=1.5)
    CY=setup_cam((0,0,4.0),67,8,lens=55,far_frac=0.9,cy=0.37,z=0.1)
    E=carrier((0,0,4.0),67)
    with Local():
        box((0,0,-.25),(7.8,7*CY+.8,.5),(0.5,0.28,0.12),bevel=.18)
        box((0,0,.03),(7.2,7*CY+.2,.06),(0.02,0.05,0.2),rough=.2)
        for k in range(8):
            box((k-3.5,0,.075),(.03,7*CY,.02),(1,0.78,0.35),e=1.5); box((0,(k-3.5)*CY,.075),(7.0,.03,.02),(1,0.78,0.35),e=1.5)
        for cx,cy_ in ((-3.9,-3.9),(3.9,-3.9),(-3.9,3.9),(3.9,3.9)): ico((cx,cy_*CY,.1),.42,(0.92,0.95,1.0),s=(1,1,.5),sub=2)
        fill(['star','moon','comet','planet','scope','book'],CY,.06,ps=1.05,clear={(1,6),(2,6),(3,6)})
        ring(5,2,CY,.12)
    # 腿
    for xx in (-3,3): box((xx,1.6,1.6),(.4,.4,3.2),(0.4,0.22,0.1),rot=(R(-20),0,0))
    P=[(-2.4,3.5,9.0),(-0.8,4.5,10.4),(1.0,4.0,11.4),(2.6,5,10.6)]
    for p in P: poly(star_pts(.25,.11),p,(1,0.85,0.4),th=.06,e=7,rot=(R(80),0,0))
    for a,b in zip(P,P[1:]):
        m=(Vector(a)+Vector(b))/2; dd=Vector(b)-Vector(a); o=box(tuple(m),(dd.length,.03,.03),(1,0.85,0.5),e=4); o.rotation_euler=dd.to_track_quat('X','Z').to_euler()
elif SCENE=='C_cloud_terrace':   # 崖顶斜石台
    sky([(0.0,(0.95,0.4,0.45)),(0.4,(1.0,0.5,0.3)),(0.5,(1.0,0.62,0.35)),(0.7,(0.45,0.5,0.95)),(1.0,(0.2,0.3,0.85))],0.6)
    sun((78,0,8),2.6,(1,0.66,0.42))
    cyl((0,1.5,-6),6.5,7,(0.5,0.4,0.42),v=9,r2=4.5)
    for _ in range(330):
        x=random.uniform(-70,70); y=random.uniform(-20,110)
        if abs(x)<9 and abs(y-1)<9: continue
        ico((x,y,random.uniform(-6,-3.5)),random.uniform(2,4.5),random.choice([(0.98,0.62,0.62),(1,0.72,0.5),(0.85,0.55,0.8),(0.95,0.68,0.72)]),sub=2,s=(1.5,1,0.55))
    def pinet(x,y,z,s,lean=0.3):
        cyl((x,y,z+1.2*s),.18*s,2.4*s,(0.35,0.2,0.15),v=5,rot=(0,lean,0))
        for k in range(4): cyl((x+(.5*k-.6)*s+lean*2*s,y,z+(2.0+k*.35)*s),(1.5-k*.25)*s,.32*s,(0.08,0.42,0.28),v=7)
    pinet(-4.4,7.5,2.0,1.4,.35); pinet(4.6,8.5,1.6,1.1,-.3)
    for _ in range(12):
        x=random.choice([-1,1])*random.uniform(9,32); y=random.uniform(28,75); h=random.uniform(16,30)
        cyl((x,y,h/2-6),random.uniform(2,3.5),h,(0.55,0.42,0.45),v=6,r2=random.uniform(1.4,2.4)); pinet(x,y,h-6,0.9,random.uniform(-.3,.3))
    for k in range(5): mountain(-60+k*30,130,22,110,(0.6,0.45,0.65))
    ico((-20,200,28),7,(1,0.85,0.5),sub=3,e=3)
    # 断风筝挂在松上
    poly([(0,1),(.7,.1),(0,-.9),(-.7,.1)],(-3.6,7.4,5.2),(0.95,0.15,0.2),th=.05,rot=(R(80),R(15),0))
    CY=setup_cam((0,0,0.9),45,30,lens=45,far_frac=0.9,cy=0.31,z=0.0)
    E=carrier((0,0,0.9),45)
    with Local():
        box((0,0,-.9),(8.3,7*CY+1.0,1.6),(0.55,0.45,0.42),bevel=.4)
        box((0,0,-.12),(7.4,7*CY+.3,.1),(0.25,0.55,0.25))
        for i in range(7):
            for j in range(7):
                t=[(0.66,0.56,0.5),(0.6,0.5,0.46),(0.7,0.6,0.52)][(i*5+j*3)%3]
                box((i-3,(j-3)*CY,-.05),(.92,.92*CY,.14),t,bevel=.09)
        fill(['cloud','dawn','crane','feather','whistle','pinebranch'],CY,.02,ps=1.05,clear={(4,1),(4,2),(4,3)})
        ring(1,4,CY,.08)
        for k in range(8): ico((4.6+k*.25,(1+k*.35)*CY,.6+k*.3),.14+k*.04,(1,0.97,1),sub=2)
        poly([(-.4,0),(0,.12),(.4,0),(0,-.07)],(5.2,3.4*CY,3.0),(1,1,1),th=.03,rot=(0.3,0,0.4))
    for k in range(5): box((0,-6.4+k*0.0,-1.0-k*0.45),(2.4,.9,.4),(0.6,0.5,0.45),rot=(0,0,0)) if False else None
elif SCENE=='D_hill_picnic':   # 坡面野餐布
    sky([(0.0,(1.0,0.45,0.25)),(0.3,(1.0,0.55,0.3)),(0.38,(1.0,0.75,0.45)),(0.55,(0.75,0.5,0.85)),(1.0,(0.3,0.3,0.8))],0.6)
    sun((80,0,12),4.0,(1,0.68,0.4))
    G=(0.22,0.58,0.08)
    box((0,0.74,-0.92),(30,11,2.4),G,rot=(R(36),0,0))            # 坡面
    box((0,-4.59,-8.31),(30,8,8),G,rot=(R(36),0,0))
    box((0,9.5,1.6),(30,8,3.0),G,bevel=.8)                         # 坡顶
    box((0,22,-14),(30,24,4),G,rot=(R(-40),0,0))                   # 后坡下落
    box((0,90,-30.5),(400,140,1),(0.3,0.55,0.12))                    # 谷底
    for _ in range(160):
        x=random.uniform(-14,14); y=random.uniform(5.8,13)
        if abs(x)<4.5 and y<6.5: continue
        ico((x,y,3.15),.12,random.choice([(1,0.95,0.3),(1,1,1),(0.95,0.4,0.6),(0.6,0.4,0.95)]),sub=0)
    for k in range(16):
        box((0,36+k*7.0,-29.6),(400,3.4,1.0),(0.55,0.25,0.9) if k%2==0 else (0.3,0.58,0.12))
    for x,y,h,c in ((-6,70,-12,(0.95,0.25,0.2)),(5,100,-16,(1,0.7,0.15)),(12,60,-8,(0.3,0.6,0.95)),(-12,120,-22,(0.95,0.5,0.7))):
        ico((x,y,h),2.6,c,sub=2,s=(1,1,1.15)); box((x,y,h-3.6),(.9,.9,.8),(0.5,0.3,0.15))
    ico((-14,300,-60),9,(1,0.62,0.3),sub=3,e=1.2)
    # 坡顶大树 + 两人座秋千 + 大风筝
    cyl((2.8,11,5.5),.5,5,(0.4,0.22,0.1),v=6)
    for p in ((2.8,11,8.7),(1.3,11,8.1),(4.3,11.3,7.9),(2.8,10,9.7)): ico(p,2.0,(0.2,0.55,0.15),sub=1)
    box((2.5,9.6,4.3),(2.0,.5,.12),(0.6,0.35,0.15)); 
    for xx in (1.7,3.3): box((xx,9.6,6.3),(.04,.04,3.6),(0.9,0.85,0.7))
    poly([(0,1.6),(1.1,.2),(0,-1.4),(-1.1,.2)],(-2.6,40,-1),(0.95,0.2,0.3),th=.06,rot=(R(75),0,.4))
    for k in range(10): box((-2.4+k*.35,40,-2.6-k*.5),(.12,.12,.45),(1,0.85,0.2))
    CY=setup_cam((0,0,0.1),36,22,lens=80,far_frac=0.88,cy=0.32,z=0.0)
    E=carrier((0,0,0.1),36)
    with Local():
        for i in range(7):
            for j in range(7):
                t=(1.0,0.88,0.7) if (i+j)%2==0 else (0.6,0.32,0.85)
                box((i-3,(j-3)*CY,0),(1.0,1.0*CY,.03),t)
        box((0,0,-.04),(7.5,7*CY+.5,.04),(0.95,0.85,0.7),bevel=.35)
        fill(['jar','kitebadge','env','scarf','strawb','dand'],CY,.02,ps=1.12,clear={(5,2),(5,3),(5,4)})
        ring(1,1,CY,.08)
        for _ in range(40): ico((random.uniform(4,7.5),random.uniform(2,6)*CY,random.uniform(.6,3)),.05,random.choice([(1,1,0.95),(1,0.85,0.3)]),sub=0,e=4)
elif SCENE=='E_sky_kite':   # 云海上空的大风筝（立面棋盘）
    sky([(0.0,(1.0,0.45,0.4)),(0.42,(1.0,0.6,0.35)),(0.445,(1.0,0.75,0.5)),(0.5,(0.3,0.58,1.0)),(1.0,(0.05,0.25,0.95))],0.75)
    sun((70,0,-25),4.0,(1,0.85,0.65))
    for _ in range(300):
        x=random.uniform(-80,80); y=random.uniform(0,140)
        ico((x,y,random.uniform(-14,-10)),random.uniform(3,6),random.choice([(1,0.7,0.68),(1,0.8,0.6),(0.88,0.66,0.9)]),sub=2,s=(1.5,1,0.5))
    for x,y,h in ((-6,50,38),(-12,90,48),(9,80,46),(3,130,56),(-3,105,50)):
        cyl((x,y,h/2-14),3.4,h,(0.6,0.42,0.42),v=6,r2=2.2)
        for k in range(3): cyl((x+k*.8-.8,y,h-13+k*.6),3.0-k*.6,.6,(0.08,0.45,0.3),v=7)
    for k in range(5): mountain(-60+k*30,150,24,30,(0.6,0.5,0.7))
    for k in range(6): ico((-12+k*5,25,8+math.sin(k)*2),random.uniform(1.5,2.4),(1,0.97,1),sub=2,s=(1.6,1,0.7))
    # 风筝线 + 远处小人
    CY=setup_cam((0,0,6),90,-2,lens=55,far_frac=0.88,cy=0.36,z=0.0)
    E=carrier((0,0,6),90)
    with Local():
        poly([(-4.3,-3.2*CY),(-3.2,-4.3*CY),(3.2,-4.3*CY),(4.3,-3.2*CY),(4.3,3.2*CY),(3.2,4.3*CY),(-3.2,4.3*CY),(-4.3,3.2*CY)],(0,0,-.08),(0.95,0.25,0.3),th=.1)
        for i in range(7):
            for j in range(7):
                box((i-3,(j-3)*CY,-.01),(.94,.94*CY,.04),[(1,0.92,0.75),(0.99,0.85,0.65)][(i+j)%2],bevel=.05)
        for k in range(8):
            box((k-3.5,0,.03),(.06,7*CY+.2,.06),(0.85,0.65,0.3)); box((0,(k-3.5)*CY,.03),(7.2,.06,.06),(0.85,0.65,0.3))
        fill(['plane','ribbon','bell','fish','balloon','kitebadge'],CY,.04,ps=1.05,clear={(2,0),(3,0),(4,0)})
        ring(5,5,CY,.1)
        for k in range(9): box((-.6+k*.12,(-4.6-k*.45)*CY,.2+math.sin(k)*.2),(.5,.12,.03),[(0.95,0.2,0.6),(1,0.8,0.1),(0.2,0.6,1)][k%3],rot=(0,0,k*.5))
    for k in range(10): box((-.2-k*.5,-4.6-k*.15,1.4-k*.9),(.12,.12,.9),[(0.95,0.25,0.3),(1,0.8,0.1)][k%2],rot=(0,R(25),0))
    cyl((6,45,3),3.6,34,(0.6,0.42,0.42),v=7,r2=2.4); ico((6,45,20.2),2.6,(0.2,0.55,0.25),s=(1.2,1.2,.3))
    cyl((6,44,21.4),.35,1.8,(0.95,0.95,0.92),v=8); ico((6,44,22.6),.42,(0.35,0.2,0.12)); box((6.1,43.6,21.9),(.9,.2,.2),(1,0.75,0.05))   # 阿芳+黄围巾
    st=Vector((6,44,22.2)); en=Vector((0,0.05,2.0)); m=(st+en)/2; dd=en-st
    o=box(tuple(m),(dd.length,.03,.03),(1,1,1)); o.rotation_euler=dd.to_track_quat('X','Z').to_euler()
    ico((-10,170,48),7,(0.7,0.62,0.95),sub=2,s=(2.2,1,0.7),a=.6); poly([(0,0),(3.5,3),(3.5,-3)],(5,170,48),(0.7,0.62,0.95),th=.3,a=.6,rot=(R(90),0,0))  # 云鲸影
    for k in range(5): poly([(-.5,0),(0,.15),(.5,0),(0,-.1)],(-5+k*2.0,30,18.5+k%2*1.5),(1,1,1),th=.05,rot=(R(25),0,k*.4))  # 纸鹤群
sc.render.filepath=OUT
bpy.ops.render.render(write_still=True)
print('TRIS',sum(len(o.data.polygons) for o in sc.objects if o.type=='MESH'))
