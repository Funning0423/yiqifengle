# v4 C 云海 · 老铆摊开的掌心   blender -b -P C_palm.py -- C_palm <outdir>
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'common.py')).read())
random.seed(31)
# ---------- 光：主光在镜头后右上方（影子落向远处/左后，不进格子）；远处逆光给云亮边（不投影） ----------
sky([(0.0,(0.62,0.6,0.92)),(0.45,(0.95,0.72,0.72)),(0.52,(1.0,0.82,0.6)),(0.6,(0.55,0.68,1.0)),(1.0,(0.3,0.45,0.95))],0.55)
sun_dir((-0.35,1.0,-1.05),3.3,(1.0,0.82,0.62),ang=5)
sun_dir((0.1,-1.0,-0.35),1.1,(1.0,0.66,0.62),shadow=False)
n=NRM()
CU1=(0.27,0.56,0.5); CU2=(0.31,0.6,0.53); SEAM=(0.1,0.2,0.2); BRZ=(0.78,0.5,0.22); MOSS=[(0.3,0.55,0.14),(0.38,0.62,0.16),(0.24,0.46,0.12)]
PALM=(0.24,0.5,0.46)
# ---------- 掌体：比画面宽（左右出画），手腕出下沿 ----------
outline_ab=[(-1.9,-3.2),(8.2,-3.2),(8.0,-1.0),(7.6,0.4),(7.55,3.5),(7.55,6.4),(7.25,7.45),(6.0,7.8),(1.0,7.85),(-0.4,7.6),(-1.4,6.6),(-2.2,3.0),(-2.2,-3.2)]
quad(cellpoly(outline_ab,-0.0),PALM,th=2.4,rough=.55)
# 掌心格区：一块略下沉的深色底（=板缝色），7×7 方铆板嵌在上面
quad(cellpoly(rrect(-0.06,-0.06,7.06,7.06,.18),0.012),SEAM,rough=.8)
for i in range(7):
    for j in range(7):
        s=cw(i,j); o=quad(cell_pts(i,j,0.045,lift=0.06*s),CU1 if (i+j)%2==0 else CU2,th=0.06*s,rough=.45)
        o.name='CELL_%d_%d'%(i,j)
# 铆钉：落在格角（板缝交点）
for i in range(8):
    for j in range(8):
        s=cw(min(i,6),min(j,6)); o=ico(tuple(P(i,j)+n*0.05*s),0.07*s,BRZ,sub=1,s=(1,1,.55),rough=.3); smooth(o)
# 铜绿锈斑（只在格外的掌面）
for _ in range(70):
    a=random.uniform(-2,8); b=random.uniform(-3,7.7)
    if -0.15<a<7.15 and -0.15<b<7.15: continue
    p=P(a,b); quad([p+Vector((dx,dy,0.004)) for dx,dy in ((-.25,-.15),(.22,-.2),(.28,.12),(-.1,.25))],random.choice([(0.36,0.66,0.58),(0.2,0.42,0.4),(0.55,0.42,0.25)]))
# ---------- 掌丘：拇指丘（左）、掌根（下）、指根肉垫（上）——都在格外，只往外鼓 ----------
def mound(a,b,rx,ry,h,c=PALM,sub=2):
    p=P(a,b); o=smooth(ico((p.x,p.y,p.z),1.0,c,sub=sub,s=(rx,ry,h),rough=.5)); return o
mound(-1.55,2.2,1.5,2.6,0.55)
mound(3.5,-2.3,5.8,1.2,0.28)
for k,a in enumerate((0.95,2.75,4.55,6.3)):
    mound(a,7.55,0.95,0.55,0.42)
# 拇指丘上的苔藓 + 小奇松（原创：三层圆冠）
for _ in range(26):
    a=random.uniform(-2.1,-0.35); b=random.uniform(0.2,5.2); p=P(a,b)
    smooth(ico((p.x,p.y,p.z+0.32),random.uniform(.12,.26),random.choice(MOSS),sub=1,s=(1.4,1.4,.6)))
pt=P(-1.25,4.6)
seg((pt.x,pt.y,pt.z+0.3),(pt.x+0.5,pt.y+0.5,pt.z+1.8),0.09,(0.42,0.26,0.16),v=6,r2=0.05)
for k,(dx,dz,r) in enumerate(((0.1,1.2,.55),(0.45,1.65,.5),(0.7,2.0,.38))):
    smooth(ico((pt.x+dx,pt.y+dx,pt.z+dz),r,(0.12,0.44,0.28),sub=1,s=(1.6,1.3,.5)))
# ---------- 四根手指：从指根向远处伸出、逐节上翘、略张开（不回勾到棋盘上） ----------
def finger(a,spread,lens,rads,pitches,moss=True):
    base=P(a,7.55)+Vector((0,0,0.25)); d0=Vector((math.sin(R(spread)),math.cos(R(spread)),0))
    p=base; pts=[p]
    for L,r,pc in zip(lens,rads,pitches):
        d=Vector((d0.x*math.cos(R(pc)),d0.y*math.cos(R(pc)),math.sin(R(pc))))
        q=p+d*L; seg(p,q,r,PALM,v=12,r2=r*0.92,rough=.5); smooth(ico(tuple(q),r*0.97,PALM,sub=2,rough=.5))
        torus(tuple(p+d*0.18),r*1.0,0.06,BRZ,rot=d.to_track_quat('Z','Y').to_euler(),rough=.3)
        pts.append(q); p=q
    smooth(ico(tuple(base),rads[0]*1.02,PALM,sub=2,rough=.5))
    if moss:
        for k in range(5):
            q=pts[-1]+Vector((random.uniform(-.3,.3),random.uniform(-.3,.3),rads[-1]*0.8))
            smooth(ico(tuple(q),random.uniform(.12,.2),random.choice(MOSS),sub=1,s=(1.3,1.3,.6)))
    return pts
F=[finger(0.95,-13,(1.6,1.2,0.9),(.58,.52,.46),(18,42,66)),
   finger(2.75,-4,(1.9,1.4,1.0),(.62,.56,.5),(15,38,62)),
   finger(4.55,5,(1.8,1.3,1.0),(.6,.54,.48),(16,40,64)),
   finger(6.3,15,(1.4,1.05,0.8),(.52,.46,.4),(20,46,70))]
# 拇指：沿左侧低伏，指尖只压到第 0 列外缘
tb=P(-1.35,1.0)+Vector((0,0,0.4)); tm=P(-0.95,3.0)+Vector((0,0,0.45)); tt=P(-0.48,4.7)+Vector((0,0,0.34))
for a,b,r in ((tb,tm,.62),(tm,tt,.54)):
    seg(a,b,r,PALM,v=12,r2=r*.92,rough=.5); smooth(ico(tuple(b),r*.97,PALM,sub=2,rough=.5))
    dd=(b-a).normalized(); torus(tuple(a+dd*0.2),r,0.06,BRZ,rot=dd.to_track_quat('Z','Y').to_euler(),rough=.3)
# 纸鹤停在两根指尖；断风筝卡在中间两指之间
def crane(p,s=1.0,rz=0.0):
    poly([(-.42,0),(0,.12),(.42,0),(0,-.08)],(p.x,p.y,p.z+.12*s),(1,1,1),th=.04*s,s=s,rot=(0,0,rz))
    poly([(0,0),(.14,0),(0,.36)],(p.x,p.y,p.z+.08*s),(0.95,0.32,0.36),th=.04*s,s=s,rot=(R(90),0,rz))
crane(F[1][-1]+Vector((0,0,.5)),1.4,0.4); crane(F[3][-1]+Vector((0,0,.42)),1.2,-0.6)
km=(F[1][2]+F[2][2])/2+Vector((0,0.3,0.2))
poly([(0,1.0),(.75,.1),(.1,-.3),(0,-.95),(-.7,.1)],tuple(km),(0.95,0.22,0.28),th=.05,rot=(R(62),R(12),R(8)))
poly([(0,1.0),(.75,.1),(0,.1)],tuple(km+Vector((0,-0.05,0.03))),(1,0.82,0.15),th=.01,rot=(R(62),R(12),R(8)))
for k in range(7): box(tuple(km+Vector((0.3+k*.22,-0.5-k*.1,-0.3-k*.12))),(.22,.08,.03),[(1,0.82,0.15),(0.25,0.6,1.0)][k%2],rot=(0,0,k*.5))
# ---------- 手腕：铜护腕 + 苔藓野花（底部前景，压到第 0 行下沿） ----------
for k in range(2):
    bb=-1.05-k*0.32; quad(cellpoly([(-2.3,bb-.11),(8.4,bb-.11),(8.4,bb+.11),(-2.3,bb+.11)],0.06),BRZ if k==0 else (0.62,0.38,0.16),th=.08,rough=.3)
for k in range(16):
    p=P(-0.4+k*0.52,-1.05)+n*0.12; smooth(ico(tuple(p),0.05,(0.95,0.75,0.4),sub=1,rough=.25))
FLC=[(1,0.95,0.35),(1,1,0.98),(0.98,0.5,0.62),(0.72,0.55,0.95)]
def flower(p,c,s=1.0):
    cyl(tuple(p+n*.09*s),.012*s,.18*s,(0.25,0.5,0.12),v=3); poly(star_pts(.09*s,.04*s,5),tuple(p+n*.19*s),c,th=.015); ico(tuple(p+n*.2*s),.025*s,(1,0.8,0.2),sub=0)
for _ in range(34):   # 苔藓团：一部分跨过棋盘下沿（只到格边 0.12 内）
    a=random.uniform(-0.4,7.4); b=random.uniform(-0.75,0.04) if random.random()<0.6 else random.uniform(-2.0,-1.45)
    p=P(a,b); smooth(ico(tuple(p+n*0.04),random.uniform(.1,.2),random.choice(MOSS),sub=1,s=(1.6,1.3,.5)))
for _ in range(40):
    a=random.uniform(-0.4,7.4); b=random.uniform(-0.8,0.06); p=P(a,b)
    if random.random()<0.5: cyl(tuple(p+n*.1),.03,.22,random.choice(MOSS),v=3,r2=0,rot=(random.uniform(-.4,.4),random.uniform(-.4,.4),0))
    else: flower(p,random.choice(FLC),random.uniform(.8,1.1))
for _ in range(14):  # 右缘苔藓/草叶跨边
    b=random.uniform(0.3,6.7); p=P(random.uniform(7.0,7.35),b)
    smooth(ico(tuple(p+n*0.04),random.uniform(.1,.17),random.choice(MOSS),sub=1,s=(1.5,1.3,.5)))
# ---------- 云：蓬松、有体积的积云团（白→暖粉亮面，紫蓝阴面由天光给出） ----------
CLD=[(0.97,0.95,0.96),(1.0,0.93,0.9),(0.95,0.94,1.0)]
def cumulus(c,r,k=7,sub=1,flat=0.62,col=None):
    col=col or random.choice(CLD)
    for q in range(k):
        rr=r*random.uniform(.45,.85); dx=random.uniform(-1,1)*r*1.1; dy=random.uniform(-.6,.6)*r; dz=random.uniform(0,.55)*r*(1-abs(dx)/(r*1.4))
        smooth(ico((c.x+dx,c.y+dy,c.z+dz),rr,col,sub=sub,s=(1,1,flat+.3),rough=.95,e=0.12))
    smooth(ico((c.x,c.y,c.z-r*.15),r*1.25,col,sub=sub,s=(1.5,1.1,.35),rough=.95,e=0.12))
# 云海底层：起伏的连续云面（细分网格 + 噪声），远处铺满
VZ=-24.0
NX,NY=34,30; vs=[]; fs=[]
for yy in range(NY+1):
    for xx in range(NX+1):
        x=-90+xx*180/NX; y=10+yy*130/NY
        z=VZ+1.8*math.sin(x*.11+y*.07)+1.4*math.sin(x*.23-y*.13+1.3)+random.uniform(-.5,.5)
        vs.append(Vector((x,y,z)))
for yy in range(NY):
    for xx in range(NX):
        a=yy*(NX+1)+xx; fs.append([a,a+1,a+NX+2,a+NX+1])
smooth(mesh_obj(vs,fs,(0.93,0.91,0.97),'cloudsea',rough=.95,e=0.1))
# 积云团（远中景）
for _ in range(46):
    x=random.uniform(-70,70); y=random.uniform(26,120)
    q=Vector((x,y,VZ+random.uniform(0.5,3.0))); cumulus(q,random.uniform(3.5,7.0),k=6)
# 近景云团：漫上掌缘右侧和手腕右下角（只在格外），以及指缝后
for b in (0.6,2.2,3.9,5.6,6.9):
    p=P(7.62+random.uniform(0,.12),b); cumulus(Vector((p.x,p.y,p.z-0.2)),0.5,k=5,sub=2)
p=P(7.6,-1.6); cumulus(Vector((p.x,p.y,p.z-0.1)),0.7,k=6,sub=2)
p=P(-0.9,-2.2); cumulus(Vector((p.x,p.y,p.z-0.2)),0.6,k=5,sub=2)
for k in range(6):
    q=P(random.uniform(0,7),8.6+k*0.4)+Vector((0,6+k*3,-6-k*1.5)); cumulus(q,random.uniform(1.8,2.8),k=6)
# ---------- 远景地标：石柱奇松（灰蓝花岗岩，不是粉色）+ 老铆半张脸 ----------
def on_ray(u,v,z):
    d=ray(u,v); t=(z-CAMC.z)/d.z; return CAMC+d*t
def pillar(q,h,r):
    z=q.z; k=0
    while k<4:
        hh=h/4*random.uniform(.85,1.1); cyl((q.x+random.uniform(-.3,.3),q.y,z+hh/2),r*(1-k*.1),hh,random.choice([(0.44,0.46,0.55),(0.5,0.5,0.58),(0.38,0.41,0.5)]),v=7,r2=r*(0.9-k*.1),rough=.85); z+=hh; k+=1
    for t in range(3): smooth(ico((q.x+(t-1)*r*.6,q.y,z+.3+t*.25),r*(1.1-t*.25),(0.1,0.42,0.28),sub=1,s=(1.6,1.2,.45)))
for (u,v,top,r) in ((0.10,0.93,-12,2.2),(0.26,0.985,-14,2.8),(0.60,0.975,-13,3.0),(0.95,0.72,-15,1.7),(0.03,0.78,-16,1.6)):
    q=on_ray(u,v,top); pillar(Vector((q.x,q.y,VZ-2)),top-(VZ-2),r)
# 老铆：远处云里露出半个头（原创：圆罩头、单只琥珀眼灯、风标天线）
hq=on_ray(0.80,0.865,VZ+1.5)
smooth(ico(tuple(hq),7.0,(0.3,0.56,0.5),sub=2,s=(1,0.9,0.95),rough=.5))
smooth(ico(tuple(hq+Vector((0,-5.4,2.6))),1.6,(1.0,0.72,0.3),sub=2,s=(1,.45,1),e=3.0))
torus(tuple(hq+Vector((0,-5.15,2.6))),1.75,0.28,BRZ,rot=(R(90),0,0))
box(tuple(hq+Vector((0,-5.2,4.6))),(5.0,1.2,0.5),(0.22,0.45,0.42),rot=(R(-20),0,0))
seg(hq+Vector((1.5,0,6.4)),hq+Vector((2.2,0,10.0)),0.18,BRZ,v=6)
poly([(0,0),(1.6,.5),(1.6,-.5)],tuple(hq+Vector((2.3,0,10.0))),(0.95,0.3,0.25),th=.1,rot=(R(90),0,0))
for k in range(5): cumulus(hq+Vector((random.uniform(-9,9),random.uniform(-7,-3),-2+random.uniform(0,1.5))),random.uniform(2.6,4.0),k=6)
# 远处一群纸鹤 + 跃出云面的飞鱼
for k in range(5):
    q=at_screen(0.35+k*0.05,0.86+0.012*(k%2),40+k*2); crane(q,1.1,0.3)
def fish(q,s,rot):
    o=smooth(ico(tuple(q),.35*s,(0.2,0.7,1.0),sub=1,s=(1.2,.45,.45),rot=rot)); poly([(0,0),(.35,.25),(.35,-.25)],tuple(q+Vector((.45*s,0,0))),(0.15,0.55,0.95),th=.04,s=s,rot=rot)
    poly([(0,0),(.25,.5),(-.15,.45)],tuple(q),(0.6,0.88,1.0),th=.02,s=s,rot=rot); return o
# ---------- 棋子（6 类：云朵、曦光石、纸鹤、羽毛、风哨、风筝徽章） ----------
def pc(kind):
    if kind=='cloud':
        for dx,dz,r in ((-.17,.17,.18),(.17,.16,.17),(0,.27,.23),(.0,.13,.2)): smooth(ico((dx,0,dz),r,(1,0.99,1),sub=1,rough=.9))
        box((0,0,.06),(.6,.3,.08),(0.82,0.86,1.0),bevel=.04)
    elif kind=='dawn':
        o=ico((0,0,.24),.3,(1.0,0.48,0.12),sub=1,s=(1,1,1.1),e=.7,rough=.25)
        ico((0,0,.3),.17,(1,0.85,0.4),sub=0,e=2.0)
    elif kind=='crane':
        poly([(-.44,0),(0,.13),(.44,0),(0,-.08)],(0,0,.22),(1,1,1),th=.05); poly([(0,0),(.16,0),(0,.38)],(0,0,.15),(0.95,0.25,0.3),th=.05,rot=(R(90),0,0))
        poly([(0,0),(.12,.05),(.2,.3)],(-.05,.1,.2),(0.98,0.98,0.95),th=.03,rot=(R(70),0,0))
    elif kind=='feather':
        smooth(ico((0,0,.12),.38,(0.95,0.35,0.65),sub=1,s=(.36,1,.22),rot=(0,0,R(30)))); seg((-.18,-.33,.12),(.17,.32,.16),.02,(1,0.95,0.85),v=4)
    elif kind=='whistle':
        smooth(cyl((0,0,.18),.15,.5,(1.0,0.78,0.1),rot=(0,R(90),R(20)),v=10,rough=.3)); torus((-.25,-.1,.18),.08,.025,(0.6,0.4,0.2)); box((.18,.06,.27),(.1,.08,.04),(0.6,0.4,0.15),rot=(0,0,R(20)))
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
        k=kind_at(i,j); add_piece(lambda k=k: pc(k),i,j,1.02*(1.18 if (i,j) in CLEAR else 1.0),lift=0.06)
ring(1,4,0.1)
# 消除示意：三朵云被风从掌心吹向右侧云海，散成小云团；飞鱼跃起去接
c=P(4.5,2.0)+n*0.4
with Grab() as g:
    for k in range(7): cumulus(c+Vector((0.8+k*0.42,0.2+k*0.25,0.5+k*0.18)),0.12+k*0.035,k=3,sub=1)
    fish(P(7.9,3.4)+Vector((0.4,0,1.4)),1.2,(0,R(-25),R(-160)))
fx(g.objs)
finish([('top_fingers',P(3.5,6.8)+n*0.2,(0.6,-3.2,2.6)),
        ('left_thumb',P(0.3,4.3)+n*0.2,(1.8,-2.4,2.2)),
        ('bottom_wrist',P(6.0,0.3)+n*0.1,(-1.0,-3.0,2.4))])
