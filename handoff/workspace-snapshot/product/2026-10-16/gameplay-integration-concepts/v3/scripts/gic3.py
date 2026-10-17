# v3: 棋盘躺在场景里。湖畔同款镜头（竖直 FOV 61.93°），俯角 55°；格子由屏幕方格反投影到载体平面（远排略大补偿透视）
import os,sys
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'helpers.py')).read())
sc.render.engine='BLENDER_EEVEE'
try:
    sc.eevee.use_shadows=True; sc.eevee.shadow_ray_count=2; sc.eevee.shadow_step_count=8
except Exception: pass
PITCH=55; CAMH=12.0
cd=bpy.data.cameras.new('c'); cd.lens=30; cd.sensor_width=36; cd.sensor_fit='AUTO'; cd.clip_end=900
cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
cam.location=(0,0,CAMH); cam.rotation_euler=(R(90-PITCH),0,0); bpy.context.view_layer.update()
TV=math.tan(math.atan(18/30)); TH=TV*720/1280
X0,CW=0.06,0.88/7            # 屏幕 x：格宽 0.1257*720=90.5px
Y0=0.07; CH=CW*720/1280      # 屏幕 y：方格
PLANE=[Vector((0,0,0)),Vector((0,0,1))]
def ray(u,v):
    d=cam.matrix_world.to_3x3()@Vector(((u-.5)*2*TH,(v-.5)*2*TV,-1)); return d.normalized()
def P(a,b):   # 格坐标 (a 列, b 行) -> 平面上的世界点
    C=cam.matrix_world.translation; d=ray(X0+a*CW,Y0+b*CH); p0,n=PLANE
    t=n.dot(p0-C)/n.dot(d); return C+d*t
def basis():
    n=PLANE[1].normalized(); xa=(P(7,3.5)-P(0,3.5)).normalized(); ya=n.cross(xa); return xa,ya,n
def M_at(c,s,rotz=0):
    xa,ya,n=basis(); m=Matrix((xa,ya,n)).transposed().to_4x4()
    return Matrix.Translation(c)@m@Matrix.Rotation(rotz,4,'Z')@Matrix.Diagonal((s,s,s,1))
class Grab:
    def __enter__(s): s.n=set(bpy.data.objects.keys()); return s
    def __exit__(s,*a): s.objs=[o for o in bpy.data.objects if o.name not in s.n]
def place(fn,M):
    with Grab() as g: fn()
    bpy.context.view_layer.update()
    for o in g.objs:
        if o.parent is None: o.matrix_world=M@o.matrix_world
    return g.objs
def quad(pts,c,th=0.0,**k):   # pts 世界点，沿法线挤出 th
    n=PLANE[1].normalized(); m=len(pts)
    vs=[tuple(p) for p in pts]+[tuple(p-n*th) for p in pts] if th>0 else [tuple(p) for p in pts]
    fs=[list(range(m))]
    if th>0: fs+= [list(range(m,2*m))[::-1]]+[[i,(i+1)%m,m+(i+1)%m,m+i][::-1] for i in range(m)]
    me=bpy.data.meshes.new('q'); me.from_pydata(vs,[],fs); me.validate(); o=bpy.data.objects.new('q',me); sc.collection.objects.link(o); return put(o,c,**k)
def cell_pts(i,j,g=0.05,lift=0.0):
    n=PLANE[1].normalized()
    return [P(i+g,j+g)+n*lift,P(i+1-g,j+g)+n*lift,P(i+1-g,j+1-g)+n*lift,P(i+g,j+1-g)+n*lift]
def outline(m,lift=0.0,r=0.0):
    n=PLANE[1].normalized(); pts=[]
    # 圆角矩形（屏幕空间），r 为圆角半径（格）
    cs=[(7+m-r,-m+r,-90,0),(7+m-r,7+m-r,0,90),(-m+r,7+m-r,90,180),(-m+r,-m+r,180,270)]
    for cx,cy,a0,a1 in cs:
        for k in range(5):
            a=R(a0+(a1-a0)*k/4); pts.append(P(cx+math.cos(a)*r,cy+math.sin(a)*r)+n*lift)
    return pts
def cw(i,j): return (P(i+1,j+.5)-P(i,j+.5)).length
def fillv3(kinds,z=0.0,clear=(),ps=1.0,pat=None):
    n=PLANE[1].normalized()
    for i in range(7):
        for j in range(7):
            k=kinds[(i*2+j*3+(i*j)%5+(j//2))%6] if pat is None else kinds[pat(i,j)]
            s=cw(i,j)*ps*(1.18 if (i,j) in clear else 1.0)
            place(lambda: piece(k,(0,0,0),1.0), M_at(P(i+.5,j+.5)+n*z*cw(i,j),s))
def ringv3(i,j,z):
    n=PLANE[1].normalized(); s=cw(i,j); place(lambda: torus((0,0,0),.47,.045,(1,0.95,0.7),e=5),M_at(P(i+.5,j+.5)+n*z*s,s))
def edge_pts(k,m=0.0):   # 沿棋盘外缘取 k 个点（格坐标外 m）
    out=[]
    for t in range(k):
        f=random.random()*7; side=random.randrange(4)
        a,b=[(f,-m),(7+m,f),(f,7+m),(-m,f)][side]; out.append((a,b,side))
    return out
def report():
    rows=[]
    for j in (0,3,6):
        ws=[];hs=[]
        for i in (0,3,6):
            from bpy_extras.object_utils import world_to_camera_view as w
            a=w(sc,cam,P(i,j));b=w(sc,cam,P(i+1,j));c=w(sc,cam,P(i,j+1))
            ws.append(round((b.x-a.x)*720)); hs.append(round((c.y-a.y)*1280))
        rows.append('row%d w%s h%s'%(j,ws,hs))
    wn=[(P(i+1,0.5)-P(i,0.5)).length for i in range(7)]; wf=[(P(i+1,6.5)-P(i,6.5)).length for i in range(7)]
    print('CELL_PX',SCENE,' | '.join(rows),'| world near/far cell width %.2f/%.2f'%(sum(wn)/7,sum(wf)/7))
def contact_shadow(m=0.25,a=.45):
    quad(outline(m,lift=0.005,r=.4),(0.0,0.0,0.0),a=a)
def soft_cloud(loc,r,col=(1,0.97,0.95),n=6,flat=0.55,e=0.25):
    for k in range(n):
        o=ico((loc[0]+random.uniform(-1,1)*r*.9,loc[1]+random.uniform(-.6,.6)*r,loc[2]+random.uniform(0,.5)*r*flat),r*random.uniform(.5,.85),col,sub=2,s=(1,1,flat+.25),e=e,rough=.9)
        for p in o.data.polygons: p.use_smooth=True
# ===================================================================
if SCENE=='A_rail_crates':
    sky([(0.0,(1.0,0.5,0.22)),(0.4,(1.0,0.6,0.3)),(0.47,(1.0,0.75,0.45)),(0.55,(0.35,0.62,1.0)),(1.0,(0.08,0.3,0.95))],0.7)
    sun((48,0,-145),3.6,(1,0.84,0.6))
    DECK=1.3; PLANE=[Vector((0,0,DECK+0.35)),Vector((0,0,1))]
    report()
    NL,NR,FL,FR=P(0,0),P(7,0),P(0,7),P(7,7)
    # 地面 + 落叶
    box((0,40,-.5),(200,200,1),(0.62,0.38,0.1))
    for _ in range(900):
        x=random.uniform(-25,25); y=random.uniform(-2,60)
        poly([(0,.22),(.16,0),(0,-.22),(-.16,0)],(x,y,.02),random.choice(ORANGE),th=.02,rot=(0,0,random.random()*6))
    # 轨道（沿 Y 方向伸向远处）
    for xx in (-1.6,1.6): box((xx,60,.15),(.16,200,.16),(0.55,0.55,0.6),rough=.3)
    for k in range(-5,160): box((0,k*.9,.05),(4.6,.32,.1),(0.35,0.2,0.1))
    # 平板车：车面沿着棋盘外缘（圆角），下面是车架和车轮
    quad(outline(0.42,lift=0,r=.5),(0.72,0.12,0.08),th=0.45)
    for side in (-1,1):
        for b in (0.8,2.6,4.6,6.4):
            p=P(-0.62 if side<0 else 7.62,b); cyl((p.x,p.y,0.9),0.72,0.3,(0.14,0.14,0.16),v=14,rot=(0,R(90),0))
            cyl((p.x+side*0.16,p.y,0.9),0.22,0.1,(0.75,0.6,0.2),v=8,rot=(0,R(90),0))
    yb=(NL.y+FL.y)/2; box((0,yb,1.0),(3.4,(FL.y-NL.y)*1.05,.5),(0.2,0.2,0.22))
    contact_shadow(0.1,.35)
    # 7×7 开口木货箱（每格一只，远排略大）
    for i in range(7):
        for j in range(7):
            s=cw(i,j); t=[(0.9,0.62,0.3),(0.8,0.5,0.22),(0.95,0.7,0.38)][(i*3+j)%3]
            quad(cell_pts(i,j,0.04,lift=0.30*s),t,th=0.30*s)
            quad(cell_pts(i,j,0.13,lift=0.305*s),(0.5,0.3,0.12))
    fillv3(['leaf','acorn','mush','cone','chest','ticket'],z=0.31,clear={(4,5),(5,5),(6,5)},ps=0.95)
    ringv3(1,2,0.4)
    # 压边：落叶跨过车沿和箱沿（不进格心），绑带
    for a,b,side in edge_pts(46,0.05):
        p=P(a,b); s=cw(min(int(a),6),min(int(b),6))
        poly([(0,.2),(.14,0),(0,-.2),(-.14,0)],(p.x,p.y,p.z+0.32*s+.02),random.choice(ORANGE),th=.025,s=s*1.1,rot=(random.uniform(-.2,.2),random.uniform(-.2,.2),random.random()*6))
    for b in (2.0,5.0):
        quad([P(-0.45,b-.06)+Vector((0,0,.02)),P(7.45,b-.06)+Vector((0,0,.02)),P(7.45,b+.06)+Vector((0,0,.02)),P(-0.45,b+.06)+Vector((0,0,.02))],(0.25,0.18,0.1)) if False else None
    # 消除特效：落叶小旋风
    c=P(5.5,5.6)
    for k in range(16):
        a=k*.8; poly([(0,.16),(.1,0),(0,-.16),(-.1,0)],(c.x+math.cos(a)*(.3+k*.06),c.y+math.sin(a)*.3,c.z+1.0+k*.12),random.choice(ORANGE),th=.02,rot=(a,a*.5,a))
    # 前方：火车头（同一条轨道）+ 远处隧道红叶山
    fy=FL.y+4.5
    LS=0.7
    box((0,fy+2.2,1.7),(3.0,4.0,1.8),(0.1,0.42,0.32),bevel=.3); cyl((0,fy+3.4,3.0),.32,1.0,(0.15,0.15,0.15)); box((0,fy+.6,2.4),(2.8,1.2,1.6),(0.1,0.42,0.32),bevel=.25)
    box((0,fy+.0,2.6),(2.0,.08,.7),(1,0.85,0.55),e=1.2)
    for xx in (-1.3,1.3):
        for yy in (fy+1,fy+3.4): cyl((xx*1.2,yy,0.62),.6,.26,(0.14,0.14,0.16),v=14,rot=(0,R(90),0))
    for _ in range(260):
        x=random.uniform(-30,30); y=random.uniform(FL.y+6,70)
        if abs(x)<3.2: continue
        tree_round(x,y,random.uniform(1.0,2.0),random.choice(ORANGE),z0=max(0,(y-30)*0.25))
    for _ in range(40): tree_cone(random.uniform(-30,30),random.uniform(FL.y+8,70),random.uniform(1.4,2.2),(0.1,0.38,0.2))
    ico((0,58,6),14,(0.8,0.3,0.06),sub=2,s=(1.8,1,0.9)); cyl((0,45.2,2),2.6,1.4,(0.2,0.12,0.1),v=16,rot=(R(90),0,0)); cyl((0,45.0,2),3.1,1.0,(0.75,0.6,0.5),v=16,rot=(R(90),0,0))
    cyl((4.2,FL.y-1,2.4),.1,4.8,(0.3,0.3,0.32)); box((4.2,FL.y-1,4.9),(.6,.3,1.0),(0.15,0.15,0.17)); ico((4.2,FL.y-1.18,5.15),.16,(1,0.25,0.15),e=6)
elif SCENE=='B_snow_starmap':
    sky([(0.0,(0.1,0.1,0.3)),(0.43,(0.22,0.18,0.5)),(0.5,(0.08,0.1,0.32)),(1.0,(0.02,0.03,0.12))],0.9)
    sun((60,0,30),1.0,(0.6,0.7,1.0)); point((0,2,7),900,(1,0.65,0.35),3)
    PLANE=[Vector((0,6,2.6)),Vector((0,-math.sin(R(20)),math.cos(R(20))))]
    report()
    # 圆形木观景台 + 积雪
    cyl((0,6,0.25),11,.5,(0.48,0.27,0.12),v=32)
    for k in range(36):
        a=k*math.pi*2/36; cyl((math.cos(a)*10.6,6+math.sin(a)*10.6,1.0),.12,1.4,(0.4,0.22,0.1),v=6)
    bpy.ops.mesh.primitive_torus_add(major_radius=10.6,minor_radius=.1,location=(0,6,1.7),major_segments=48,minor_segments=4); put(bpy.context.object,(0.4,0.22,0.1))
    for _ in range(50):
        a=random.uniform(0,6.28); r=random.uniform(8,11); o=ico((math.cos(a)*r,6+math.sin(a)*r,.5),random.uniform(.25,.5),(0.9,0.94,1.0),sub=2,s=(1.3,1.3,.35))
        for p in o.data.polygons: p.use_smooth=True
    box((0,40,-8),(200,200,1),(0.7,0.78,0.95))
    # 星图架：木框+深蓝面板+金线格
    quad(outline(0.38,lift=0,r=.45),(0.5,0.28,0.12),th=0.35)
    quad(outline(0.06,lift=0.01,r=.1),(0.02,0.05,0.2),rough=.2)
    n=PLANE[1]
    for k in range(8):
        quad([P(k-.02,0)+n*.02,P(k+.02,0)+n*.02,P(k+.02,7)+n*.02,P(k-.02,7)+n*.02],(1,0.78,0.35),e=1.6)
        quad([P(0,k-.02)+n*.02,P(7,k-.02)+n*.02,P(7,k+.02)+n*.02,P(0,k+.02)+n*.02],(1,0.78,0.35),e=1.6)
    # 支腿（落到观景台面）
    for a,b in ((0.3,7.2),(6.7,7.2),(0.3,-.2),(6.7,-.2)):
        p=P(a,b)-n*0.35; h=p.z-0.5
        if h>0.05: box((p.x,p.y,0.5+h/2),(.3,.3,h),(0.4,0.22,0.1))
    contact_shadow(0.45,.4) if False else None
    for a,b,side in edge_pts(40,0.15):   # 积雪跨过架沿
        p=P(a,b); s=cw(min(int(a),6),min(int(b),6))
        o=ico(tuple(p+n*0.05),s*random.uniform(.12,.2),(0.93,0.96,1.0),sub=2,s=(1.4,1.4,.5))
        for q in o.data.polygons: q.use_smooth=True
    fillv3(['star','moon','comet','planet','scope','book'],z=0.03,clear={(1,6),(2,6),(3,6)})
    ringv3(5,2,0.08)
    # 星座连线特效
    base=P(2,7.6); Pp=[base+Vector((-1.6,1.0,1.5)),base+Vector((-0.2,1.6,2.8)),base+Vector((1.4,1.2,3.6)),base+Vector((2.8,2,2.9))]
    for p in Pp: poly(star_pts(.25,.11),tuple(p),(1,0.85,0.4),th=.06,e=7,rot=(R(60),0,0))
    for a,b in zip(Pp,Pp[1:]):
        m=(a+b)/2; dd=b-a; o=box(tuple(m),(dd.length,.03,.03),(1,0.85,0.5),e=4); o.rotation_euler=dd.to_track_quat('X','Z').to_euler()
    # 小巧的圆顶观星台（光滑），放在台面左后
    ox,oy=-2.6,15.0
    cyl((ox,oy,1.9),2.2,2.8,(0.85,0.42,0.25),v=32)
    o=ico((ox,oy,3.3),2.2,(0.78,0.82,0.92),sub=4,s=(1,1,.85),rough=.3)
    for p in o.data.polygons: p.use_smooth=True
    box((ox+.2,oy-1.7,3.9),(.5,.3,1.6),(0.05,0.05,0.12)); cyl((ox+.3,oy-2.2,4.4),.25,2.4,(0.85,0.7,0.35),rot=(R(50),0,R(-10)),v=16,rough=.3)
    box((ox,oy-2.15,1.5),(.7,.08,1.0),(1,0.7,0.35),e=5)
    o=ico((ox,oy,1.0),2.6,(0.92,0.95,1.0),sub=2,s=(1.2,1.2,.3))
    # 小木屋+雪松+远山+极光+星
    box((6.5,15,1.6),(3.4,2.6,2.2),(0.55,0.3,0.15)); cyl((6.5,15,3.3),2.4,1.3,(0.92,0.95,1.0),v=4,rot=(0,0,R(45)),r2=.15); box((6.5,13.65,1.6),(.8,.08,.8),(1,0.7,0.35),e=5)
    for _ in range(40):
        x=random.uniform(-26,26); y=random.uniform(18,45)
        tree_cone(x,y,random.uniform(1.2,2.2),(0.05,0.32,0.28),snow=True,z0=-1)
    for k in range(10): mountain(-90+k*20,120,random.uniform(14,20),random.uniform(14,24),(0.28,0.3,0.56),cap=(0.85,0.9,1.0))
    for band,(col,z0) in enumerate((((0.1,0.95,0.55),18),((0.55,0.35,1.0),24))):
        for k in range(120):
            x=-90+k*1.5; z=z0+math.sin(k*.18+band)*4
            box((x,170+band*10,z),(3.0,.2,4+2*math.sin(k*.3)),col,e=1.0,a=.15)
    for _ in range(300): ico((random.uniform(-160,160),220,random.uniform(5,120)),.35,(1,1,0.9),sub=0,e=8)
elif SCENE=='C_cloud_terrace':
    sky([(0.0,(1.0,0.5,0.45)),(0.42,(1.0,0.58,0.35)),(0.47,(1.0,0.75,0.5)),(0.56,(0.5,0.6,0.98)),(1.0,(0.2,0.32,0.9))],0.65)
    sun((14,0,180),3.2,(1,0.74,0.5),ang=3)        # 低角度逆光（来自远处），给云团亮边
    sun((50,0,-30),0.8,(0.75,0.8,1.0))
    PLANE=[Vector((0,0,0.0)),Vector((0,0,1))]
    report()
    NL,NR,FL,FR=P(0,0),P(7,0),P(0,7),P(7,7)
    # 崖顶岩体：比棋盘大，台面嵌进去
    rock=(0.5,0.4,0.38)
    quad(outline(0.9,lift=-0.02,r=.9),rock,th=10)
    for k in range(14):
        p=P(random.choice([-1.0,8.0]),random.uniform(-1,8)); ico((p.x,p.y,-1.6),random.uniform(1.2,2.0),rock,sub=1,s=(1,1,1.3))
    quad(outline(0.3,lift=0.0,r=.4),(0.3,0.5,0.22))                  # 苔缝底
    for i in range(7):
        for j in range(7):
            s=cw(i,j); t=[(0.74,0.62,0.52),(0.68,0.56,0.48),(0.78,0.66,0.55)][(i*5+j*3)%3]
            quad(cell_pts(i,j,0.05,lift=0.1*s),t,th=0.12*s)
    fillv3(['cloud','dawn','crane','feather','whistle','pinebranch'],z=0.1,clear={(4,1),(4,2),(4,3)})
    ringv3(1,4,0.15)
    # 压边：苔藓团、草、松根跨过台沿
    for a,b,side in edge_pts(60,0.0):
        p=P(a,b); s=cw(min(int(a),6),min(int(b),6))
        o=ico((p.x,p.y,p.z+.05),s*random.uniform(.12,.22),random.choice([(0.2,0.5,0.18),(0.3,0.58,0.2),(0.45,0.62,0.25)]),sub=1,s=(1.5,1.5,.6))
    def pinet(x,y,z,s,lean=0.3):
        cyl((x,y,z+1.2*s),.2*s,2.4*s,(0.35,0.2,0.15),v=6,rot=(0,lean,0))
        for k in range(4): cyl((x+(.5*k-.6)*s+lean*2*s,y,z+(2.0+k*.35)*s),(1.6-k*.28)*s,.32*s,(0.08,0.42,0.28),v=9)
    pl=P(-0.6,7.5); pinet(pl.x,pl.y,0,0.9,.45); pr=P(7.6,7.3); pinet(pr.x,pr.y,0,0.75,-.4)
    for t in range(4):  # 松根爬过左上角台沿
        a=P(-0.6,6.6+t*.15); b=P(0.15+t*.08,6.2-t*.3); m=(a+b)/2; dd=b-a
        o=cyl(tuple(m+Vector((0,0,.08))),.07,dd.length,(0.38,0.22,0.15),v=6); o.rotation_euler=dd.to_track_quat('Z','Y').to_euler()
    # 断风筝挂在左松
    poly([(0,1),(.7,.1),(0,-.9),(-.7,.1)],(pl.x+1.0,pl.y-.3,2.9),(0.95,0.15,0.2),th=.05,rot=(R(70),R(15),0))
    # 纸鹤 + 云团噗散
    c=P(4.5,2.5)
    for k in range(6): soft_cloud((c.x+.8+k*.25,c.y+k*.3,c.z+.8+k*.35),.18+k*.05,n=3,e=.4)
    poly([(-.4,0),(0,.12),(.4,0),(0,-.07)],(c.x+1.6,c.y+1.6,c.z+3),(1,1,1),th=.03,rot=(0.3,0,0.4))
    # 蓬松云海（圆润云团，逆光亮边）
    for _ in range(260):
        x=random.uniform(-45,45); y=random.uniform(FL.y-4,90)
        if abs(x)<P(8.6,0).x+2 and y<FL.y+2: continue
        soft_cloud((x,y,random.uniform(-9,-5)),random.uniform(2.2,4.2),col=random.choice([(1,0.95,0.92),(1,0.9,0.82),(0.97,0.92,0.98)]),n=5,e=0.3)
    for _ in range(8):
        x=random.choice([-1,1])*random.uniform(9,30); y=random.uniform(FL.y+8,70); h=random.uniform(12,20)
        cyl((x,y,h/2-8),random.uniform(1.6,2.6),h,(0.55,0.42,0.45),v=7,r2=random.uniform(1.2,1.8)); pinet(x,y,h-8,0.8,random.uniform(-.3,.3))
    ico((-10,200,8),8,(1,0.85,0.5),sub=3,e=2.0)
elif SCENE=='D_hill_picnic':
    sky([(0.0,(1.0,0.45,0.25)),(0.42,(1.0,0.55,0.3)),(0.47,(1.0,0.72,0.42)),(0.56,(0.75,0.5,0.85)),(1.0,(0.3,0.3,0.8))],0.65)
    sun((30,0,170),3.4,(1,0.7,0.42))
    TL=18; PLANE=[Vector((0,6,0.8)),Vector((0,-math.sin(R(TL)),math.cos(R(TL)))) ]
    report()
    n=PLANE[1]; G=(0.24,0.58,0.1)
    # 草坡：倾斜大平面 + 坡顶
    slope=[P(-12,-6)-n*0.02,P(19,-6)-n*0.02,P(19,10.5)-n*0.02,P(-12,10.5)-n*0.02]
    quad(slope,G,th=6)
    top=P(3.5,10.4); box((0,top.y+14,top.z-1.5),(80,28,3.4),G)
    for _ in range(400):
        a=random.uniform(-6,13); b=random.uniform(-3,11)
        if -0.3<a<7.3 and -0.3<b<7.3: continue
        p=P(a,b); ico(tuple(p),random.uniform(.06,.12),random.choice([(1,0.95,0.3),(1,1,1),(0.95,0.4,0.6),(0.6,0.4,0.95)]),sub=0)
    for _ in range(300):
        a=random.uniform(-6,13); b=random.uniform(-3,11); p=P(a,b)
        cyl(tuple(p+n*.12),.04,.28,(0.2,0.5,0.08),v=3,r2=0)
    # 野餐布（格纹即棋盘），圆角布边
    quad(outline(0.3,lift=0.01,r=.45),(0.98,0.9,0.75))
    for i in range(7):
        for j in range(7):
            quad(cell_pts(i,j,0.0,lift=0.02),(1.0,0.9,0.72) if (i+j)%2==0 else (0.6,0.32,0.85))
    fillv3(['jar','kitebadge','env','scarf','strawb','dand'],z=0.02,clear={(5,2),(5,3),(5,4)},ps=1.05)
    ringv3(1,1,0.06)
    # 压边：餐篮压住右下角、草叶和花跨过布沿、风筝搭在左上角
    pb=P(7.25,-0.55); s=cw(6,0)*0.8
    place(lambda: (cyl((0,0,.42),.75,.84,(0.72,0.48,0.2),v=14), torus((0,0,.9),.66,.05,(0.6,0.4,0.2),rot=(R(90),0,0)), cyl((0,0,.86),.77,.06,(0.9,0.3,0.3),v=14)), M_at(pb,s*1.0))
    for a,b,side in edge_pts(70,0.02):
        p=P(a,b); cyl(tuple(p+n*.1),.035,.24,(0.2,0.55,0.08),v=3,r2=0,rot=(random.uniform(-.4,.4),random.uniform(-.4,.4),0))
    pk=P(0.3,7.75); place(lambda: poly([(0,1.1),(.7,.1),(0,-1.0),(-.7,.1)],(0,0,.03),(0.95,0.2,0.3),th=.04), M_at(pk,cw(0,6)*0.6,rotz=1.2))
    for k in range(8):
        p=P(0.9+k*.35,7.75+k*.08); box(tuple(p+n*.03),(.12,.3,.02),(1,0.85,0.2),rot=(0,0,k*.4))
    # 种子+萤火飘向远处
    c=P(5.5,3.5)
    for _ in range(40): ico((c.x+random.uniform(-.5,2),c.y+random.uniform(0,3),c.z+random.uniform(.6,3)),.05,random.choice([(1,1,0.95),(1,0.85,0.3)]),sub=0,e=4)
    # 坡顶大树+秋千
    tp=P(5.5,12.0)
    cyl((tp.x,tp.y,tp.z+2.2),.45,4.4,(0.4,0.22,0.1),v=7)
    for d in ((0,0,5.2),(-1.5,0,4.6),(1.5,.3,4.4),(0,-.8,6.1)): ico((tp.x+d[0],tp.y+d[1],tp.z+d[2]),1.9,(0.18,0.52,0.14),sub=1)
    box((tp.x-1.2,tp.y-1,tp.z+1.0),(1.8,.45,.1),(0.6,0.35,0.15))
    for xx in (-2.0,-0.4): box((tp.x+xx,tp.y-1,tp.z+2.5),(.04,.04,3.0),(0.9,0.85,0.7))
    ico((-6,260,-40),14,(1,0.62,0.3),sub=3,e=1.4)
    for k in range(16): box((0,top.y+30+k*7,-20),(400,3.4,1.0),(0.55,0.25,0.9) if k%2==0 else (0.3,0.58,0.12))
elif SCENE=='E_sky_kite':
    sky([(0.0,(1.0,0.45,0.4)),(0.42,(1.0,0.6,0.35)),(0.46,(1.0,0.75,0.5)),(0.55,(0.35,0.6,1.0)),(1.0,(0.05,0.25,0.95))],0.7)
    sun((50,0,-25),3.4,(1,0.84,0.62))
    fwd=cam.matrix_world.to_3x3()@Vector((0,0,-1)); PLANE=[Vector((0,7.0,1.2)),-fwd]
    report()
    n=PLANE[1]
    # 崖顶草台，风筝背靠在一块大石上、面向镜头，下沿压在草地上
    NL,NR,FL,FR=P(0,0),P(7,0),P(0,7),P(7,7)
    gz=min(NL.z,NR.z)-0.25
    cyl((0,NL.y+6,gz-6),14,12,(0.55,0.42,0.42),v=10,r2=11)
    o=cyl((0,NL.y+6,gz-0.1),14.2,.4,(0.3,0.62,0.18),v=24)
    ico(tuple((P(3.5,2)-n*6.0)),2.6,(0.55,0.45,0.45),sub=1,s=(1.4,1,1.0))
    quad(outline(0.75,lift=-0.05,r=1.4),(0.95,0.25,0.3),th=0.08)          # 八角风筝面（圆角）
    for i in range(7):
        for j in range(7): quad(cell_pts(i,j,0.04,lift=0.0),[(1,0.92,0.75),(0.99,0.85,0.65)][(i+j)%2])
    for k in range(8):   # 竹骨：跨出风筝边
        quad([P(k-.035,-0.95)+n*.05,P(k+.035,-0.95)+n*.05,P(k+.035,7.95)+n*.05,P(k-.035,7.95)+n*.05],(0.85,0.62,0.28))
        quad([P(-0.95,k-.035)+n*.05,P(7.95,k-.035)+n*.05,P(7.95,k+.035)+n*.05,P(-0.95,k+.035)+n*.05],(0.85,0.62,0.28))
    fillv3(['plane','ribbon','bell','fish','balloon','kitebadge'],z=0.06,clear={(2,0),(3,0),(4,0)})
    ringv3(5,5,0.1)
    # 草叶压住风筝下沿
    for _ in range(60):
        a=random.uniform(-0.8,7.8); p=P(a,-0.9); cyl((p.x,p.y-.1,gz+.2),.04,.5,(0.2,0.55,0.1),v=3,r2=0,rot=(random.uniform(-.4,.4),random.uniform(-.4,.4),0))
    # 彩带尾巴落在草上
    for k in range(12):
        p=P(7.4+k*.25,-0.8-k*.05); box((p.x,p.y-.3-k*.2,gz+.12),(.45,.14,.03),[(0.95,0.2,0.6),(1,0.8,0.1),(0.2,0.6,1)][k%3],rot=(0,0,k*.5))
    # 阿芳在一侧拉线
    C0=cam.matrix_world.translation; d=ray(X0+5.9*CW,Y0+8.25*CH); tz=gz+0.3; af=C0+d*((tz-C0.z)/d.z); af=Vector((af.x,af.y,tz))
    cyl((af.x,af.y,af.z+.55),.25,1.1,(0.95,0.95,0.92),v=10); ico((af.x,af.y,af.z+1.3),.27,(0.35,0.2,0.12),sub=2); box((af.x,af.y-.2,af.z+1.0),(.6,.15,.15),(1,0.75,0.05))
    # 远处：蓬松云海、石柱奇松
    for _ in range(150):
        x=random.uniform(-60,60); y=random.uniform(NL.y+14,140)
        soft_cloud((x,y,random.uniform(-12,-7)),random.uniform(2.4,4.4),col=random.choice([(1,0.9,0.88),(1,0.86,0.8),(0.96,0.88,0.95)]),n=5,e=0.18)
    for x,y,h in ((-11,40,22),(12,48,26),(-20,70,30),(22,80,28)):
        cyl((x,y,h/2-10),2.6,h,(0.6,0.42,0.42),v=7,r2=1.8)
        for k in range(3): cyl((x+k*.6-.6,y,h-9+k*.5),2.4-k*.5,.5,(0.08,0.45,0.3),v=9)
sc.render.filepath=OUT
bpy.ops.render.render(write_still=True)
print('TRIS',sum(len(o.data.polygons) for o in sc.objects if o.type=='MESH'))
