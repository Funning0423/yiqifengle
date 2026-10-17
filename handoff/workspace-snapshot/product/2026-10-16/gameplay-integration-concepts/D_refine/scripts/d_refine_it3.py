# D 精修：山丘重逢·坡顶野餐布   blender -b -P d_refine.py -- <main|fx> <outdir>
import os,sys
HERE=os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE,'helpers.py')).read())   # SCENE=argv[0] (mode), OUT=argv[1] (dir)
MODE,OUTD=SCENE,OUT; SCENE='D_hill_picnic'
exec(open(os.path.join(HERE,'fw.py')).read())
random.seed(23)
sc.eevee.taa_render_samples=64
def smooth(o):
    for p in o.data.polygons: p.use_smooth=True
    return o
# ---------- 光：右后方低斜夕阳 + 天光；灯笼为点光源 ----------
sky([(0.0,(0.98,0.5,0.32)),(0.3,(1.0,0.62,0.38)),(0.40,(1.0,0.76,0.5)),(0.47,(0.95,0.7,0.62)),(0.56,(0.62,0.6,0.9)),(1.0,(0.28,0.36,0.85))],0.55)
sun((46,0,125),3.4,(1,0.74,0.46),ang=4)     # 来自右后方，影子落向左前
TL=18; PLANE=[Vector((0,6,0.8)),Vector((0,-math.sin(R(TL)),math.cos(R(TL))))]
report()
n=PLANE[1]
G1=(0.26,0.56,0.12); G2=(0.34,0.62,0.16); G3=(0.2,0.48,0.12)
# ---------- 近坡 ----------
slope=[P(-12,-6)-n*0.02,P(19,-6)-n*0.02,P(19,8.4)-n*0.02,P(-12,8.4)-n*0.02]
quad(slope,G1,th=6)
top=P(3.5,8.4)
CAMC=cam.matrix_world.translation
def at_screen(u,v,dist): return CAMC+ray(u,v)*dist
# 坡顶圆润脊线（几团压扁的球）+ 后坡下落 + 谷底
for k in range(9):
    x=-22+k*5.5; smooth(ico((x,top.y+1.6,top.z-2.4),5.0,G2,sub=2,s=(1.2,0.8,0.5)))
VZ=-22.0
back=[Vector((-60,top.y+3,top.z-1.2)),Vector((60,top.y+3,top.z-1.2)),Vector((60,top.y+30,VZ)),Vector((-60,top.y+30,VZ))]
me=bpy.data.meshes.new('b'); me.from_pydata([tuple(v) for v in back],[],[[0,1,2,3]]); o=bpy.data.objects.new('b',me); sc.collection.objects.link(o); put(o,G3)
box((0,top.y+31,VZ-0.5),(300,28,1),(0.36,0.56,0.16))
back2=[Vector((-90,top.y+45,VZ)),Vector((90,top.y+45,VZ)),Vector((90,top.y+70,VZ-60)),Vector((-90,top.y+70,VZ-60))]
me=bpy.data.meshes.new('b2'); me.from_pydata([tuple(v) for v in back2],[],[[0,1,2,3]]); o=bpy.data.objects.new('b2',me); sc.collection.objects.link(o); put(o,G3)
# ---------- 中景：薰衣草田、小路、树篱、小农舍 ----------
LAV=[(0.56,0.36,0.82),(0.62,0.42,0.86)]
y0=top.y+18
for f,(fx,fw_,fy,fl) in enumerate(((-26,20,y0,12),(2,22,y0+1,12),(-30,18,y0+14,11),(6,24,y0+14,12))):
    for r in range(int(fw_/1.6)):
        box((fx+r*1.6,fy+fl/2,VZ+0.35),(0.9,fl,0.7),LAV[r%2],bevel=.25,seg=1)
    box((fx+fw_/2-.8,fy-1.2,VZ+0.6),(fw_+1.0,1.2,1.2),(0.12,0.36,0.14),bevel=.3,seg=1)     # 树篱
path=[(-2,y0-6),(0,y0+3),(-3,y0+9),(1,y0+15),(4,y0+21),(2,y0+26)]
for a,b in zip(path,path[1:]):
    m=Vector(((a[0]+b[0])/2,(a[1]+b[1])/2,VZ+0.05)); d=Vector((b[0]-a[0],b[1]-a[1],0))
    o=box(tuple(m),(1.8,d.length+1.6,0.1),(0.86,0.72,0.5)); o.rotation_euler=(0,0,math.atan2(-d.x,d.y))
fh=Vector((26,y0+10,VZ))
box((fh.x,fh.y,fh.z+1.6),(4.4,3.2,3.2),(0.95,0.88,0.75)); cyl((fh.x,fh.y,fh.z+4.0),3.3,1.8,(0.75,0.28,0.18),v=4,rot=(0,0,R(45)),r2=.2)
box((fh.x+1.2,fh.y-1.62,fh.z+1.6),(.8,.06,.8),(1,0.75,0.4),e=4); box((fh.x-1.2,fh.y-1.62,fh.z+1.6),(.8,.06,.8),(1,0.75,0.4),e=4)
for _ in range(18):
    x=random.uniform(-40,40); y=random.uniform(y0-4,y0+25)
    if any(abs(x-(fx+fw_/2))<fw_/2+1 and fy-2<y<fy+fl+1 for fx,fw_,fy,fl in ((-26,20,y0,12),(2,22,y0+1,12),(-30,18,y0+14,11),(6,24,y0+14,12))): continue
    cyl((x,y,VZ+1.2),.25,2.4,(0.4,0.24,0.12),v=5); smooth(ico((x,y,VZ+3.2),random.uniform(1.4,2.0),random.choice([(0.16,0.45,0.15),(0.24,0.52,0.14)]),sub=1))
# ---------- 远山丘：顶部压在屏幕 v≈0.92，上方留天空 ----------
for layer,(v,dist,col,rr) in enumerate(((0.915,110,(0.34,0.52,0.36),20),(0.93,150,(0.46,0.52,0.66),28))):
    for k in range(6):
        u=-0.1+k*0.24+random.uniform(-.05,.05); q=at_screen(u,v+random.uniform(-.008,.008),dist)
        smooth(ico((q.x,q.y,q.z-rr*0.5),rr,col,sub=2,s=(1.5,1,0.5)))
# ---------- 热气球（谷地上空，在视线带内） ----------
def balloon(x,y,z,r,c1,c2):
    for k in range(8):
        a=k*math.pi/4; o=ico((x+math.cos(a)*r*.02,y+math.sin(a)*r*.02,z),r,c1 if k%2==0 else c2,sub=2,s=(1,1,1.15))
        if k>0: bpy.data.objects.remove(o); continue
        smooth(o)
    torus((x,y,z-r*.2),r*.98,r*.06,c2,rot=(0,0,0)); torus((x,y,z+r*.45),r*.82,r*.05,c2)
    cyl((x,y,z-r*1.05),r*.35,r*.3,c2,v=10,r2=r*.2)
    box((x,y,z-r*1.6),(r*.38,r*.38,r*.3),(0.55,0.34,0.15))
    for dx,dy in ((-1,-1),(1,-1),(-1,1),(1,1)): box((x+dx*r*.17,y+dy*r*.17,z-r*1.33),(.04,.04,r*.5),(0.35,0.25,0.15))
for (u,v,dist,r,c1,c2) in ((0.56,0.82,52,2.2,(0.95,0.32,0.24),(1,0.82,0.3)),(0.80,0.88,72,2.2,(0.3,0.62,0.95),(0.98,0.95,0.85)),(0.92,0.76,40,1.4,(1,0.66,0.2),(0.9,0.3,0.4)),(0.40,0.905,92,2.0,(0.62,0.42,0.9),(1,0.9,0.6))):
    q=at_screen(u,v,dist); balloon(q.x,q.y,q.z,r,c1,c2)
# ---------- 天空：太阳圆盘 + 云 ----------
q=at_screen(0.86,0.975,300); smooth(ico(tuple(q),14,(1,0.78,0.42),sub=3,e=2.2))
for _ in range(14):
    q=at_screen(random.uniform(0,1),random.uniform(0.955,1.0),random.uniform(240,290)); x,y,z=q.x,q.y,q.z
    for k in range(4): smooth(ico((x+random.uniform(-9,9),y,z+random.uniform(0,4)),random.uniform(5,9),random.choice([(1,0.86,0.78),(1,0.8,0.7),(0.98,0.84,0.86)]),sub=1,s=(1.6,1,0.6),e=0.35))
# ---------- 坡顶：秋千大树 + 小故事 ----------
tp=P(0.9,9.2)
tz=tp.z-0.2
o=cyl((tp.x,tp.y,tz+2.4),.5,4.8,(0.42,0.24,0.12),v=8,r2=.36)
for ang,ln,h in ((R(35),3.2,4.2),(R(-40),2.6,4.6),(R(70),2.0,3.4)):
    o=cyl((tp.x+math.sin(ang)*ln/2,tp.y,tz+h+math.cos(ang)*0.6),.18,ln,(0.42,0.24,0.12),v=6,rot=(0,ang+R(90)*0.6,0))
for d,r in (((0,0,6.3),2.4),((-2.0,.3,5.6),1.9),((2.2,-.2,5.7),2.0),((0.6,.6,7.4),1.8),((-1.0,-.6,7.0),1.6),((3.4,.2,6.4),1.4)):
    smooth(ico((tp.x+d[0],tp.y+d[1],tz+d[2]),r,random.choice([(0.18,0.5,0.14),(0.24,0.56,0.16),(0.14,0.44,0.14)]),sub=2))
# 秋千（挂在右枝），两条围巾挂在绳上
sx=tp.x+2.3
for xx in (sx-0.8,sx+0.8): box((xx,tp.y-0.2,tz+3.1),(.035,.035,3.6),(0.92,0.88,0.75))
box((sx,tp.y-0.2,tz+1.3),(2.0,.5,.1),(0.66,0.4,0.18),bevel=.04)
box((sx-0.8,tp.y-0.28,tz+3.0),(.16,.04,1.1),(1,0.78,0.08),rot=(0,R(8),0)); box((sx+0.8,tp.y-0.28,tz+2.8),(.16,.04,1.0),(0.25,0.55,0.9),rot=(0,R(-8),0))
# 树下两双鞋 + 靠着树干的信封 + 灯笼（暖光源）
for i,(dx,col) in enumerate(((-1.2,(0.95,0.75,0.25)),(-0.75,(0.3,0.45,0.75)))):
    for k in (0,1): box((tp.x+dx+k*.18,tp.y-1.2,tz+.08),(.14,.3,.14),col,bevel=.05)
box((tp.x+0.1,tp.y-0.55,tz+0.4),(.5,.05,.36),(1,0.85,0.75),rot=(R(-15),0,0)); smooth(ico((tp.x+0.1,tp.y-0.6,tz+0.42),.05,(0.85,0.12,0.15),sub=1))
lx,ly,lz=tp.x-1.9,tp.y-0.4,tz+4.6
box((lx,ly,lz+.5),(.02,.02,.8),(0.3,0.25,0.2)); cyl((lx,ly,lz),.18,.34,(1,0.8,0.45),v=8,e=6); cyl((lx,ly,lz+.2),.2,.06,(0.4,0.25,0.15),v=8)
point((lx,ly,lz),60,(1,0.7,0.4),0.3)
for _ in range(14): ico((tp.x+random.uniform(-3,3),tp.y+random.uniform(-2,0.5),tz+random.uniform(0.6,3)),.05,(1,0.88,0.35),sub=0,e=10)
# ---------- 坡面：草丛 + 野花（不进布） ----------
def inside(a,b,m=0.25): return -m<a<7+m and -m<b<7+m
for _ in range(430):
    a=random.uniform(-6,13); b=random.uniform(-3.5,10.8)
    if inside(a,b) or b>8.4: continue
    p=P(a,b); h=random.uniform(.22,.4)
    cyl(tuple(p+n*h/2),.05,h,random.choice([G2,(0.4,0.66,0.18),(0.24,0.5,0.1)]),v=3,r2=0,rot=(random.uniform(-.35,.35),random.uniform(-.35,.35),0))
FL=[(1,0.95,0.35),(1,1,0.98),(0.98,0.5,0.62),(0.72,0.55,0.95),(1,0.62,0.25)]
def flower(p,c,s=1.0):
    cyl(tuple(p+n*.09*s),.012*s,.18*s,(0.25,0.5,0.12),v=3)
    poly(star_pts(.09*s,.04*s,5),tuple(p+n*.19*s),c,th=.015); ico(tuple(p+n*.2*s),.025*s,(1,0.8,0.2),sub=0)
for _ in range(160):
    a=random.uniform(-6,13); b=random.uniform(-3.5,8.4)
    if inside(a,b): continue
    flower(P(a,b),random.choice(FL),random.uniform(.9,1.4))
# ---------- 野餐布（降饱和格纹）+ 布边缝线 ----------
quad(outline(0.32,lift=0.01,r=.45),(0.95,0.88,0.76))
for i in range(7):
    for j in range(7):
        quad(cell_pts(i,j,0.0,lift=0.02),(0.97,0.91,0.79) if (i+j)%2==0 else (0.76,0.67,0.82))
for k in range(56):
    t=k/56*28; side=int(t//7); f=t%7
    a,b=[(f,-0.2),(7.2,f),(7-f,7.2),(-0.2,7-f)][side]
    quad([P(a-.08,b-.015)+n*.025,P(a+.08,b-.015)+n*.025,P(a+.08,b+.015)+n*.025,P(a-.08,b+.015)+n*.025] if side%2==0 else [P(a-.015,b-.08)+n*.025,P(a+.015,b-.08)+n*.025,P(a+.015,b+.08)+n*.025,P(a-.015,b+.08)+n*.025],(0.62,0.42,0.6))
# ---------- 精细棋子 ----------
def p2(kind):
    if kind=='jar':
        smooth(cyl((0,0,.22),.2,.44,(0.85,0.97,0.95),v=12,a=.22,rough=.05)); torus((0,0,.45),.17,.03,(0.95,0.75,0.3)); cyl((0,0,.47),.1,.04,(0.95,0.75,0.3),v=10)
        smooth(ico((0,0,.22),.15,(1,0.82,0.2),sub=2,e=9)); [ico((dx,dy,dz),.03,(1,0.95,0.6),sub=0,e=12) for dx,dy,dz in((.08,0,.32),(-.07,.05,.14),(.03,-.08,.28))]
    elif kind=='kite':
        poly([(0,.42),(.3,.04),(0,-.36),(-.3,.04)],(0,0,.06),(0.32,0.6,0.95),th=.06)
        poly([(0,.42),(.3,.04),(0,.04)],(0,0,.1),(0.98,0.96,0.9),th=.01); poly([(0,-.36),(-.3,.04),(0,.04)],(0,0,.1),(0.98,0.96,0.9),th=.01)
        box((0,0,.11),(.03,.78,.02),(0.7,0.5,0.25)); box((0,.04,.11),(.6,.03,.02),(0.7,0.5,0.25))
        for k in range(3): box((.06+k*.08,-.42-k*.07,.05),(.1,.05,.02),(1,0.4,0.4),rot=(0,0,.6))
    elif kind=='env':
        box((0,0,.05),(.64,.44,.08),(1,0.8,0.74),bevel=.025); poly([(-.32,.22),(.32,.22),(0,-.04)],(0,0,.095),(0.96,0.68,0.64),th=.012)
        smooth(cyl((0,-.02,.105),.07,.03,(0.82,0.12,0.15),v=10)); poly(star_pts(.035,.015,5),(0,-.02,.125),(1,0.75,0.6),th=.005)
    elif kind=='scarf':
        smooth(torus((0,.06,.11),.17,.08,(1,0.52,0.12))); torus((0,.06,.11),.17,.084,(0.98,0.9,0.75),rot=(0,0,0)) if False else None
        for sx_,rz in ((-.08,.25),(.1,-.2)):
            box((sx_,-.2,.05),(.12,.34,.05),(1,0.52,0.12),rot=(0,0,rz),bevel=.02); box((sx_+.0,-.33,.08),(.13,.05,.02),(0.98,0.9,0.75),rot=(0,0,rz))
    elif kind=='strawb':
        smooth(ico((0,0,.21),.24,(0.92,0.1,0.16),sub=2,s=(1,1,1.1),rough=.3))
        for k in range(10): a=k*2.4; h=.1+(k%4)*.06; ico((math.cos(a)*.21,math.sin(a)*.21,h+.06),.022,(1,0.9,0.4),sub=0)
        for k in range(5): a=k*1.256; poly([(0,0),(.08,.03),(.16,0),(.08,-.03)],(0,0,.43),(0.2,0.62,0.18),th=.02,rot=(0,R(-20),a))
        cyl((0,0,.48),.02,.08,(0.25,0.5,0.15),v=4)
    elif kind=='dand':
        cyl((0,0,.13),.02,.26,(0.3,0.6,0.22),v=4); smooth(ico((0,0,.36),.2,(0.97,0.97,0.94),sub=2,e=.15))
        for k in range(14):
            a=k*2.4; b=math.acos(1-2*(k+.5)/14); v=Vector((math.sin(b)*math.cos(a),math.sin(b)*math.sin(a),math.cos(b)))
            ico(tuple(Vector((0,0,.36))+v*.24),.035,(1,1,1),sub=0,e=.2)
        poly([(0,0),(.12,.04),(.2,0),(.12,-.04)],(.02,0,.12),(0.3,0.6,0.22),th=.015,rot=(0,R(-30),0))
KINDS=['jar','kite','env','scarf','strawb','dand']
CLEAR=[(5,2),(5,3),(5,4)]
def kind_at(i,j):
    if (i,j) in CLEAR: return 'dand'
    k=KINDS[(i*2+j*3+(i*j)%5+(j//2))%6]
    if k=='dand' and i==5: k='jar'
    return k
def put_piece(i,j,scale=1.0,lift=0.0):
    s=cw(i,j)*1.02*scale; k=kind_at(i,j)
    return place(lambda: p2(k), M_at(P(i+.5,j+.5)+n*(0.02+lift)*cw(i,j),s))
for i in range(7):
    for j in range(7):
        if (i,j) in CLEAR and MODE=='fx': continue
        put_piece(i,j)
if MODE=='main': ringv3(1,1,0.06)
# ---------- 压边：餐篮压右下角、茶壶杯子在上沿外、野花草叶跨布边 ----------
def basket():
    smooth(cyl((0,0,.4),.72,.8,(0.74,0.5,0.22),v=16))
    for k in range(4): torus((0,0,.12+k*.2),.73,.03,(0.6,0.38,0.16))
    cyl((0,0,.82),.74,.06,(0.88,0.3,0.32),v=16); box((0,0,.86),(1.2,.5,.02),(0.98,0.95,0.88),rot=(0,0,.5))
    bpy.ops.mesh.primitive_torus_add(major_radius=.62,minor_radius=.05,location=(0,0,.9),rotation=(R(90),0,0),major_segments=16,minor_segments=4); put(bpy.context.object,(0.6,0.38,0.16))
    smooth(ico((.25,.1,.95),.18,(0.9,0.62,0.3),sub=2,s=(1.6,1,.7)))
place(basket, M_at(P(7.32,-0.42),cw(6,0)*0.82,rotz=.3))
def teaset():
    smooth(ico((0,0,.22),.24,(0.98,0.96,0.92),sub=2,s=(1,1,.85))); cyl((.3,0,.24),.04,.22,(0.98,0.96,0.92),v=6,rot=(0,R(60),0)); torus((-.24,0,.24),.1,.025,(0.98,0.96,0.92),rot=(R(90),0,0)); cyl((0,0,.42),.08,.06,(0.4,0.6,0.85),v=8)
    for dx in (.55,.85): cyl((dx,-.15,.07),.08,.14,(0.98,0.96,0.92),v=10); cyl((dx,-.15,.145),.065,.01,(0.6,0.35,0.15),v=10)
place(teaset, M_at(P(5.9,7.5),cw(5,6)*0.8))
for a,b,side in edge_pts(110,0.0):
    if (a>6.6 and b<0.4): continue
    p=P(a,b)
    if random.random()<0.55:
        cyl(tuple(p+n*.12),.035,.26,random.choice([G2,(0.4,0.66,0.18)]),v=3,r2=0,rot=(random.uniform(-.4,.4),random.uniform(-.4,.4),0))
    else: flower(p,random.choice(FL),random.uniform(.8,1.1))
# ---------- 镜头/渲染 ----------
def tris():
    dg=bpy.context.evaluated_depsgraph_get(); t=0
    for o in sc.objects:
        if o.type=='MESH' and not o.hide_render:
            e=o.evaluated_get(dg); m=e.to_mesh(); m.calc_loop_triangles(); t+=len(m.loop_triangles); e.to_mesh_clear()
    return t
def render(path):
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)
if MODE=='main':
    # 消除示意：三朵蒲公英放大 1.18
    for (i,j) in CLEAR: put_piece(i,j,1.18)
    print('TRIS_EVAL',tris())
    render(os.path.join(OUTD,'raw_D_refine.png'))
    # 近景验收：餐篮角 + 布边 + 棋子
    c2=bpy.data.cameras.new('c2'); c2.lens=32; c2.sensor_width=36; cam2=bpy.data.objects.new('c2',c2); sc.collection.objects.link(cam2)
    tgt=P(6.2,0.6); cam2.location=tgt+Vector((-1.2,-3.2,2.6)); cam2.rotation_euler=(tgt-cam2.location).to_track_quat('-Z','Y').to_euler()
    sc.camera=cam2; sc.render.resolution_x=720; sc.render.resolution_y=720; render(os.path.join(OUTD,'raw_closeup_basket.png'))
    tgt=P(1.0,7.0); cam2.location=tgt+Vector((1.6,-3.0,2.4)); cam2.rotation_euler=(tgt-cam2.location).to_track_quat('-Z','Y').to_euler()
    render(os.path.join(OUTD,'raw_closeup_topleft.png'))
else:
    # 关键帧：0.00 / 0.12 / 0.32 / 0.70 s
    frames=[('f0',0.0),('f1',0.12),('f2',0.32),('f3',0.70)]
    for name,t in frames:
        with Grab() as g:
            for (i,j) in CLEAR:
                c=P(i+.5,j+.5); s=cw(i,j)
                if t==0.0:
                    put_piece(i,j,1.0,lift=0.12); place(lambda: torus((0,0,0),.47,.045,(1,0.95,0.7),e=5),M_at(c+n*.08*s,s))
                elif t==0.12:
                    put_piece(i,j,1.18,lift=0.18); place(lambda: torus((0,0,0),.5,.05,(1,0.9,0.55),e=7),M_at(c+n*.08*s,s))
                elif t==0.32:
                    put_piece(i,j,0.55,lift=0.4)
                    for k in range(16):
                        v=Vector((random.uniform(-.6,.6),random.uniform(-.3,.6),random.uniform(.3,1.4)))*s; pp=c+n*.3*s+v
                        cyl(tuple(pp),.008,.16*s,(1,1,1),v=3,rot=(random.uniform(-.5,.5),0,0)); ico(tuple(pp+Vector((0,0,.08*s))),.04*s,(1,1,1),sub=1,e=.6)
                    for k in range(5): ico(tuple(c+Vector((random.uniform(-.5,.5),random.uniform(-.2,.5),random.uniform(.4,1.2)))*s),.05*s,(1,0.85,0.3),sub=0,e=14)
                else:
                    for k in range(14):
                        v=Vector((random.uniform(-.4,1.6),random.uniform(0.5,3.0),random.uniform(1.4,3.6)))*s; pp=c+v
                        cyl(tuple(pp),.008,.16*s,(1,1,1),v=3,rot=(random.uniform(-.6,.6),0,0)); ico(tuple(pp+Vector((0,0,.08*s))),.04*s,(1,1,1),sub=1,e=.6)
                    for k in range(5): ico(tuple(c+Vector((random.uniform(0,1.5),random.uniform(1,3),random.uniform(1.5,3.5)))*s),.05*s,(1,0.85,0.3),sub=0,e=14)
                    # 新棋子从上方落入
                    k2='strawb' if j!=3 else 'env'
                    place(lambda: p2(k2), M_at(c+n*0.9*s,s*0.9))
        render(os.path.join(OUTD,'raw_fx_%s.png'%name))
        for o in g.objs:
            try: bpy.data.objects.remove(o,do_unlink=True)
            except Exception: pass
print('DONE_MODE',MODE)
