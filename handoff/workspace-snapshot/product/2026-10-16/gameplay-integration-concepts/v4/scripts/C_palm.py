# v4 C 云海 · 老铆摊开的掌心   blender -b -P C_palm.py -- C_palm <outdir>
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'common.py')).read())
random.seed(31)
# ---------- r2 ----------
# 光：主光在镜头后右上方（影子落向远处/左后，不进格子）；远处逆光给云亮边（不投影）；天光偏粉紫，云的阴面是淡紫而不是灰
sky([(0.0,(0.78,0.66,0.98)),(0.45,(1.0,0.74,0.76)),(0.52,(1.0,0.84,0.62)),(0.6,(0.62,0.72,1.0)),(1.0,(0.42,0.55,1.0))],0.85)
sun_dir((-0.35,1.0,-1.05),3.6,(1.0,0.8,0.58),ang=5)
sun_dir((0.1,-1.0,-0.35),1.2,(1.0,0.62,0.6),shadow=False)
n=NRM()
CU1=(0.25,0.56,0.5); CU2=(0.29,0.6,0.53); SEAM=(0.12,0.28,0.27); BRZ=(0.82,0.52,0.2); MOSS=[(0.3,0.58,0.12),(0.4,0.66,0.14),(0.24,0.5,0.12)]
PALM=(0.22,0.52,0.47)
def usph(loc,r,c,s=(1,1,1),seg_=14,ring_=9,**k):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg_,ring_count=ring_,radius=r,location=loc); o=bpy.context.object; o.scale=s
    put(o,c,**k); return smooth(o)
# ---------- 掌体：左侧出画，右缘在画内（外面是云）——一眼看出是悬在云上的手掌；手腕出下沿 ----------
outline_ab=[(-2.2,-3.2),(7.7,-3.2),(7.45,-1.2),(7.28,0.3),(7.32,3.5),(7.3,6.5),(7.05,7.5),(6.0,7.9),(1.0,7.95),(-0.4,7.7),(-1.4,6.6),(-2.4,3.0)]
quad(cellpoly(outline_ab,0.0),PALM,th=2.4,rough=.55)
# 掌心格区：板缝底色（深铜绿，不是黑）+ 7×7 方铆板（每块带一圈浅色倒角面）
quad(cellpoly(rrect(-0.06,-0.06,7.06,7.06,.18),0.012),SEAM,rough=.8)
for i in range(7):
    for j in range(7):
        s_=cw(i,j); base=CU1 if (i+j)%2==0 else CU2; jit=random.uniform(-.02,.02)
        o=quad(cell_pts(i,j,0.045,lift=0.06*s_),(base[0]+jit,base[1]+jit,base[2]+jit),th=0.06*s_,rough=.45); o.name='CELL_%d_%d'%(i,j)
        o=quad(cell_pts(i,j,0.11,lift=0.066*s_),(base[0]+.05,base[1]+.06,base[2]+.05),rough=.35); o.name='CELL_in_%d_%d'%(i,j)
for i in range(8):
    for j in range(8):
        s_=cw(min(i,6),min(j,6)); smooth(ico(tuple(P(i,j)+n*0.05*s_),0.07*s_,BRZ,sub=1,s=(1,1,.55),rough=.3))
# 格外掌面：铜绿锈斑 + 两圈铆钉线（像老铆的装甲接缝）
for _ in range(60):
    a=random.uniform(-2,7.2); b=random.uniform(-3,7.8)
    if -0.15<a<7.15 and -0.15<b<7.15: continue
    p=P(a,b); quad([p+Vector((dx,dy,0.004)) for dx,dy in ((-.25,-.15),(.22,-.2),(.28,.12),(-.1,.25))],random.choice([(0.34,0.68,0.58),(0.18,0.44,0.4)]))
for k in range(18):
    smooth(ico(tuple(P(7.16,0.2+k*0.39)+n*0.03),0.05,BRZ,sub=1,s=(1,1,.5),rough=.3))
    smooth(ico(tuple(P(-0.25+k*0.42,7.3)+n*0.03),0.05,BRZ,sub=1,s=(1,1,.5),rough=.3))
# ---------- 掌丘（都在格外，只往外鼓） ----------
def mound(a,b,rx,ry,h,c=PALM):
    p=P(a,b); return smooth(ico((p.x,p.y,p.z),1.0,c,sub=2,s=(rx,ry,h),rough=.5))
mound(-1.6,2.2,1.5,2.6,0.55); mound(3.3,-2.3,5.6,1.2,0.28)
for a in (0.95,2.75,4.55,6.2): mound(a,7.6,0.95,0.55,0.4)
for _ in range(26):
    a=random.uniform(-2.1,-0.4); b=random.uniform(0.2,5.2); p=P(a,b)
    smooth(ico((p.x,p.y,p.z+0.32),random.uniform(.12,.26),random.choice(MOSS),sub=1,s=(1.4,1.4,.6)))
# ---------- 四根手指：贴着平伸、略张开，末节微微上翘；指节铜环、指甲铜片、铆钉 ----------
def finger(a,spread,lens,rads,pitches):
    base=P(a,7.6)+Vector((0,0,0.22)); d0=Vector((math.sin(R(spread)),math.cos(R(spread)),0))
    p=base; pts=[p]; smooth(ico(tuple(base),rads[0]*1.04,PALM,sub=2,rough=.5))
    for L,r,pc in zip(lens,rads,pitches):
        d=Vector((d0.x*math.cos(R(pc)),d0.y*math.cos(R(pc)),math.sin(R(pc))))
        q=p+d*L; seg(p,q,r,PALM,v=14,r2=r*0.9,rough=.5); smooth(ico(tuple(q),r*0.98,PALM,sub=2,rough=.5))
        rot=d.to_track_quat('Z','Y').to_euler()
        torus(tuple(p+d*0.22),r*1.0,0.07,BRZ,rot=rot,rough=.3)
        for t in (0.45,0.75): smooth(ico(tuple(p+d*L*t+Vector((0,0,r*0.93))),0.06,BRZ,sub=1,s=(1,1,.5),rough=.3))
        pts.append(q); p=q
    tip=pts[-1]; dd=(pts[-1]-pts[-2]).normalized()
    smooth(ico(tuple(tip-dd*0.15+Vector((0,0,rads[-1]*0.72))),rads[-1]*0.6,BRZ,sub=2,s=(1,1.3,.35),rough=.25))   # 指甲
    for k in range(4):
        q=pts[1]+Vector((random.uniform(-.3,.3),random.uniform(-.3,.3),rads[1]*0.85))
        smooth(ico(tuple(q),random.uniform(.12,.2),random.choice(MOSS),sub=1,s=(1.3,1.3,.6)))
    return pts
F=[finger(0.95,-22,(1.8,1.4,1.1),(.58,.52,.46),(4,12,30)),
   finger(2.75,-8,(2.2,1.7,1.25),(.62,.56,.5),(3,10,26)),
   finger(4.55,6,(2.1,1.6,1.2),(.6,.54,.48),(3,11,28)),
   finger(6.2,20,(1.6,1.25,0.95),(.52,.46,.4),(5,14,32))]
# 拇指：沿左侧低伏，指尖只压到第 0 列外缘
tb=P(-1.4,1.0)+Vector((0,0,0.4)); tm=P(-0.95,3.0)+Vector((0,0,0.42)); tt=P(-0.42,4.75)+Vector((0,0,0.3))
for a_,b_,r in ((tb,tm,.62),(tm,tt,.54)):
    seg(a_,b_,r,PALM,v=14,r2=r*.92,rough=.5); smooth(ico(tuple(b_),r*.98,PALM,sub=2,rough=.5))
    dd=(b_-a_).normalized(); torus(tuple(a_+dd*0.22),r,0.07,BRZ,rot=dd.to_track_quat('Z','Y').to_euler(),rough=.3)
dd=(tt-tm).normalized(); smooth(ico(tuple(tt-dd*0.12+Vector((0,0,0.38))),0.32,BRZ,sub=2,s=(1,1.3,.35),rough=.25))
# 拇指丘上的小奇松（原创：歪干 + 三层小圆冠）
pt=P(-1.25,5.4)
seg((pt.x,pt.y,pt.z+0.3),(pt.x+0.45,pt.y+0.4,pt.z+1.5),0.08,(0.42,0.26,0.16),v=6,r2=0.05)
for dx,dz,r in ((0.1,1.0,.42),(0.38,1.35,.36),(0.6,1.62,.26)): smooth(ico((pt.x+dx,pt.y+dx,pt.z+dz),r,(0.12,0.46,0.28),sub=1,s=(1.6,1.3,.5)))
# 纸鹤停在指尖；断风筝卡在中间两指之间
def crane(p,s=1.0,rz=0.0):
    poly([(-.42,0),(0,.12),(.42,0),(0,-.08)],(p.x,p.y,p.z+.12*s),(1,1,1),th=.04*s,s=s,rot=(0,0,rz))
    smooth(ico((p.x,p.y,p.z+.12*s),.09*s,(1,1,1),sub=1,s=(1,2.2,1),rot=(0,0,rz)))
    poly([(0,0),(.14,0),(0,.36)],(p.x,p.y,p.z+.08*s),(0.95,0.32,0.36),th=.04*s,s=s,rot=(R(90),0,rz))
crane(F[1][-1]+Vector((0,0,.5)),1.4,0.4); crane(F[3][-1]+Vector((0,0,.42)),1.2,-0.6)
km=(F[1][2]+F[2][2])/2+Vector((0,0.2,0.35))
poly([(0,1.0),(.75,.1),(.1,-.3),(0,-.95),(-.7,.1)],tuple(km),(0.95,0.22,0.28),th=.05,rot=(R(30),R(12),R(8)))
poly([(0,1.0),(.75,.1),(0,.1)],tuple(km+Vector((0,-0.02,0.04))),(1,0.82,0.15),th=.01,rot=(R(30),R(12),R(8)))
for k in range(7): box(tuple(km+Vector((0.3+k*.22,-0.6-k*.12,-0.15-k*.03))),(.22,.08,.03),[(1,0.82,0.15),(0.25,0.6,1.0)][k%2],rot=(0,0,k*.5))
# ---------- 手腕：铜护腕 + 苔藓野花（底部前景） ----------
for k,(bb,wd,c) in enumerate(((-0.95,.15,BRZ),(-1.3,.1,(0.66,0.4,0.16)))):
    quad(cellpoly([(-2.4,bb-wd),(7.7,bb-wd),(7.6,bb+wd),(-2.4,bb+wd)],0.07),c,th=.09,rough=.3)
for k in range(17): smooth(ico(tuple(P(-0.45+k*0.48,-0.95)+n*0.15),0.055,(1.0,0.8,0.42),sub=1,rough=.25))
FLC=[(1,0.92,0.3),(1,1,0.98),(0.98,0.45,0.6),(0.7,0.5,0.98)]
def flower(p,c,s=1.0):
    cyl(tuple(p+n*.09*s),.012*s,.18*s,(0.25,0.5,0.12),v=3); poly(star_pts(.09*s,.04*s,5),tuple(p+n*.19*s),c,th=.015); ico(tuple(p+n*.2*s),.025*s,(1,0.8,0.2),sub=0)
for _ in range(36):
    a=random.uniform(-0.4,7.2); b=random.uniform(-0.75,0.04) if random.random()<0.6 else random.uniform(-2.0,-1.5)
    p=P(a,b); smooth(ico(tuple(p+n*0.04),random.uniform(.1,.2),random.choice(MOSS),sub=1,s=(1.6,1.3,.5)))
for _ in range(44):
    a=random.uniform(-0.4,7.2); b=random.uniform(-0.8,0.06); p=P(a,b)
    if random.random()<0.45: cyl(tuple(p+n*.1),.03,.22,random.choice(MOSS),v=3,r2=0,rot=(random.uniform(-.4,.4),random.uniform(-.4,.4),0))
    else: flower(p,random.choice(FLC),random.uniform(.8,1.1))
for _ in range(10):
    p=P(random.uniform(7.0,7.2),random.uniform(0.3,6.7)); smooth(ico(tuple(p+n*0.04),random.uniform(.08,.13),random.choice(MOSS),sub=1,s=(1.5,1.3,.5)))
# ---------- 云：圆润、有体积（UV 球平滑），亮面暖粉金、阴面淡紫 ----------
CLD=[(1.0,0.95,0.93),(1.0,0.92,0.88),(0.98,0.94,1.0)]
def cumulus(c,r,k=5,col=None,shadow=True,segs=(12,8)):
    col=col or random.choice(CLD); objs=[]
    for q in range(k):
        rr=r*random.uniform(.5,.85); dx=random.uniform(-1,1)*r*1.0; dy=random.uniform(-.5,.5)*r; dz=random.uniform(.05,.55)*r*(1-abs(dx)/(r*1.3))
        objs.append(usph((c.x+dx,c.y+dy,c.z+dz),rr,col,s=(1,1,.85),seg_=segs[0],ring_=segs[1],rough=.95,e=0.18))
    objs.append(usph((c.x,c.y,c.z-r*.1),r*1.15,col,s=(1.5,1.1,.42),seg_=segs[0],ring_=segs[1],rough=.95,e=0.18))
    if not shadow:
        for o in objs: o.visible_shadow=False
    return objs
VZ=-24.0
NX,NY=30,26; vs=[]; fs=[]
for yy in range(NY+1):
    for xx in range(NX+1):
        x=-90+xx*180/NX; y=10+yy*130/NY
        vs.append(Vector((x,y,VZ+1.8*math.sin(x*.11+y*.07)+1.4*math.sin(x*.23-y*.13+1.3)+random.uniform(-.5,.5))))
for yy in range(NY):
    for xx in range(NX):
        a=yy*(NX+1)+xx; fs.append([a,a+1,a+NX+2,a+NX+1])
smooth(mesh_obj(vs,fs,(1.0,0.9,0.9),'cloudsea',rough=.95,e=0.15))
for _ in range(22):
    q=Vector((random.uniform(-60,60),random.uniform(30,110),VZ+random.uniform(0.5,3.0))); cumulus(q,random.uniform(4.5,8.0),k=4)
for k in range(6):   # 指缝后面的大云团
    q=P(-0.5+k*1.6,9.5)+Vector((0,7+k%2*4,-9)); cumulus(q,random.uniform(2.4,3.2),k=5,segs=(14,9))
# 近景：云漫上掌缘右侧（只在格外、不投影到格子上），手腕两角
for b in (0.4,1.9,3.4,4.9,6.3):
    p=P(7.55+random.uniform(0,.12),b); cumulus(Vector((p.x,p.y,p.z-0.2)),0.48,k=4,shadow=False,segs=(14,9))
p=P(7.5,-1.6); cumulus(Vector((p.x,p.y,p.z-0.1)),0.65,k=5,shadow=False,segs=(14,9))
# ---------- 远景地标：石柱奇松（灰蓝花岗岩）+ 老铆半张脸 ----------
def on_ray(u,v,z):
    d=ray(u,v); t=(z-CAMC.z)/d.z; return CAMC+d*t
def pillar(q,h,r):
    z=q.z
    for k in range(4):
        hh=h/4*random.uniform(.85,1.1); cyl((q.x+random.uniform(-.3,.3),q.y,z+hh/2),r*(1-k*.1),hh,random.choice([(0.42,0.46,0.6),(0.48,0.5,0.64),(0.36,0.4,0.55)]),v=7,r2=r*(0.9-k*.1),rough=.85); z+=hh
    seg((q.x,q.y,z),(q.x+r*.6,q.y,z+r*.9),r*.08,(0.4,0.25,0.16),v=5)
    for t in range(3): smooth(ico((q.x+r*.6+(t-1)*r*.45,q.y,z+r*.6+t*r*.25),r*(.55-t*.12),(0.1,0.45,0.3),sub=1,s=(1.7,1.2,.45)))
for (u,v,top,r) in ((0.12,0.975,-18,2.2),(0.33,0.995,-19,2.6),(0.62,0.99,-18.5,2.4),(0.96,0.83,-18,1.6),(0.03,0.88,-19,1.7)):
    q=on_ray(u,v,top); pillar(Vector((q.x,q.y,VZ-2)),top-(VZ-2),r)
hq=on_ray(0.80,0.87,VZ+1.5)
smooth(ico(tuple(hq),7.0,(0.27,0.56,0.5),sub=3,s=(1,0.9,0.95),rough=.5))
smooth(ico(tuple(hq+Vector((0,-3.2,3.6))),4.2,(0.2,0.44,0.42),sub=2,s=(1.3,.6,.45),rough=.4))     # 眉罩
smooth(ico(tuple(hq+Vector((0,-5.6,2.4))),1.5,(1.0,0.74,0.32),sub=2,s=(1,.45,1),e=3.0))
torus(tuple(hq+Vector((0,-5.35,2.4))),1.7,0.3,BRZ,rot=(R(90),0,0))
seg(hq+Vector((1.5,0,6.2)),hq+Vector((2.2,0,10.0)),0.18,BRZ,v=6)
poly([(0,0),(1.6,.5),(1.6,-.5)],tuple(hq+Vector((2.3,0,10.0))),(0.95,0.3,0.25),th=.1,rot=(R(90),0,0))
for k in range(5): cumulus(hq+Vector((random.uniform(-9,9),random.uniform(-8,-4),-1.5+random.uniform(0,1.5))),random.uniform(2.6,3.8),k=4)
for k in range(5): crane(on_ray(0.30+k*0.05,0.9+0.012*(k%2),-4),1.2,0.3)
def fish(q,s,rot):
    smooth(ico(tuple(q),.35*s,(0.2,0.7,1.0),sub=2,s=(1.2,.45,.45),rot=rot)); poly([(0,0),(.35,.25),(.35,-.25)],tuple(q+Vector((.45*s,0,0))),(0.15,0.55,0.95),th=.04,s=s,rot=rot)
    poly([(0,0),(.25,.5),(-.15,.45)],tuple(q),(0.6,0.88,1.0),th=.02,s=s,rot=rot)
# ---------- 棋子（云朵、曦光石、纸鹤、羽毛、风哨、风筝徽章） ----------
def pc(kind):
    if kind=='cloud':
        for dx,dz,r in ((-.17,.17,.18),(.17,.16,.17),(0,.27,.23),(.0,.13,.2)): usph((dx,0,dz),r,(1,0.99,1),seg_=12,ring_=8,rough=.9)
        box((0,0,.06),(.6,.3,.08),(0.8,0.86,1.0),bevel=.04)
    elif kind=='dawn':
        ico((0,0,.24),.3,(1.0,0.48,0.12),sub=1,s=(1,1,1.1),e=.7,rough=.25); ico((0,0,.3),.17,(1,0.85,0.4),sub=0,e=2.0)
    elif kind=='crane':
        poly([(-.46,0),(0,.15),(.46,0),(0,-.09)],(0,0,.22),(1,1,1),th=.05); smooth(ico((0,0,.22),.1,(1,1,1),sub=1,s=(1,2.4,1.1)))
        poly([(0,0),(.16,0),(0,.4)],(0,.18,.16),(0.95,0.25,0.3),th=.05,rot=(R(90),0,0)); poly([(0,0),(.1,0),(0,.22)],(0,-.2,.2),(0.95,0.25,0.3),th=.04,rot=(R(70),0,R(180)))
    elif kind=='feather':
        smooth(ico((0,0,.12),.38,(0.95,0.35,0.65),sub=2,s=(.38,1,.22),rot=(0,0,R(30)))); seg((-.1,-.18,.15),(.17,.32,.17),.02,(1,0.95,0.85),v=4)
        smooth(ico((0,0,.16),.2,(1,0.7,0.85),sub=1,s=(.25,1,.12),rot=(0,0,R(30))))
    elif kind=='whistle':
        smooth(cyl((0,0,.18),.15,.5,(1.0,0.78,0.1),rot=(0,R(90),R(20)),v=12,rough=.3)); torus((-.25,-.1,.18),.08,.025,(0.6,0.4,0.2)); box((.18,.06,.27),(.1,.08,.04),(0.6,0.4,0.15),rot=(0,0,R(20)))
    elif kind=='kite':
        poly([(0,.42),(.3,.04),(0,-.36),(-.3,.04)],(0,0,.06),(0.95,0.18,0.25),th=.07)
        poly([(0,.42),(.3,.04),(0,.04)],(0,0,.1),(1,0.82,0.12),th=.01); poly([(0,-.36),(-.3,.04),(0,.04)],(0,0,.1),(1,0.82,0.12),th=.01)
        for k in range(3): box((.06+k*.08,-.42-k*.07,.05),(.1,.05,.02),(0.25,0.6,1.0),rot=(0,0,.6))
KINDS=['cloud','dawn','crane','feather','whistle','kite']
CLEAR=[(4,1),(4,2),(4,3)]
def kind_at(i,j):
    if (i,j) in CLEAR: return 'cloud'
    k=KINDS[(i*2+j*3+(i*j)%5+(j//2))%6]
    if k=='cloud' and i in (3,5) and j in (1,2,3): k='dawn'
    return k
for i in range(7):
    for j in range(7):
        k=kind_at(i,j); add_piece(lambda k=k: pc(k),i,j,1.02*(1.18 if (i,j) in CLEAR else 1.0),lift=0.066)
ring(1,4,0.1)
# 消除示意：三朵云被风吹出掌缘、散成小云团飘进云海；飞鱼跃起去接（不投影）
c=P(4.5,2.0)+n*0.4
with Grab() as g:
    for k in range(7): cumulus(c+Vector((0.9+k*0.45,0.25+k*0.25,0.5+k*0.2)),0.12+k*0.035,k=3,shadow=False,segs=(10,6))
    fish(P(7.6,3.6)+Vector((0.6,0,1.2)),1.2,(0,R(-25),R(-160)))
for o in g.objs: o.visible_shadow=False
fx(g.objs)
finish([('top_fingers',P(3.5,6.8)+n*0.2,(0.6,-3.2,2.6)),
        ('left_thumb',P(0.3,4.3)+n*0.2,(1.8,-2.4,2.2)),
        ('right_edge',P(6.8,3.0)+n*0.1,(-2.4,-2.6,2.2)),
        ('bottom_wrist',P(6.0,0.3)+n*0.1,(-1.0,-3.0,2.4))])
