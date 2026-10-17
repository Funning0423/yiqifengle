# 玩法融合方案集 概念图生成  blender -b -P gic.py -- <scene> <out.png>
import bpy, math, random, sys
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view as w2c
argv=sys.argv[sys.argv.index('--')+1:]; SCENE, OUT = argv[0], argv[1]
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE'; sc.eevee.taa_render_samples=32
sc.render.resolution_x=720; sc.render.resolution_y=1280; sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX'
try: sc.view_settings.look='AgX - Medium High Contrast'
except Exception: pass
MATS={}
def mat(c,e=0.0,r=0.8,a=1.0):
    k=(tuple(round(x,3) for x in c),e,r,a)
    if k in MATS: return MATS[k]
    m=bpy.data.materials.new('m%d'%len(MATS)); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*c,1); b.inputs['Roughness'].default_value=r
    if e>0:
        b.inputs['Emission Color'].default_value=(*c,1); b.inputs['Emission Strength'].default_value=e
    if a<1:
        b.inputs['Alpha'].default_value=a
        try: m.surface_render_method='BLENDED'
        except Exception: pass
    MATS[k]=m; return m
def put(o,c,e=0,r=0.8,a=1,smooth=False):
    o.data.materials.append(mat(c,e,r,a))
    if not smooth:
        for p in o.data.polygons: p.use_smooth=False
    return o
def box(loc,s,c,rot=(0,0,0),bevel=0,**k):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot); o=bpy.context.object; o.scale=s
    if bevel:
        bpy.ops.object.transform_apply(scale=True); m=o.modifiers.new('b','BEVEL'); m.width=bevel; m.segments=2
    return put(o,c,**k)
def cyl(loc,r,d,c,v=8,rot=(0,0,0),r2=None,**k):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=loc,rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r,radius2=r2,depth=d,location=loc,rotation=rot)
    return put(bpy.context.object,c,**k)
def ico(loc,r,c,sub=1,s=(1,1,1),rot=(0,0,0),**k):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=r,location=loc,rotation=rot); o=bpy.context.object; o.scale=s
    return put(o,c,**k)
def poly(verts2d,loc,c,th=0.06,rot=(0,0,0),s=1.0,**k):
    me=bpy.data.meshes.new('p'); n=len(verts2d)
    vs=[(x*s,y*s,-th/2) for x,y in verts2d]+[(x*s,y*s,th/2) for x,y in verts2d]
    fs=[list(range(n))[::-1],list(range(n,2*n))]+[[i,(i+1)%n,n+(i+1)%n,n+i] for i in range(n)]
    me.from_pydata(vs,[],fs); o=bpy.data.objects.new('p',me); sc.collection.objects.link(o)
    o.location=loc; o.rotation_euler=rot; return put(o,c,**k)
def star_pts(R=0.36,r=0.16,n=5):
    return [((R if i%2==0 else r)*math.sin(i*math.pi/n),(R if i%2==0 else r)*math.cos(i*math.pi/n)) for i in range(2*n)]
def sky(hor,zen,strength=1.0,gnd=None):
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; N=nt.nodes
    bg=N['Background']; tc=N.new('ShaderNodeTexCoord'); sp=N.new('ShaderNodeSeparateXYZ'); cr=N.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'],sp.inputs[0]); nt.links.new(sp.outputs[2],cr.inputs[0]); nt.links.new(cr.outputs[0],bg.inputs[0])
    e=cr.color_ramp; e.elements[0].position=0.0; e.elements[0].color=(*(gnd or hor),1)
    e.elements[1].position=0.55; e.elements[1].color=(*zen,1); x=e.elements.new(0.5); x.color=(*hor,1)
    bg.inputs[1].default_value=strength
def sun(rot,energy,c=(1,0.95,0.85),ang=6):
    d=bpy.data.lights.new('s','SUN'); d.energy=energy; d.color=c; d.angle=math.radians(ang)
    o=bpy.data.objects.new('s',d); sc.collection.objects.link(o); o.rotation_euler=[math.radians(a) for a in rot]; return o
def point(loc,energy,c,r=0.5):
    d=bpy.data.lights.new('p','POINT'); d.energy=energy; d.color=c; d.shadow_soft_size=r
    o=bpy.data.objects.new('p',d); sc.collection.objects.link(o); o.location=loc
# ---------------- pieces ----------------
def piece(kind,loc,s=1.0,up=(0,0,0)):
    x,y,z=loc
    if kind=='leaf':   poly([(0,.38),(.14,.2),(.34,.22),(.22,.04),(.3,-.16),(.08,-.12),(0,-.36),(-.08,-.12),(-.3,-.16),(-.22,.04),(-.34,.22),(-.14,.2)],(x,y,z+.05*s),(0.85,0.18,0.06),th=.07*s,s=s,rot=up)
    elif kind=='acorn': ico((x,y,z+.17*s),.2*s,(0.62,0.38,0.14),s=(1,1,1.2)); cyl((x,y,z+.36*s),.23*s,.12*s,(0.35,0.2,0.08),r2=.14*s)
    elif kind=='mush': cyl((x,y,z+.12*s),.09*s,.24*s,(0.95,0.9,0.78)); ico((x,y,z+.28*s),.3*s,(0.9,0.12,0.12),s=(1,1,.55))
    elif kind=='cone': cyl((x,y,z+.25*s),.22*s,.5*s,(0.42,0.24,0.1),v=6,r2=.04*s)
    elif kind=='chest': ico((x,y,z+.18*s),.26*s,(0.45,0.2,0.08),s=(1,.8,.75),sub=2)
    elif kind=='ticket': box((x,y,z+.06*s),(.6*s,.38*s,.08*s),(1.0,0.78,0.15),bevel=.03*s)
    elif kind=='star': poly(star_pts(),(x,y,z+.12*s),(1.0,0.8,0.25),th=.14*s,s=s,e=1.4,rot=up)
    elif kind=='flake':
        for a in (0,60,120): box((x,y,z+.1*s),(.62*s,.09*s,.09*s),(0.65,0.88,1.0),rot=(up[0],0,math.radians(a)),e=.6)
    elif kind=='cocoa': cyl((x,y,z+.18*s),.2*s,.36*s,(0.95,0.95,0.92),v=10); cyl((x,y,z+.37*s),.17*s,.03*s,(0.4,0.22,0.12),v=10)
    elif kind=='mitten': ico((x,y,z+.18*s),.24*s,(0.85,0.15,0.2),s=(.9,.6,1.2)); ico((x+.2*s,y,z+.22*s),.1*s,(0.85,0.15,0.2))
    elif kind=='pine': cyl((x,y,z+.3*s),.26*s,.6*s,(0.15,0.5,0.3),v=6,r2=0)
    elif kind=='scope': ico((x,y,z+.2*s),.24*s,(0.6,0.4,0.95),sub=2,e=.3)
    elif kind=='cloud':
        for dx,dz,r in ((-.13,.15,.16),(.13,.15,.16),(0,.25,.2)): ico((x+dx*s,y,z+dz*s),r*s,(1,1,1),sub=2,e=.15)
    elif kind=='dawn': ico((x,y,z+.2*s),.25*s,(1.0,0.55,0.25),sub=1,e=.5)
    elif kind=='crane':
        poly([(-.36,0),(0,.1),(.36,0),(0,-.06)],(x,y,z+.18*s),(0.98,0.97,0.95),th=.04*s,s=s,rot=(0,0,0)); poly([(0,0),(.12,0),(0,.32)],(x,y-.02,z+.12*s),(0.98,0.97,0.95),th=.04*s,s=s,rot=(math.radians(90),0,0))
    elif kind=='feather': ico((x,y,z+.1*s),.3*s,(0.3,0.75,0.85),s=(.35,1,.25))
    elif kind=='whistle': cyl((x,y,z+.15*s),.14*s,.42*s,(1.0,0.85,0.3),rot=(0,math.radians(90),0),v=10)
    elif kind=='kite': poly([(0,.4),(.26,.05),(0,-.36),(-.26,.05)],(x,y,z+.08*s),(0.9,0.2,0.25),th=.07*s,s=s,rot=up)
    elif kind=='jar': cyl((x,y,z+.2*s),.18*s,.4*s,(0.8,0.95,0.9),v=10,a=.45,r=.1); ico((x,y,z+.2*s),.09*s,(1.0,0.9,0.35),e=6)
    elif kind=='dand': cyl((x,y,z+.12*s),.02*s,.24*s,(0.4,0.6,0.3)); ico((x,y,z+.32*s),.2*s,(0.97,0.97,0.92),sub=1,e=.2)
    elif kind=='env': box((x,y,z+.06*s),(.56*s,.38*s,.07*s),(0.98,0.93,0.82),bevel=.03*s); poly([(-.28,.19),(.28,.19),(0,-.04)],(x,y,z+.11*s),(0.85,0.35,0.3),th=.01,s=s)
    elif kind=='scarf':
        bpy.ops.mesh.primitive_torus_add(major_radius=.2*s,minor_radius=.08*s,location=(x,y,z+.1*s),major_segments=10,minor_segments=6); put(bpy.context.object,(1.0,0.82,0.15))
    elif kind=='paper': box((x,y,z+.04*s),(.42*s,.5*s,.04*s),(0.97,0.95,0.88),rot=(0,0,.3))
    elif kind=='letter': box((x,y,z+.06*s),(.56*s,.38*s,.07*s),(0.95,0.88,0.7),rot=up,bevel=.02*s)
# ---------------- board helper ----------------
def board_grid(kinds,cell,z,y0=0,skip=(),clear=(),sel=None,up=(0,0,0),vertical=False,ps=1.0):
    pts=[]
    for i in range(7):
        for j in range(7):
            if (i,j) in skip: continue
            if vertical: loc=((i-3)*cell,0,(j-3)*cell+z)
            else: loc=((i-3)*cell,(j-3)*cell+y0,z)
            k=kinds[(i*3+j*5+(i*j)%4)%6]
            s=cell*ps*(1.18 if (i,j) in clear else 1.0)
            if vertical: piece_v(k,loc,s)
            else: piece(k,loc,s,up)
            pts.append(loc)
    return pts
def piece_v(k,loc,s):  # 立放：把平面道具朝向镜头(-Y)
    n0=len(bpy.data.objects); piece(k,(0,0,0),s)
    for o in list(bpy.data.objects)[n0:]:
        o.location=Vector((o.location.x,-o.location.z+0.0,o.location.y))+Vector(loc)+Vector((0,-0.12*s,-0.2*s))
        o.rotation_euler.x+=math.radians(90)
def frame_cam(corners,pitch,yaw=0,lens=30,width_frac=0.9,center_y=0.33,target=None):
    cd=bpy.data.cameras.new('c'); cd.lens=lens; cd.sensor_fit='VERTICAL'; cd.sensor_height=24; cd.clip_end=500
    cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
    cen=sum((Vector(c) for c in corners),Vector())/len(corners) if target is None else Vector(target)
    cam.rotation_euler=Euler((math.radians(90-pitch),0,math.radians(yaw)))
    fwd=cam.rotation_euler.to_matrix()@Vector((0,0,-1))
    lo,hi=2,200
    for _ in range(40):
        d=(lo+hi)/2; cam.location=cen-fwd*d; bpy.context.view_layer.update()
        xs=[w2c(sc,cam,Vector(c)).x for c in corners]
        if max(xs)-min(xs)>width_frac: lo=d
        else: hi=d
    ys=[w2c(sc,cam,Vector(c)).y for c in corners]
    cd.shift_y=-(center_y-(max(ys)+min(ys))/2)*(1)  # shift in frame-height units (vertical fit)
    bpy.context.view_layer.update()
    return cam
def report(cam,cell_corners_rows):
    out=[]
    for row in cell_corners_rows:
        a,b=[w2c(sc,cam,Vector(p)) for p in row]
        out.append(round(abs(b.x-a.x)*720))
    print('CELL_PX', out)
ORANGE=[(0.95,0.45,0.1),(0.85,0.2,0.08),(0.98,0.7,0.15),(0.7,0.15,0.1),(0.9,0.55,0.2)]
def tree_round(x,y,s,col):
    cyl((x,y,1.0*s),.12*s,2*s,(0.3,0.18,0.1),v=5)
    for k in range(3): ico((x+random.uniform(-.4,.4)*s,y+random.uniform(-.3,.3)*s,(2.2+k*.5)*s),random.uniform(.7,1.0)*s,col,sub=1)
def tree_cone(x,y,s,col,snow=False):
    cyl((x,y,.4*s),.1*s,.8*s,(0.25,0.15,0.08),v=5)
    for k in range(3):
        cyl((x,y,(1.0+k*.75)*s),(1.0-k*.25)*s,1.1*s,col,v=7,r2=0.05*s)
        if snow: cyl((x,y,(1.32+k*.75)*s),(0.55-k*.15)*s,.5*s,(0.92,0.95,1.0),v=7,r2=0.04*s)
def scatter(n,fn,xr,yr,avoid=None):
    for _ in range(n):
        x,y=random.uniform(*xr),random.uniform(*yr)
        if avoid and avoid(x,y): continue
        fn(x,y)
C=1.0
RING=lambda loc,r,col: (bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.035,location=loc,major_segments=28,minor_segments=4), put(bpy.context.object,col,e=4))
# ====================================================================
if SCENE=='A_rail_crates':
    sky((1.0,0.72,0.45),(0.45,0.62,0.9),1.0)
    sun((52,0,-35),3.2,(1,0.88,0.7))
    # 地面 草+落叶
    box((0,10,-0.6),(80,80,1),(0.72,0.48,0.2))
    scatter(500,lambda x,y: poly([(0,.2),(.15,0),(0,-.2),(-.15,0)],(x,y,-.09),random.choice(ORANGE),th=.02,rot=(0,0,random.random()*6)),(-12,12),(-8,10),lambda x,y: abs(x)<4.6 and -4.6<y<4.6)
    # 铁轨 穿过车厢下方（沿X）
    for yy in (-2.2,2.2): box((0,yy,-.0),(80,.18,.16),(0.45,0.45,0.48),r=.4)
    for k in range(-40,41): box((k*.9,0,-.08),(.35,5.4,.12),(0.35,0.22,0.12))
    # 平板车厢
    box((0,0,.45),(8.0,8.0,.4),(0.55,0.16,0.12),bevel=.12)
    for xx in (-2.8,2.8):
        for yy in (-3.9,3.9): cyl((xx,yy,.25),.55,.25,(0.2,0.2,0.22),v=12,rot=(math.radians(90),0,0))
    # 7x7 木货箱（开口）
    for i in range(7):
        for j in range(7):
            x,y=(i-3)*C,(j-3)*C; t=(0.86,0.66,0.4) if (i+j)%2==0 else (0.8,0.58,0.33)
            box((x,y,.75),(.92,.92,.22),t,bevel=.05)
            box((x,y,.83),(.78,.78,.1),(0.42,0.27,0.14))
    board_grid(['leaf','acorn','mush','cone','chest','ticket'],C,.88,clear={(2,3),(3,3),(4,3)})
    RING((-2,-1,.92),.46,(1,.95,.7))
    for k in range(18):  # 落叶旋风（消除特效示意）
        a=k*.7; r=.25+k*.05
        poly([(0,.12),(.08,0),(0,-.12),(-.08,0)],(math.cos(a)*r*2.2,math.sin(a)*r*.6,1.4+k*.09),random.choice(ORANGE),th=.02,rot=(a,a*.5,a))
    # 火车头（前方，画面上方）与信号灯
    box((-1.2,13,1.6),(6,3.2,2.6),(0.2,0.35,0.3),bevel=.3); cyl((-3.6,13,3.6),.4,1.4,(0.15,0.15,0.15))
    cyl((4.6,9,2),.08,4,(0.3,0.3,0.32)); ico((4.6,9,4.1),.25,(1,0.3,0.2),e=3)
    # 红叶林 + 远山
    scatter(70,lambda x,y: tree_round(x,y,random.uniform(.9,1.6),random.choice(ORANGE)),(-16,16),(6,30))
    scatter(30,lambda x,y: tree_cone(x,y,random.uniform(1,1.8),(0.2,0.42,0.25)),(-16,16),(10,30))
    for k in range(7): cyl((-30+k*10,60,6),random.uniform(9,13),random.uniform(14,22),(0.55,0.5,0.6),v=6,r2=random.uniform(1,3))
    corners=[(-3.5,-3.5,.9),(3.5,-3.5,.9),(-3.5,3.5,.9),(3.5,3.5,.9)]
    cam=frame_cam(corners,pitch=58,center_y=0.36)
    report(cam,[((-3.5,-3,.9),(-2.5,-3,.9)),((-3.5,3,.9),(-2.5,3,.9))])
elif SCENE=='B_snow_starmap':
    sky((0.08,0.12,0.28),(0.01,0.02,0.07),1.0,gnd=(0.05,0.06,0.12))
    sun((60,0,30),0.6,(0.6,0.7,1.0)); point((0,-2,4),300,(1,0.75,0.45),2)
    box((0,10,-0.6),(90,90,1),(0.82,0.86,0.95))
    # 木平台 + 星图桌
    box((0,0,0),(10,10,.3),(0.4,0.26,0.16),bevel=.2)
    box((0,0,.55),(8.1,8.1,.5),(0.5,0.32,0.18),bevel=.25)
    box((0,0,.82),(7.3,7.3,.06),(0.03,0.06,0.18),r=.15)
    for k in range(8):
        box(((k-3.5)*C,0,.87),(.035,7.0,.02),(1,0.8,0.4),e=1.5); box((0,(k-3.5)*C,.87),(7.0,.035,.02),(1,0.8,0.4),e=1.5)
    for e_ in [(-4,-4),(4,-4),(-4,4),(4,4)]:  # 桌角积雪圆包
        ico((e_[0]*1.0,e_[1]*1.0,.9),.45,(0.95,0.97,1.0),s=(1,1,.4),sub=2)
    board_grid(['star','flake','cocoa','mitten','pine','scope'],C,.86,clear={(1,5),(2,5),(3,5)})
    RING((2,0,.9),.46,(1,.9,.6))
    # 星座连线示意：3 颗星升向天空
    P=[(-2,1.5,3.0),(-0.6,2.6,4.4),(0.9,1.8,5.6)]
    for p in P: poly(star_pts(.22,.1),p,(1,0.85,0.4),th=.06,e=6,rot=(math.radians(70),0,0))
    for a,b in zip(P,P[1:]):
        m=(Vector(a)+Vector(b))/2; d=Vector(b)-Vector(a)
        o=box(tuple(m),(d.length,.025,.025),(1,0.85,0.5),e=4); o.rotation_euler=d.to_track_quat('X','Z').to_euler()
    # 观星台
    cyl((0,16,2.5),4,5,(0.85,0.82,0.78),v=16); ico((0,16,5),4.0,(0.75,0.78,0.85),sub=2,s=(1,1,.85))
    box((0,12.2,5.5),(1.0,.6,3.2),(0.05,0.05,0.1)); cyl((0,12.4,6.6),.5,4,(0.3,0.3,0.4),rot=(math.radians(55),0,0))
    for xx in (-1.6,1.6): box((xx,11.95,2),(1,.1,1.2),(1,0.75,0.4),e=4)
    scatter(50,lambda x,y: tree_cone(x,y,random.uniform(1,2),(0.1,0.28,0.25),snow=True),(-18,18),(6,30),lambda x,y: abs(x)<5.5 and y<22)
    for k in range(6): cyl((-28+k*11,55,7),random.uniform(9,13),random.uniform(16,24),(0.55,0.6,0.75),v=6,r2=1)
    # 极光：淡色顶点色面片（柔，不成光柱）
    for k in range(5):
        o=box((-12+k*6,70,26+math.sin(k)*3),(7,0.1,6+k%2*3),(0.2,0.9,0.6) if k%2 else (0.5,0.4,0.9),e=0.9,a=.35,rot=(0,math.radians(-8+k*4),math.radians(10-k*5)))
    scatter(220,lambda x,y: ico((x,90,y),.12,(1,1,0.95),sub=0,e=8),(-60,60),(20,70))
    scatter(120,lambda x,y: ico((x,y,.6+random.random()*7),.05,(1,1,1),sub=0,e=1),(-8,8),(-6,10))  # 雪花
    corners=[(-3.5,-3.5,.9),(3.5,-3.5,.9),(-3.5,3.5,.9),(3.5,3.5,.9)]
    cam=frame_cam(corners,pitch=56,center_y=0.35)
    report(cam,[((-3.5,-3,.9),(-2.5,-3,.9)),((-3.5,3,.9),(-2.5,3,.9))])
elif SCENE=='C_cloud_terrace':
    sky((1.0,0.68,0.55),(0.5,0.62,0.92),1.1,gnd=(1,0.8,0.75))
    sun((80,0,10),3.0,(1,0.8,0.62))
    # 崖顶石台
    cyl((0,0,-3),6.2,6,(0.48,0.42,0.42),v=9,r2=5.6)
    for i in range(7):
        for j in range(7):
            t=random.choice([(0.78,0.74,0.68),(0.72,0.68,0.64),(0.8,0.76,0.7)])
            box(((i-3)*C,(j-3)*C,.06),(.93,.93,.16),t,bevel=.08)
    box((0,0,-.06),(7.5,7.5,.1),(0.35,0.55,0.3))  # 苔缝
    board_grid(['cloud','dawn','crane','feather','whistle','kite'],C,.14,clear={(4,1),(4,2),(4,3)})
    RING((-1,2,.18),.46,(1,.95,.75))
    for k in range(9): ico((1.4+k*.35,-1+k*.3,.6+k*.25),.12+k*.03,(1,1,1),sub=1,e=.3)  # 云团噗散
    poly([(-.4,0),(0,.12),(.4,0),(0,-.07)],(2.5,0,2.8),(1,1,1),th=.03,rot=(0.3,0,0.4))
    # 奇松
    def pinet(x,y,s):
        cyl((x,y,1*s),.15*s,2*s,(0.3,0.22,0.18),v=5,rot=(0,.3,0))
        for k in range(3): cyl((x+.4*k*s,y,(1.8+k*.4)*s),(1.3-k*.2)*s,.35*s,(0.15,0.42,0.3),v=7)
    pinet(-5.2,1.5,1.2); pinet(5.0,3.6,1.0)
    # 云海
    scatter(260,lambda x,y: ico((x,y,random.uniform(-4.5,-2.5)),random.uniform(1.5,3.5),(1,0.93,0.92),sub=2,s=(1.4,1,0.5),e=.1),(-40,40),(-20,60),lambda x,y: abs(x)<6.5 and abs(y)<6.5)
    for k in range(9):
        x=random.choice([-1,1])*random.uniform(9,30); y=random.uniform(14,55); h=random.uniform(8,18)
        cyl((x,y,h/2-4),random.uniform(1.5,3),h,(0.55,0.5,0.55),v=6,r2=random.uniform(1,2)); pinet(x,y,h/14+.5) if False else ico((x,y,h-4),1.8,(0.2,0.45,0.35),s=(1.4,1.4,.4))
    corners=[(-3.5,-3.5,.15),(3.5,-3.5,.15),(-3.5,3.5,.15),(3.5,3.5,.15)]
    cam=frame_cam(corners,pitch=55,center_y=0.36)
    report(cam,[((-3.5,-3,.15),(-2.5,-3,.15)),((-3.5,3,.15),(-2.5,3,.15))])
elif SCENE=='D_hill_picnic':
    sky((1.0,0.62,0.4),(0.55,0.5,0.85),1.15,gnd=(1,0.7,0.5))
    sun((78,0,15),3.0,(1,0.75,0.5))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=40,location=(0,4,-39.6),segments=24,ring_count=12); put(bpy.context.object,(0.42,0.62,0.25))
    # 野餐布：格纹，圆角
    for i in range(7):
        for j in range(7):
            t=(0.98,0.93,0.82) if (i+j)%2==0 else (0.72,0.55,0.85)
            box(((i-3)*C,(j-3)*C,.42),(.99,.99,.04),t,bevel=.02 if (i,j) not in [(0,0),(6,0),(0,6),(6,6)] else .25)
    box((0,0,.38),(7.6,7.6,.04),(0.95,0.85,0.7),bevel=.4)
    board_grid(['jar','dand','kite','env','scarf','paper'],C,.44,clear={(5,2),(5,3),(5,4)})
    RING((-3,1,.5),.46,(1,.95,.75))
    scatter(40,lambda x,y: ico((x,y,1+random.random()*3),.05,(1,1,0.9),sub=0,e=3),(3,7),(1,6))   # 蒲公英种子+萤火
    # 篮子、风筝、人物占位
    cyl((5.0,-1.5,.8),.8,.8,(0.7,0.5,0.25),v=10); bpy.ops.mesh.primitive_torus_add(major_radius=.7,minor_radius=.05,location=(5,-1.5,1.4),rotation=(math.radians(90),0,0)); put(bpy.context.object,(0.6,0.4,0.2))
    poly([(0,1.2),(.8,.1),(0,-1),(-.8,.1)],(-3,9,7),(0.95,0.3,0.3),th=.05,rot=(math.radians(80),0,.3))
    # 薰衣草条带
    for k in range(14):
        box((0,12+k*2.2,-1.5-k*.35),(60,.8,.6),(0.55,0.4,0.85) if k%2==0 else (0.45,0.62,0.3))
    for k,(x,h) in enumerate([(-14,20),(8,26),(20,17)]):
        ico((x,80,h),2.2,(0.95,0.5,0.35),sub=2,s=(1,1,1.15)); box((x,80,h-3.2),(.8,.8,.7),(0.5,0.3,0.2))
    ico((0,140,6),9,(1,0.85,0.55),sub=3,e=2.5)  # 太阳圆盘（无光柱）
    corners=[(-3.5,-3.5,.45),(3.5,-3.5,.45),(-3.5,3.5,.45),(3.5,3.5,.45)]
    cam=frame_cam(corners,pitch=50,center_y=0.36)
    report(cam,[((-3.5,-3,.45),(-2.5,-3,.45)),((-3.5,3,.45),(-2.5,3,.45))])
elif SCENE=='E_station_mailwall':
    sky((1.0,0.75,0.5),(0.5,0.65,0.9),1.0)
    sun((60,0,-30),3.0,(1,0.88,0.7)); point((0,-4,9),600,(1,0.8,0.55),3)
    # 站房墙
    box((0,0.6,6),(12,1,16),(0.62,0.38,0.24))
    box((0,0.05,6.6),(10.6,.1,.3),(0.4,0.25,0.15))
    # 窗（窗外红叶林+小火车）
    box((0,0.6,11.2),(8.4,1.2,4.2),(0.85,0.75,0.6),bevel=.3)
    box((0,0.6,11.2),(7.8,1.4,3.6),(0.5,0.65,0.85))
    win=bpy.context.object; win.hide_render=True
    scatter(40,lambda x,y: tree_round(x,y,1.3,random.choice(ORANGE)),(-12,12),(10,25))
    box((2,8,1.5),(9,2.4,2.4),(0.2,0.4,0.35),bevel=.3); box((-4,8,1.5),(5,2.4,2.4),(0.75,0.25,0.18),bevel=.3)
    box((0,40,0),(100,60,1),(0.7,0.5,0.25))
    # 信格柜 7x7（立面）
    box((0,0.25,4.0),(7.7,.9,7.7),(0.45,0.28,0.16),bevel=.15)
    for i in range(7):
        for j in range(7):
            box(((i-3)*C,-0.05,(j-3)*C+4),(.86,.5,.86),(0.25,0.14,0.08) if (i+j)%2 else (0.29,0.17,0.1))
    board_grid(['leaf','letter','ticket','acorn','mush','cone'],C,4.0,vertical=True,clear={(1,2),(2,2),(3,2)},ps=.95)
    for dx,dz,sx,sz in ((0,.47,.95,.05),(0,-.47,.95,.05),(.47,0,.05,.95),(-.47,0,.05,.95)):
        box((2*C+dx,-0.33,1*C+4+dz),(sx,.03,sz),(1,.92,.65),e=4)
    for k in range(5): box((-1+k*.9,-1.2-k*.2,2.4+k*.55),(.5,.04,.34),(0.95,0.88,0.7),rot=(0.3,k*.3,k*.4))  # 信封飞出
    scatter(40,lambda x,y: poly([(0,.15),(.11,0),(0,-.15),(-.11,0)],(x,-1.5,y),random.choice(ORANGE),th=.02,rot=(1.2,random.random(),random.random())),(-6,6),(0,13))
    box((0,-2,-.5),(30,6,1),(0.55,0.5,0.45))
    cyl((4.5,-.4,9.4),.25,.4,(1,0.8,0.5),e=6)
    corners=[(-3.5,0,.5),(3.5,0,.5),(-3.5,0,7.5),(3.5,0,7.5)]
    cam=frame_cam(corners,pitch=4,center_y=0.33)
    report(cam,[((-3.5,0,1),(-2.5,0,1)),((-3.5,0,7),(-2.5,0,7))])
sc.render.filepath=OUT
bpy.ops.render.render(write_still=True)
print('TRIS',sum(len(o.data.polygons) for o in sc.objects if o.type=='MESH'))
