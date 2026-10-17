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
Y0=0.10; CH=CW*720/1280      # 屏幕 y：方格
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
