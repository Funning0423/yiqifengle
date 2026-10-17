# D_refine_r2：山丘重逢·坡顶野餐布 第二轮   blender -b -P d_r2.py -- <main|test|fx> <outdir>
import os,sys,json
HERE=os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE,'helpers.py')).read())
MODE,OUTD=SCENE,OUT; SCENE='D_refine_r2'
exec(open(os.path.join(HERE,'fw.py')).read())
random.seed(29)
sc.eevee.taa_render_samples=16 if MODE=='test' else 64
def smooth(o):
    for p in o.data.polygons: p.use_smooth=True
    return o
def noshadow(o): 
    try: o.visible_shadow=False
    except Exception: pass
    return o
def mesh_obj(vs,fs,cols,idx=None,sm=False,name='m',**k):
    me=bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in vs],[],fs); me.validate()
    o=bpy.data.objects.new(name,me); sc.collection.objects.link(o)
    for c in cols:
        if isinstance(c,dict): me.materials.append(mat(**c))
        else: me.materials.append(mat(c,**k))
    if idx is not None:
        for p,i in zip(me.polygons,idx): p.material_index=i
    for p in me.polygons: p.use_smooth=sm
    return o
def tris_now():
    dg=bpy.context.evaluated_depsgraph_get(); t=0
    for o in sc.objects:
        if o.type=='MESH' and not o.hide_render:
            e=o.evaluated_get(dg); m=e.to_mesh(); m.calc_loop_triangles(); t+=len(m.loop_triangles); e.to_mesh_clear()
    return t
SEC=[]; _last=[0]
def sec(name):
    t=tris_now(); SEC.append((name,t-_last[0])); _last[0]=t
def seg_cyl(p0,p1,r0,r1,c,v=6,**k):   # 两点之间的收分圆柱
    p0=Vector(p0); p1=Vector(p1); d=p1-p0
    o=cyl(tuple((p0+p1)/2),r0,d.length,c,v=v,r2=r1,**k)
    o.rotation_euler=Vector((0,0,1)).rotation_difference(d.normalized()).to_euler(); return o
def lathe(prof,seg,cols,loc,jit=0.0,sm=True,stripe=True,**k):
    vs=[];fs=[];idx=[]
    for (r,z) in prof:
        for s in range(seg):
            a=2*math.pi*s/seg; rr=r*(1+random.uniform(-jit,jit)) if r>0 else 0
            vs.append(Vector((loc[0]+math.cos(a)*rr,loc[1]+math.sin(a)*rr,loc[2]+z)))
    for i in range(len(prof)-1):
        for s in range(seg):
            a=i*seg+s; b=i*seg+(s+1)%seg; fs.append([a,b,b+seg,a+seg]); idx.append((s%2) if stripe else 0)
    return mesh_obj(vs,fs,cols,idx,sm=sm,**k)
# ---------- 光：右后方暖阳（影子落左前）+ 天光（相机看到渐变天空，照明用暖灰） ----------
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; N=nt.nodes; L=nt.links
bg=N['Background']; tc=N.new('ShaderNodeTexCoord'); sp=N.new('ShaderNodeSeparateXYZ'); mr=N.new('ShaderNodeMapRange'); cr=N.new('ShaderNodeValToRGB')
L.new(tc.outputs['Generated'],sp.inputs[0]); L.new(sp.outputs[2],mr.inputs[0]); mr.inputs[1].default_value=-0.545; mr.inputs[2].default_value=-0.40
L.new(mr.outputs[0],cr.inputs[0]); e=cr.color_ramp
e.elements[0].position=0.0; e.elements[0].color=(1.0,0.74,0.5,1); e.elements[1].position=1.0; e.elements[1].color=(0.30,0.52,0.98,1)
e.elements.new(0.22).color=(1.0,0.84,0.66,1); e.elements.new(0.5).color=(0.62,0.74,0.98,1)
bg2=N.new('ShaderNodeBackground'); bg2.inputs[0].default_value=(0.78,0.74,0.82,1); bg2.inputs[1].default_value=0.42
L.new(cr.outputs[0],bg.inputs[0]); bg.inputs[1].default_value=1.05
lp=N.new('ShaderNodeLightPath'); mx=N.new('ShaderNodeMixShader'); out=N['World Output']
L.new(lp.outputs['Is Camera Ray'],mx.inputs[0]); L.new(bg2.outputs[0],mx.inputs[1]); L.new(bg.outputs[0],mx.inputs[2]); L.new(mx.outputs[0],out.inputs[0])
sun((46,0,105),4.2,(1,0.78,0.52),ang=6)
TL=18; PLANE=[Vector((0,6,0.8)),Vector((0,-math.sin(R(TL)),math.cos(R(TL))))]
report()
n=PLANE[1].normalized()
CAMC=cam.matrix_world.translation
def at_screen(u,v,dist): return CAMC+ray(u,v)*dist
def hit_z(u,v,z): d=ray(u,v); return CAMC+d*((z-CAMC.z)/d.z)
def at_y(u,v,y): d=ray(u,v); return CAMC+d*((y-CAMC.y)/d.y)
G1=(0.30,0.60,0.12); G2=(0.38,0.66,0.15); G3=(0.22,0.50,0.11); GD=(0.17,0.42,0.10)
CREST=8.6
# ---------- 近坡 + 深浅草色斑块 ----------
quad([P(-14,-7)-n*0.02,P(21,-7)-n*0.02,P(21,CREST)-n*0.02,P(-14,CREST)-n*0.02],G1,th=6)
for _ in range(34):
    a=random.uniform(-6,13); b=random.uniform(-2.2,CREST-.3); r=random.uniform(.5,1.4); lift=random.uniform(.004,.009)
    pts=[P(a+math.cos(t)*r*random.uniform(.7,1.2),b+math.sin(t)*r*.8*random.uniform(.7,1.2))+n*lift for t in [k*math.pi/4 for k in range(8)]]
    quad(pts,random.choice([G2,G3,(0.42,0.68,0.2),GD]))
top=P(3.5,CREST)
VZ=-14.0
me=bpy.data.meshes.new('b'); me.from_pydata([(-80,top.y-0.05,top.z-0.06),(80,top.y-0.05,top.z-0.06),(80,top.y+14,VZ),(-80,top.y+14,VZ)],[],[[0,1,2,3]]); o=bpy.data.objects.new('b',me); sc.collection.objects.link(o); put(o,G3)
me=bpy.data.meshes.new('f'); me.from_pydata([(-90,top.y+13,VZ),(90,top.y+13,VZ),(90,39.5,VZ),(-90,39.5,VZ)],[],[[0,1,2,3]]); o=bpy.data.objects.new('f',me); sc.collection.objects.link(o); put(o,(0.40,0.62,0.18))
sec('slope+valleyfloor')
# ---------- 中景谷地：薰衣草田（垄沟+花穗）、树篱、蜿蜒小路、农舍、树排 ----------
LAV=[(0.55,0.32,0.85),(0.64,0.40,0.90)]; SPK=(0.78,0.58,0.98)
def field(u0,u1,v0,v1,rowsp=1.15):
    a=hit_z(u0,v0,VZ); b=hit_z(u1,v1,VZ); x0,x1=min(a.x,b.x),max(a.x,b.x); y0,y1=a.y,b.y
    box(((x0+x1)/2,(y0+y1)/2,VZ+.03),(x1-x0+.6,y1-y0+.6,.06),(0.46,0.30,0.18))
    nr=int((x1-x0)/rowsp)
    for r in range(nr):
        x=x0+.4+r*rowsp; box((x,(y0+y1)/2,VZ+.28),(.72,y1-y0,.5),LAV[r%2],bevel=.22,seg=1)
        for k in range(int((y1-y0)/0.8)):
            yy=y0+.4+k*.8+random.uniform(-.2,.2); cyl((x+random.uniform(-.15,.15),yy,VZ+.7),.12,.42,SPK,v=3,r2=0)
    box(((x0+x1)/2,y0-.7,VZ+.45),(x1-x0+1.2,.9,.9),(0.12,0.36,0.13),bevel=.3,seg=1)
    return x0,x1,y0,y1
FIELDS=[field(0.00,0.38,0.712,0.758),field(0.50,0.96,0.712,0.756),field(0.04,0.42,0.768,0.797),field(0.58,0.80,0.766,0.792)]
sec('fields')
def strip(pts,wd,c,z=VZ+.06):   # 平地上一条弯曲小路
    vs=[];fs=[]
    for i,p in enumerate(pts):
        d=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]); d.z=0; d.normalize(); s=Vector((-d.y,d.x,0))*wd/2
        vs+= [Vector((p.x,p.y,z))+s,Vector((p.x,p.y,z))-s]
        if i: fs.append([2*i-2,2*i-1,2*i+1,2*i])
    return mesh_obj(vs,fs,[(0.88,0.72,0.48)])
path_v=[hit_z(u,v,VZ) for u,v in ((0.50,0.704),(0.47,0.722),(0.455,0.742),(0.47,0.760),(0.53,0.772),(0.62,0.779),(0.70,0.786),(0.76,0.790))]
strip(path_v,1.3,None)
fh=hit_z(0.82,0.789,VZ)
def house(x,y,s,wall,roof,rz=0):
    def f():
        box((0,0,.8),(2.4,1.8,1.6),wall); 
        me=bpy.data.meshes.new('r'); me.from_pydata([(-1.35,-1.1,1.55),(1.35,-1.1,1.55),(1.35,1.1,1.55),(-1.35,1.1,1.55),(-1.35,0,2.55),(1.35,0,2.55)],[],[[0,1,5,4],[3,4,5,2],[0,4,3],[1,2,5]]); o=bpy.data.objects.new('r',me); sc.collection.objects.link(o); put(o,roof)
        box((.7,.4,2.4),(.3,.3,.8),(0.6,0.35,0.25)); box((-.55,-.91,.75),(.4,.04,.45),(1,0.75,0.38),e=5); box((.55,-.91,.75),(.4,.04,.45),(1,0.75,0.38),e=5); box((0,-.91,.45),(.4,.04,.9),(0.45,0.26,0.14))
    place(f,Matrix.Translation((x,y,VZ))@Matrix.Rotation(rz,4,'Z')@Matrix.Diagonal((s,s,s,1)))
house(fh.x,fh.y,1.25,(0.97,0.9,0.76),(0.78,0.26,0.16),.15)
bh=hit_z(0.14,0.800,VZ); house(bh.x,bh.y,1.0,(0.78,0.22,0.16),(0.36,0.24,0.2),-.2)
fx_,fy_=fh.x,fh.y
for k in range(9): cyl((fx_-3.4+k*.85,fy_-2.2,VZ+.35),.05,.7,(0.9,0.86,0.75),v=4)
box((fx_,fy_-2.2,VZ+.5),(7.0,.06,.08),(0.9,0.86,0.75))
def ltree(x,y,s,col,z=VZ):
    cyl((x,y,z+.6*s),.13*s,1.2*s,(0.42,0.26,0.13),v=5); ico((x,y,z+1.7*s),.85*s,col,sub=1)
def poplar(x,y,s,col,z=VZ):
    cyl((x,y,z+.3*s),.1*s,.6*s,(0.42,0.26,0.13),v=4); smooth(ico((x,y,z+1.6*s),.55*s,col,sub=1,s=(1,1,2.1)))
TC=[(0.14,0.44,0.12),(0.22,0.52,0.14),(0.30,0.56,0.16)]
for k in range(16):
    u=0.02+k*0.064; p=hit_z(u,0.803,VZ)
    if abs(p.x-fh.x)<4: continue
    poplar(p.x,p.y+random.uniform(-.3,.3),random.uniform(1.2,1.6),random.choice(TC))
for u,v in ((0.44,0.71),(0.47,0.765),(0.99,0.76),(0.62,0.762),(0.34,0.765)):
    p=hit_z(u,v,VZ); ltree(p.x,p.y,random.uniform(1.1,1.4),random.choice(TC))
sec('valley props')
# ---------- 远山两层：前层绿、后层淡蓝绿；带树丛 ----------
for k in range(10):
    u=-0.25+k*0.165; vt=random.uniform(0.815,0.842); T=at_y(u,vt,40.5)
    smooth(ico((T.x,41.5,VZ-3),1,(0.30,0.58,0.24),sub=2,s=(7.5,3.5,T.z-VZ+3)))
    for j in range(3):
        ico((T.x+random.uniform(-4,4),39.0,T.z-random.uniform(0.6,1.6)),random.uniform(.7,1.1),(0.16,0.42,0.14),sub=1)
for k in range(8):
    u=-0.25+k*0.21; vt=random.uniform(0.848,0.866); T=at_y(u,vt,78)
    smooth(ico((T.x,80,T.z-14),1,(0.48,0.62,0.74),sub=2,s=(15,6,14)))
# 远景山墙：半径 300 的环带 + 山峰，全部在主镜头画框之外（仰角高于 -20.5°），只给低机位近景/转场看
vs=[];fs=[]; NSG=40
for k in range(NSG+1):
    a=R(-85+170*k/NSG); vs+=[(math.sin(a)*300,math.cos(a)*300,-100),(math.sin(a)*300,math.cos(a)*300,-38)]
    if k: fs.append([2*k-2,2*k,2*k+1,2*k-1])
mesh_obj(vs,fs,[(0.47,0.60,0.70)],name='farwall')
for k in range(16):
    a=R(-80+k*160/15); d=random.uniform(304,312)
    smooth(ico((math.sin(a)*d,math.cos(a)*d,-42),1,random.choice([(0.50,0.62,0.76),(0.56,0.66,0.78),(0.46,0.6,0.7)]),sub=1,s=(random.uniform(45,60),25,random.uniform(40,55))))
sec('hills')
# ---------- 热气球：分瓣条纹球囊 + 吊篮 + 绳索，在天空高低错开，远的更小更淡 ----------
BPROF=[(0.30,-1.02),(0.5,-0.82),(0.78,-0.45),(0.97,0.0),(1.0,0.38),(0.9,0.75),(0.66,1.02),(0.34,1.16),(0.0,1.2)]
def balloon(q,r,c1,c2):
    x,y,z=q.x,q.y,q.z
    lathe([(a*r,b*r) for a,b in BPROF],12,[c1,c2],(x,y,z),name='bal')
    torus((x,y,z+.0*r),r*0.985,r*.035,(0.98,0.92,0.75))
    for dx,dy in ((-1,-1),(1,-1),(-1,1),(1,1)):
        seg_cyl((x+dx*r*.21,y+dy*r*.21,z-r*1.02),(x+dx*r*.17,y+dy*r*.17,z-r*1.5),r*.012,r*.012,(0.35,0.25,0.15),v=3)
    box((x,y,z-r*1.66),(r*.42,r*.42,r*.32),(0.62,0.40,0.18),bevel=r*.04,seg=1); box((x,y,z-r*1.5),(r*.46,r*.46,r*.05),(0.42,0.26,0.12))
    cyl((x,y,z-r*1.2),r*.07,r*.15,(0.3,0.3,0.32),v=6)
balloon(at_screen(0.74,0.872,34),1.55,(0.95,0.26,0.20),(1.0,0.80,0.30))
balloon(at_screen(0.46,0.905,58),1.55,(0.25,0.58,0.95),(0.98,0.96,0.88))
balloon(at_screen(0.88,0.945,105),1.55,(0.98,0.68,0.55),(0.98,0.92,0.80))
balloon(at_screen(0.62,0.978,150),1.45,(0.80,0.74,0.95),(0.96,0.94,0.96))
sec('balloons')
# ---------- 蓬松云（扁底、多团叠） ----------
for (u,v,dist,wd) in ((0.30,0.965,170,1.0),(0.70,0.90,190,0.9),(0.95,0.985,160,0.8),(0.12,0.905,200,0.7),(0.52,0.94,210,0.6),(1.02,0.875,200,0.6)):
    q=at_screen(u,v,dist); rx=ray(u,v); side=Vector((1,0,0)); up=n.cross(side) if False else Vector((0,0,1))
    S=dist/12*wd
    for k in range(9):
        t=(k/8-.5)*2; h=(1-t*t)
        c=q+side*t*S*1.2+up*(h*S*.35+random.uniform(0,S*.08))+Vector((0,random.uniform(-1,1),0))
        smooth(ico(tuple(c),S*(.32+.28*h)*random.uniform(.85,1.1),random.choice([(1,0.97,0.92),(1,0.95,0.9)]),sub=1,s=(1.2,1,0.85),e=0.55))
    for k in range(4):
        c=q+side*((k/3-.5)*1.6)*S+up*(-S*.05)
        smooth(ico(tuple(c),S*.3,(0.92,0.84,0.92),sub=1,s=(1.4,1,.55),e=0.4))
sec('clouds')
# ---------- 坡顶秋千大树（收分树干、根部隆起、分枝、切面叶团） ----------
tp=P(0.75,8.15); tz=tp.z-0.05; B1=(0.40,0.24,0.12); B2=(0.50,0.31,0.16); B3=(0.32,0.19,0.10)
tr=lathe([(0.78,-.1),(0.58,0.18),(0.44,0.55),(0.40,1.2),(0.37,2.0),(0.33,2.8),(0.28,3.4),(0.22,3.9)],9,[B1,B2],(tp.x,tp.y,tz),jit=0.08,sm=False,name='trunk')
for k in range(5):
    a=k*2*math.pi/5+.4; seg_cyl((tp.x,tp.y,tz+.35),(tp.x+math.cos(a)*1.05,tp.y+math.sin(a)*1.05,tz-.05),.22,.04,B3,v=5)
for k in range(7):
    a=random.uniform(0,2*math.pi); h=random.uniform(.5,3.2); r=0.4*(1-h/5)
    box((tp.x+math.cos(a)*r,tp.y+math.sin(a)*r,tz+h),(.06,.06,random.uniform(.4,.8)),B3,rot=(0,0,a))
T0=Vector((tp.x,tp.y,tz))
BR=[((0,0,3.3),(2.9,-0.1,3.75),.2,.09),   # 右枝：秋千
    ((0,0,3.0),(-1.15,-1.05,3.45),.16,.07),   # 前左枝：灯笼
    ((0,0,3.6),(-2.0,0.6,4.9),.18,.08),((0,0,3.8),(0.6,0.9,5.4),.17,.07),((0,0,3.9),(0.2,-0.4,5.6),.15,.06)]
for p0,p1,r0,r1 in BR: seg_cyl(T0+Vector(p0),T0+Vector(p1),r0,r1,B1,v=6)
seg_cyl(T0+Vector((1.6,-.05,3.5)),T0+Vector((2.2,0.7,4.6)),.08,.04,B1,v=5)
LC=[(0.13,0.42,0.12),(0.22,0.54,0.14),(0.32,0.62,0.16),(0.17,0.48,0.10)]
CL=[((-1.9,0.7,5.0),1.0),((0.6,0.9,5.6),1.05),((0.1,-0.2,6.0),1.0),((2.2,0.8,4.9),0.85),((-0.9,0.2,5.9),0.9),((1.4,0.2,5.5),0.85),((-1.1,1.2,4.6),0.8),((0.9,1.6,4.6),0.8)]
for (d,s) in CL:
    c=T0+Vector(d)
    for k in range(4):
        o=ico(tuple(c+Vector((random.uniform(-.7,.7),random.uniform(-.5,.5),random.uniform(-.35,.45)))*s),random.uniform(.55,.85)*s,random.choice(LC),sub=1,s=(1.15,1,.85),rot=(random.uniform(0,3),random.uniform(0,3),random.uniform(0,3)))
# 秋千：两根绳、绳结、座板
sx=tp.x+1.95; sy=tp.y-0.1; seatz=tz+1.05
for xx in (sx-0.5,sx+0.5):
    bz=tz+3.3+(xx-tp.x)/2.9*0.45
    cyl((xx,sy,(bz+seatz)/2+.05),.03,bz-seatz,(0.90,0.84,0.66),v=5)
    torus((xx,sy,bz-.02),.07,.03,(0.85,0.78,0.6),rot=(R(90),0,0)); smooth(ico((xx,sy,seatz+.1),.065,(0.85,0.78,0.6),sub=1))
box((sx,sy,seatz),(1.25,.42,.08),(0.68,0.42,0.2),bevel=.035,seg=1); box((sx,sy,seatz-.06),(1.15,.08,.05),(0.5,0.3,0.14))
# 两条围巾（阿芳黄、阿宁蓝）系在绳上
for xx,col,ang in ((sx-0.5,(1,0.78,0.10),R(10)),(sx+0.5,(0.25,0.55,0.92),R(-12))):
    torus((xx,sy,tz+2.55),.07,.05,col,rot=(0,0,0))
    box((xx-.05,sy-.05,tz+2.15),(.16,.04,.75),col,rot=(0,ang,0),bevel=.015,seg=1); box((xx+.06,sy-.07,tz+2.1),(.15,.04,.6),col,rot=(0,-ang,0),bevel=.015,seg=1)
    for f in range(3): box((xx-.05+(f-1)*.05+math.sin(ang)*.38,sy-.06,tz+1.74),(.025,.02,.1),(0.98,0.95,0.85))
# 灯笼挂在前左枝末端、树冠下方
lb=T0+Vector((0.95,-0.05,3.3+0.95/2.9*0.45-0.12)); lz=lb.z-0.95
cyl((lb.x,lb.y,(lb.z+lz)/2+.15),.012,lb.z-lz-.3,(0.3,0.22,0.15),v=3)
smooth(ico((lb.x,lb.y,lz),.27,(1,0.58,0.22),sub=2,s=(1,1,1.25),e=3)); cyl((lb.x,lb.y,lz+.33),.15,.08,(0.35,0.2,0.1),v=8); cyl((lb.x,lb.y,lz-.33),.15,.07,(0.35,0.2,0.1),v=8); cyl((lb.x,lb.y,lz-.45),.02,.16,(0.9,0.3,0.25),v=4)

point((lb.x,lb.y-.1,lz-.05),70,(1,0.68,0.38),0.25)
# 树下：两双鞋（放大）+ 靠树干的信封
def shoe(p,col,rz,s=1.0):
    def f():
        box((0,0,.03),(.2,.5,.06),(0.95,0.93,0.88),bevel=.03,seg=1)
        smooth(ico((0,.08,.13),.12,col,sub=2,s=(.95,2.0,.95))); smooth(ico((0,-.14,.1),.1,col,sub=1,s=(1,1.1,.8)))
        torus((0,-.08,.2),.065,.018,(0.98,0.95,0.9))
    place(f,Matrix.Translation(p)@Matrix.Rotation(rz,4,'Z')@Matrix.Diagonal((s,s,s,1)))
def onP(a,b,h=0.0): return P(a,b)+n*h
for (a,b,col,rz) in ((1.45,7.82,(1,0.72,0.18),.35),(1.78,7.76,(1,0.72,0.18),.2),(2.35,7.8,(0.22,0.46,0.9),-.15),(2.68,7.86,(0.22,0.46,0.9),-.35)):
    shoe(onP(a,b),col,rz,1.7)
ev=Vector((tp.x+0.42,tp.y-0.52,tz+.38))
box(tuple(ev),(.95,.06,.64),(1,0.92,0.84),rot=(R(-14),0,R(-8)),bevel=.02,seg=1)
poly([(-.46,.3),(.46,.3),(0,-.06)],(ev.x,ev.y-.06,ev.z+.02),(0.95,0.78,0.7),th=.01,rot=(R(76),0,R(-8)))
poly([(0,-.07),(.08,.01),(.04,.07),(0,.03),(-.04,.07),(-.08,.01)],(ev.x,ev.y-.1,ev.z-.04),(0.85,0.1,0.14),th=.03,rot=(R(76),0,R(-8)))
# 萤火虫（树下，暖黄绿，小光晕）
def firefly(p,s=1.0,e1=14,halo=False):
    ico(tuple(p),.045*s,(0.72,1,0.22),sub=2 if halo or s<1 else 1,e=e1)
    if halo:
        for r,al,ee in ((.11,.32,1.8),(.18,.18,1.1),(.27,.09,0.8)): noshadow(smooth(ico(tuple(p),r*s,(0.70,1,0.25),sub=2,e=ee,a=al)))
for _ in range(6): firefly(Vector((tp.x+random.uniform(-2.5,3),tp.y+random.uniform(-2.2,-0.4),tz+random.uniform(0.7,2.6))),0.8,5)
sec('tree+story')
# ---------- 野餐布 r3：格子区绝对平整；布边低频褶皱+起伏（只在格子外）；右上大翻折角；左右伸出画面 ----------
MX=0.56; MB=0.5; HF=0.014
def hcl(a,b):
    h=HF; dx=max(-a,a-7,0.0); dy=max(-b,b-7,0.0)
    if dy>0:
        f=min(dy/MB,1.0)**1.3; ph=0.0 if b<0 else 2.1
        h+=f*(0.08+0.14*(0.5+0.5*math.sin(a*2*math.pi/1.1+ph))+0.035*math.sin(a*2*math.pi/0.5+ph*2))
    if dx>0:
        f=min(dx/MX,1.0)**1.3; ph=1.0 if a<0 else 3.3
        h+=f*(0.08+0.14*(0.5+0.5*math.sin(b*2*math.pi/1.15+ph))+0.035*math.sin(b*2*math.pi/0.55+ph))
    return h
CC=Vector((7+MX,7+MB)); FA=Vector((5.2,7+MB)); FB=Vector((7+MX,7.15))
_d=(FB-FA).normalized(); FN=Vector((-_d.y,_d.x));
if FN.dot(CC-FA)<0: FN=-FN
_foot=FA+_d*(CC-FA).dot(_d); FF=_foot*2-CC
def cside(a,b): return FN.dot(Vector((a,b))-FA)
def clamp_fold(a,b):
    s=cside(a,b)
    if s>0: p=Vector((a,b))-FN*s; return p.x,p.y
    return a,b
Ax=[-MX+k*MX/7 for k in range(7)]+[k/4 for k in range(29)]+[7+MX*k/7 for k in range(1,8)]
Bx=[-MB+k*MB/6 for k in range(6)]+[k/4 for k in range(29)]+[7+MB*k/6 for k in range(1,7)]
vs=[];fs=[];idx=[]; NA=len(Ax); NB=len(Bx)
for j,b in enumerate(Bx):
    for i,a in enumerate(Ax):
        aa,bb=clamp_fold(a,b)
        if j in (0,NB-1): bb+=(-1 if j==0 else 1)*0.04*math.sin(aa*3.7+j)
        vs.append(P(aa,bb)+n*hcl(aa,bb))
for j in range(NB-1):
    for i in range(NA-1):
        cs=[(Ax[i],Bx[j]),(Ax[i+1],Bx[j]),(Ax[i+1],Bx[j+1]),(Ax[i],Bx[j+1])]
        if all(cside(*c)>-1e-6 for c in cs): continue
        fs.append([j*NA+i,j*NA+i+1,(j+1)*NA+i+1,(j+1)*NA+i])
        a=(Ax[i]+Ax[i+1])/2; b=(Bx[j]+Bx[j+1])/2
        if 0<=a<=7 and 0<=b<=7: idx.append((int(a)+int(b))%2)
        else:
            dy=max(-b,b-7,0); dx=max(-a,a-7,0)
            idx.append(3 if (dy>MB-0.12 or dx>MX-0.12) else 2)
CLOTH=mesh_obj(vs,fs,[(0.94,0.87,0.74),(0.74,0.66,0.80),(0.95,0.89,0.78),(0.58,0.44,0.66)],idx,sm=True,name='cloth')
# 翻折的布角：背面朝上，折痕处隆起成卷边
K=8; fv=[];ff=[]; ids={}
for u in range(K+1):
    for v in range(K+1-u):
        w_=1-(u+v)/K; p=FA*(w_)+FB*(u/K)+FF*(v/K) if False else FA*((K-u-v)/K)+FB*(u/K)+FF*(v/K)
        crease=1-v/K
        ids[(u,v)]=len(fv); fv.append(P(p.x,p.y)+n*(hcl(p.x,p.y)+0.035+0.075*crease**2))
for u in range(K):
    for v in range(K-u):
        ff.append([ids[(u,v)],ids[(u+1,v)],ids[(u,v+1)]])
        if (u+1,v+1) in ids: ff.append([ids[(u+1,v)],ids[(u+1,v+1)],ids[(u,v+1)]])
FLAP=mesh_obj(fv,ff,[(0.80,0.72,0.62)],sm=True,name='flap')
FLAP2=mesh_obj([P(FF.x+(FA.x-FF.x)*t,FF.y+(FA.y-FF.y)*t)+n*(hcl(FF.x+(FA.x-FF.x)*t,FF.y+(FA.y-FF.y)*t)+0.036+0.075*t**2) for t in (0,1)]+[P(FF.x+(FA.x-FF.x)*t,FF.y+(FA.y-FF.y)*t)+n*(hcl(FF.x+(FA.x-FF.x)*t,FF.y+(FA.y-FF.y)*t)+0.03+0.075*t**2) for t in (1,0)],[[0,1,2,3]],[(0.58,0.44,0.66)],name='flapedge')
seg_cyl(P(FA.x,FA.y)+n*(hcl(FA.x,FA.y)+0.095),P(FB.x,FB.y)+n*(hcl(FB.x,FB.y)+0.095),.065,.065,(0.92,0.85,0.74),v=8)
# 流苏：上下两边（避开翻折角和篮子）
fv=[];ff=[]
for bb,sgn in ((-MB,-1),(7+MB,1)):
    a=-MX+.08
    while a<7+MX-.05:
        if not (bb>7 and a>FA.x-.05) and not (bb<0 and a>6.15):
            L0=len(fv); ln=random.uniform(.14,.2); dx=random.uniform(-.035,.035); hb=hcl(a,bb)
            fv+=[P(a-.024,bb)+n*hb,P(a+.024,bb)+n*hb,P(a+.014+dx,bb+sgn*ln)+n*(0.006),P(a-.014+dx,bb+sgn*ln)+n*(0.006)]; ff.append([L0,L0+1,L0+2,L0+3])
            L0=len(fv); fv+=[P(a-.03,bb+sgn*.01)+n*(hb+.004),P(a+.03,bb+sgn*.01)+n*(hb+.004),P(a+.03,bb+sgn*.05)+n*(hb*.7+.004),P(a-.03,bb+sgn*.05)+n*(hb*.7+.004)]; ff.append([L0,L0+1,L0+2,L0+3])
        a+=.15
mesh_obj(fv,ff,[(0.58,0.44,0.66)],name='fringe')
def infold(a,b): return cside(a,b)>-0.05
sec('cloth')
# ---------- 棋子（低面、各类一眼可分）----------
def p2(kind):
    if kind=='jar':
        smooth(cyl((0,0,.22),.2,.44,(0.7,0.95,0.9),v=20,a=.3,rough=.05)); torus((0,0,.45),.19,.035,(0.95,0.7,0.25))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14,ring_count=7,radius=.17,location=(0,0,.24)); smooth(put(bpy.context.object,(1,0.72,0.12),e=4)); [ico((dx,dy,dz),.03,(1,0.95,0.6),sub=0,e=12) for dx,dy,dz in((.08,0,.32),(-.07,.05,.14),(.03,-.08,.28))]
    elif kind=='kite':
        poly([(0,.42),(.3,.04),(0,-.36),(-.3,.04)],(0,0,.06),(0.32,0.6,0.95),th=.06)
        poly([(0,.42),(.3,.04),(0,.04)],(0,0,.1),(0.98,0.96,0.9),th=.01); poly([(0,-.36),(-.3,.04),(0,.04)],(0,0,.1),(0.98,0.96,0.9),th=.01)
        box((0,0,.11),(.03,.78,.02),(0.7,0.5,0.25)); box((0,.04,.11),(.6,.03,.02),(0.7,0.5,0.25))
        for k in range(3): box((.06+k*.08,-.42-k*.07,.05),(.1,.05,.02),(1,0.4,0.4),rot=(0,0,.6))
    elif kind=='env':
        box((0,0,.05),(.64,.44,.08),(1,0.8,0.74),bevel=.025,seg=1); poly([(-.32,.22),(.32,.22),(0,-.04)],(0,0,.095),(0.96,0.68,0.64),th=.012)
        smooth(cyl((0,-.02,.105),.07,.03,(0.82,0.12,0.15),v=10))
    elif kind=='scarf':   # 平铺成 S 形的罗纹针织围巾：纵向凸起罗纹+针脚起伏，单一暖色，两端流苏
        C=[]; NS=15
        for k in range(NS+1):
            t=k/NS; C.append(Vector((0.17*math.sin(t*2*math.pi*0.85+.3),-0.30+0.60*t,0)))
        NW=7; W=0.25; vs=[];fs=[];ix=[]; R_=NW+2
        for k,c in enumerate(C):
            d=(C[min(k+1,NS)]-C[max(k-1,0)]).normalized(); sd=Vector((-d.y,d.x,0))
            for q in range(NW):
                t=q/(NW-1); rib=0.5+0.5*math.cos(2*math.pi*3*t)
                h=(0.055+0.03*rib+0.008*math.cos(k*math.pi)*rib)*(math.sin(math.pi*t)**0.3)+0.014
                vs.append(c+sd*(t-.5)*W+Vector((0,0,h)))
            vs+=[c+sd*(-.5)*W+Vector((0,0,0.004)),c+sd*.5*W+Vector((0,0,0.004))]
            if k:
                a0=(k-1)*R_; b0=k*R_
                for q in range(NW-1): fs.append([a0+q,a0+q+1,b0+q+1,b0+q]); ix.append(0 if q in (0,2,3,5) else 1)
                fs.append([a0+NW,a0,b0,b0+NW]); fs.append([a0+NW-1,a0+NW+1,b0+NW+1,b0+NW-1]); ix+=[0,0]
        smooth(mesh_obj(vs,fs,[(0.95,0.40,0.12),(0.80,0.28,0.10)],ix,name='scarf'))
        for c,d in ((C[0],(C[0]-C[1]).normalized()),(C[-1],(C[-1]-C[-2]).normalized())):
            sd=Vector((-d.y,d.x,0))
            for f in range(5): seg_cyl(c+sd*(f-2)*.05+Vector((0,0,.035)),c+sd*(f-2)*.055+d*.13+Vector((0,0,.012)),.017,.012,(1,0.78,0.48),v=3)
    elif kind=='strawb':
        smooth(ico((0,0,.21),.24,(0.92,0.1,0.16),sub=2,s=(1,1,1.1),rough=.3))
        for k in range(8): a=k*2.4; h=.1+(k%4)*.06; ico((math.cos(a)*.21,math.sin(a)*.21,h+.06),.022,(1,0.9,0.4),sub=0)
        for k in range(5): a=k*1.256; poly([(0,0),(.08,.03),(.16,0),(.08,-.03)],(0,0,.43),(0.2,0.62,0.18),th=.02,rot=(0,R(-20),a))
    elif kind=='dand':
        cyl((0,0,.13),.02,.26,(0.3,0.6,0.22),v=4); smooth(ico((0,0,.36),.2,(0.97,0.97,0.94),sub=2,e=.15))
        for k in range(12):
            a=k*2.4; b=math.acos(1-2*(k+.5)/12); v=Vector((math.sin(b)*math.cos(a),math.sin(b)*math.sin(a),math.cos(b)))
            ico(tuple(Vector((0,0,.36))+v*.24),.035,(1,1,1),sub=0,e=.2)
        poly([(0,0),(.12,.04),(.2,0),(.12,-.04)],(.02,0,.12),(0.3,0.6,0.22),th=.015,rot=(0,R(-30),0))
KINDS=['jar','kite','env','scarf','strawb','dand']
CLEAR=[(5,2),(5,3),(5,4)]
def kind_at(i,j):
    if (i,j) in CLEAR: return 'dand'
    k=KINDS[(i*2+j*3+(i*j)%5+(j//2))%6]
    if k=='dand' and i==5: k='jar'
    return k
PIECES=[]
SD=Vector((-0.08,-0.09))
def blob(i,j,s=1.0):
    a,b=i+.5+SD.x,j+.5+SD.y; out=[]
    for r,al,dz in ((.27*s,.10,.006),(.18*s,.14,.009)):
        pts=[P(a+math.cos(t)*r,b+math.sin(t)*r*.92)+n*(hcl(a,b)+dz) for t in [k*math.pi/6 for k in range(12)]]
        out.append(noshadow(quad(pts,(0.10,0.07,0.12),a=al)))
    return out
def put_piece(i,j,scale=1.0,lift=0.0):
    s=cw(i,j)*1.02*scale; k=kind_at(i,j)
    objs=place(lambda: p2(k), M_at(P(i+.5,j+.5)+n*(hcl(i+.5,j+.5)+0.004+lift*cw(i,j)),s))
    for o in objs: noshadow(o)
    return objs
with Grab() as GP:
    for i in range(7):
        for j in range(7):
            if not ((i,j) in CLEAR and MODE=='fx'): blob(i,j)
            if (i,j) in CLEAR and MODE=='fx': continue
            put_piece(i,j)
    if MODE!='fx': place(lambda: torus((0,0,0),.47,.045,(1,0.95,0.7),e=5),M_at(P(1.5,1.5)+n*(hcl(1.5,1.5)+.06),cw(1,1)))
sec('pieces')
# ---------- 中景野餐用品：保温壶、书、草帽、茶具；坡上小路、花丛 ----------
FLC=[(1,0.92,0.3),(1,1,0.97),(0.98,0.45,0.6),(0.7,0.5,0.95),(1,0.6,0.22)]
def flower(p,c,s=1.0,stem=True):
    if stem: cyl(tuple(p+n*.09*s),.012*s,.18*s,(0.25,0.5,0.12),v=3)
    pts=star_pts(.09*s,.04*s,5); q=p+n*.19*s
    mesh_obj([q+Vector((x,y,0)) for x,y in pts]+[q+Vector((0,0,.01))],[[k,(k+1)%10,10] for k in range(10)],[c],name='fl')
    mesh_obj([q+Vector((x*.4,y*.4,.012)) for x,y in star_pts(.06*s,.06*s,3)],[[0,1,2,3,4,5]],[(1,0.78,0.15)],name='fc')
def blade(p,h,c,lean=.35):
    cyl(tuple(p+n*h/2),.045*h/.3,h,c,v=3,r2=0,rot=(random.uniform(-lean,lean),random.uniform(-lean,lean),random.uniform(0,3)))
def tuft(p,h=0.4,k=5,cols=None):
    cols=cols or [G2,(0.42,0.7,0.18),G3,GD]
    for _ in range(k): blade(p+Vector((random.uniform(-.08,.08),random.uniform(-.08,.08),0)),h*random.uniform(.7,1.2),random.choice(cols))
def thermos():
    smooth(cyl((0,0,.32),.16,.64,(0.85,0.2,0.18),v=12)); cyl((0,0,.3),.165,.16,(0.98,0.94,0.85),v=12); smooth(cyl((0,0,.7),.13,.14,(0.95,0.92,0.85),v=12)); cyl((0,.13,.7),.03,.1,(0.3,0.3,0.3),v=4)
def book():
    box((-.2,0,.03),(.4,.55,.04),(0.98,0.96,0.88),rot=(0,R(-6),0)); box((.2,0,.03),(.4,.55,.04),(0.98,0.96,0.88),rot=(0,R(6),0)); box((0,0,.005),(.86,.6,.02),(0.15,0.5,0.45))
    box((.02,0,.06),(.02,.5,.003),(0.85,0.2,0.25))
def hat():
    smooth(cyl((0,0,.02),.55,.04,(0.95,0.82,0.48),v=16)); smooth(ico((0,0,.1),.28,(0.95,0.82,0.48),sub=2,s=(1,1,.75))); cyl((0,0,.1),.29,.08,(0.3,0.5,0.85),v=16)
def teaset():
    smooth(ico((0,0,.22),.24,(0.98,0.96,0.92),sub=2,s=(1,1,.85))); cyl((.3,0,.24),.04,.22,(0.98,0.96,0.92),v=6,rot=(0,R(60),0)); torus((-.24,0,.24),.1,.025,(0.98,0.96,0.92),rot=(R(90),0,0)); cyl((0,0,.42),.08,.06,(0.4,0.6,0.85),v=8)
    for dx in (.55,.85): cyl((dx,-.15,.07),.08,.14,(0.98,0.96,0.92),v=10); cyl((dx,-.15,.145),.065,.01,(0.6,0.35,0.15),v=10)
place(thermos,M_at(onP(6.25,7.95),cw(6,6)*.8)); place(teaset,M_at(onP(4.9,7.8),cw(5,6)*.8,rotz=.3)); place(book,M_at(onP(2.9,7.95),cw(3,6)*.85,rotz=-.15))
HAT=place(hat,M_at(onP(5.6,8.25),cw(5,6)*.8,rotz=.4))   # 布外草地上
# 坡上小路（从右缘蜿蜒到坡顶）
pp=[P(9.8,3.2),P(9.0,4.2),P(8.6,5.3),P(8.9,6.3),P(8.3,7.3),P(7.4,7.9),P(6.9,8.3),P(7.1,CREST+.2)]
vs=[];fs=[]
for i,p in enumerate(pp):
    d=(pp[min(i+1,len(pp)-1)]-pp[max(i-1,0)]).normalized(); s=n.cross(d).normalized()*0.26
    vs+=[p+s+n*.012,p-s+n*.012]
    if i: fs.append([2*i-2,2*i-1,2*i+1,2*i])
mesh_obj(vs,fs,[(0.80,0.66,0.44)])
for k in range(12):
    t=random.uniform(0,len(pp)-1.01); i=int(t); p=pp[i].lerp(pp[i+1],t-i); s=n.cross((pp[i+1]-pp[i]).normalized()).normalized()*random.choice([-.5,.5])
    ico(tuple(p+s+n*.03),random.uniform(.06,.1),(0.72,0.68,0.62),sub=0,s=(1.3,1,.6))
def inside(a,b,m=0.5): return -m<a<7+m and -m<b<7+m
# 坡面草 + 花丛
for _ in range(300):
    a=random.uniform(-6,13); b=random.uniform(-1.5,CREST-.1)
    if inside(a,b): continue
    blade(P(a,b),random.uniform(.22,.4),random.choice([G2,(0.42,0.68,0.18),G3]))
for _ in range(22):
    a=random.uniform(-4,11); b=random.uniform(-1.4,CREST-.3)
    if inside(a,b,0.8) or (abs(a-tp.x)<1.2 and abs(b-8.1)<0.6): continue
    c=random.choice(FLC)
    for k in range(5): flower(P(a+random.uniform(-.35,.35),b+random.uniform(-.3,.3)),c,random.uniform(1.0,1.5))
    tuft(P(a,b),.35,3)
sec('midground')
# ---------- 布边：草与小花从布边钻出（只压布边外圈）----------
for _ in range(120):
    f=random.uniform(-MX,7+MX); m=MB+random.uniform(.02,.12)
    a,b=(f,7+m) if random.random()<.5 else (f,-m)
    if a>6.0 and b<0.2: continue
    if random.random()<.7: blade(P(a,b),random.uniform(.2,.34),random.choice([G2,(0.42,0.68,0.18)]))
    else: flower(P(a,b),random.choice(FLC),random.uniform(.8,1.1))
sec('edge')
# ---------- 前景（底部 ≥100 px）：完整野餐篮压右下布角 + 近处草丛、野花、蒲公英 ----------
def basket():
    smooth(cyl((0,0,.36),.78,.72,(0.74,0.5,0.22),v=16))
    for k in range(4): torus((0,0,.1+k*.18),.785,.03,(0.58,0.37,0.15))
    cyl((0,0,.74),.8,.06,(0.6,0.38,0.16),v=16)
    box((-.05,.05,.78),(1.3,.55,.03),(0.95,0.93,0.86),rot=(0,0,.5)); box((-.05,.05,.795),(1.3,.12,.01),(0.85,0.25,0.3),rot=(0,0,.5))
    smooth(ico((.32,.08,.86),.15,(0.92,0.64,0.3),sub=2,s=(2.6,1,.75),rot=(0,0,.6)))
    smooth(ico((-.3,-.25,.84),.14,(0.92,0.14,0.18),sub=1)); smooth(ico((-.12,-.38,.84),.12,(0.95,0.5,0.15),sub=1))
    bpy.ops.mesh.primitive_torus_add(major_radius=.66,minor_radius=.05,location=(0,0,.78),rotation=(R(90),0,R(10)),major_segments=16,minor_segments=4); o=bpy.context.object; put(o,(0.58,0.37,0.15))
    for v in o.data.vertices:
        if v.co.z<0: v.co.z=0
with Grab() as GF:
    place(basket,M_at(onP(6.82,-0.38),cw(6,0)*0.6,rotz=.25))
    for _ in range(34):
        a=random.uniform(-0.6,6.0); b=random.uniform(-1.45,-0.15)
        tuft(P(a,b),random.uniform(.5,.85) if b<-0.6 else random.uniform(.3,.45),random.randint(5,8))
    for _ in range(14):
        a=random.uniform(-0.5,6.0); b=random.uniform(-1.4,-0.4); flower(P(a,b),random.choice(FLC),random.uniform(1.4,1.9))
    # 跨下沿 3 处、左沿 2 处：只压最外圈格子的外缘
    for (a,b,h) in ((1.5,-0.56,.6),(3.6,-0.55,.58),(5.0,-0.57,.62)):
        tuft(P(a,b),h,7); flower(P(a+.1,b-.05),random.choice(FLC),1.4)
    for _ in range(12):   # 左下角
        a=random.uniform(-0.5,0.8); b=random.uniform(-0.85,-0.53); tuft(P(a,b),random.uniform(.5,.75),6)
    for _ in range(7): flower(P(random.uniform(-0.45,0.8),random.uniform(-0.85,-0.55)),random.choice(FLC),random.uniform(1.4,1.8))
    for _ in range(10):   # 右下角（篮子两侧）
        a=random.uniform(5.9,7.45); b=random.uniform(-0.95,-0.53)
        if abs(a-6.82)<0.5 and b>-0.85: continue
        tuft(P(a,b),random.uniform(.5,.7),6)
    for _ in range(4): flower(P(random.uniform(6.0,7.4),random.uniform(-1.0,-0.6)),random.choice(FLC),1.6)
    def bouquet():
        for k in range(5): seg_cyl((0,0,.03),(math.cos(k*.25-.5)*.55,math.sin(k*.25-.5)*.55,.03),.012,.01,(0.3,0.58,0.2),v=3)
        for k,c in enumerate([(1,0.92,0.3),(0.98,0.45,0.6),(0.7,0.5,0.95),(1,1,0.97),(1,0.6,0.22)]):
            q=Vector((math.cos(k*.25-.5)*.55,math.sin(k*.25-.5)*.55,.05))
            mesh_obj([q+Vector((x,y,0)) for x,y in star_pts(.1,.045,5)]+[q+Vector((0,0,.01))],[[m,(m+1)%10,10] for m in range(10)],[c],name='fl')
        box((.08,0,.04),(.09,.07,.05),(0.9,0.3,0.35))
    place(bouquet,M_at(onP(-0.45,3.1,hcl(-0.45,3.1)),cw(0,3)*.9,rotz=.1))
    def cup():
        cyl((0,0,.02),.17,.03,(0.98,0.96,0.92),v=14); cyl((0,0,.1),.1,.16,(0.98,0.96,0.92),v=12); cyl((0,0,.175),.085,.01,(0.6,0.35,0.15),v=12); torus((.12,0,.1),.045,.015,(0.98,0.96,0.92),rot=(R(90),0,0))
    place(cup,M_at(onP(7.25,2.4,hcl(7.25,2.4)),cw(6,2)*.9))
    def fdand(p,h):
        cyl(tuple(p+n*h/2),.018,h,(0.32,0.58,0.2),v=4); c=p+n*h
        smooth(ico(tuple(c),.11,(0.97,0.97,0.94),sub=1,e=.15))
        for k in range(10):
            a=k*2.4; bb=math.acos(1-2*(k+.5)/10); v=Vector((math.sin(bb)*math.cos(a),math.sin(bb)*math.sin(a),math.cos(bb)))
            ico(tuple(c+v*.15),.022,(1,1,1),sub=0,e=.2)
        poly([(0,0),(.14,.05),(.26,0),(.14,-.05)],tuple(p+n*.03),(0.3,0.58,0.2),th=.015,rot=(0,0,random.uniform(0,6)))
    for a,b,h in ((0.3,-0.75,.6),(0.75,-1.05,.5),(2.4,-0.95,.55),(-0.3,-0.3,.5),(4.4,-1.1,.55)): fdand(P(a,b),h)
sec('foreground')
print('SECTIONS',SEC)
TOT=tris_now(); print('TRIS_EVAL',TOT)
# ---------- 前景/压边是否盖住棋子中心 60%：投影三角形测试 ----------
def cover_check(objs):
    dg=bpy.context.evaluated_depsgraph_get(); hits=set()
    samples=[(i,j,P(i+.5+dx,j+.5+dy)) for i in range(7) for j in range(7) for dx in (-.3,0,.3) for dy in (-.3,0,.3)]
    S2=[(i,j,w2c(sc,cam,p)) for i,j,p in samples]
    for o in objs:
        if o.type!='MESH': continue
        e=o.evaluated_get(dg); m=e.to_mesh(); m.calc_loop_triangles(); W=o.matrix_world
        pv=[w2c(sc,cam,W@v.co) for v in m.vertices]
        for t in m.loop_triangles:
            a,b,c=[pv[k] for k in t.vertices]
            minx=min(a.x,b.x,c.x);maxx=max(a.x,b.x,c.x);miny=min(a.y,b.y,c.y);maxy=max(a.y,b.y,c.y)
            for i,j,s in S2:
                if (i,j) in hits or not(minx<=s.x<=maxx and miny<=s.y<=maxy): continue
                d1=(s.x-b.x)*(a.y-b.y)-(a.x-b.x)*(s.y-b.y); d2=(s.x-c.x)*(b.y-c.y)-(b.x-c.x)*(s.y-c.y); d3=(s.x-a.x)*(c.y-a.y)-(c.x-a.x)*(s.y-a.y)
                if not((d1<0 or d2<0 or d3<0) and (d1>0 or d2>0 or d3>0)): hits.add((i,j))
        e.to_mesh_clear()
    return sorted(hits)
pieceset=set(o.name for o in GP.objs)
print('COVER_FG',cover_check(GF.objs+HAT+[FLAP,FLAP2]))
# 格子屏幕角点 -> cells.json
cells=[]
for i in range(7):
    for j in range(7):
        cs=[w2c(sc,cam,P(a,b)) for a,b in ((i,j),(i+1,j),(i+1,j+1),(i,j+1))]
        px=[(c.x*720,(1-c.y)*1280) for c in cs]
        cells.append({'i':i,'j':j,'corners':px,'w':((px[1][0]-px[0][0])+(px[2][0]-px[3][0]))/2,'h':((px[0][1]-px[3][1])+(px[1][1]-px[2][1]))/2})
json.dump(cells,open(os.path.join(OUTD,'cells.json'),'w'))
bot=(1-w2c(sc,cam,P(3.5,0)).y)*1280; topb=(1-w2c(sc,cam,P(3.5,7)).y)*1280
print('BOARD_PX bottom_edge_from_bottom=%.1f top_edge_from_top=%.1f'%(1280-bot,topb))
def render(path):
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)
if MODE=='test':
    for (i,j) in CLEAR: put_piece(i,j,1.18)
    render(os.path.join(OUTD,'raw_test.png'))
elif MODE=='main':
    with Grab() as GC:
        for (i,j) in CLEAR: put_piece(i,j,1.18)
    render(os.path.join(OUTD,'raw_main.png'))
    for o in GP.objs+GC.objs: o.hide_render=True
    render(os.path.join(OUTD,'raw_mask.png'))
    for o in GP.objs+GC.objs: o.hide_render=False
    sc.eevee.taa_render_samples=32
    c2=bpy.data.cameras.new('c2'); c2.lens=32; c2.sensor_width=36; cam2=bpy.data.objects.new('c2',c2); sc.collection.objects.link(cam2)
    sc.camera=cam2; sc.render.resolution_x=720; sc.render.resolution_y=720
    JC=[(i,j) for i in range(7) for j in range(7) if kind_at(i,j)=='jar' and (i,j)!=(1,1) and 1<=i<=5 and 1<=j<=5]
    ji,jj=JC[0]; print('JAR_CLOSE',ji,jj)
    for nm,(a,b),off in (('fold',(6.6,7.1),(-1.6,-2.9,2.3)),('tree',(1.2,7.9),(0.6,-3.6,2.2)),('jar',(ji+.75,jj+.4),(0.2,-1.3,1.15)),('bottom',(3.3,-0.35),(0.0,-3.0,2.0)),('basket',(6.4,-0.2),(-1.4,-3.0,2.4))):
        tgt=P(a,b); cam2.location=tgt+Vector(off); cam2.rotation_euler=(tgt-cam2.location).to_track_quat('-Z','Y').to_euler()
        render(os.path.join(OUTD,'raw_close_%s.png'%nm))
else:
    def seed(pp,s,rot=0.0):
        vs=[];fs=[]; top=pp+Vector((0,0,.16*s))
        vs+=[pp,pp+Vector((.006*s,0,0)),top]; fs.append([0,1,2])
        for k in range(9):
            a=k*2*math.pi/9+rot; tip=top+Vector((math.cos(a)*.11*s,math.sin(a)*.11*s,.06*s)); sd=Vector((-math.sin(a),math.cos(a),0))*.012*s
            L0=len(vs); vs+=[top+sd,top-sd,tip]; fs.append([L0,L0+1,L0+2])
        mesh_obj(vs,fs,[(1,1,1)],e=.8); ico(tuple(pp),.018*s,(0.55,0.4,0.25),sub=0)
    frames=[('f0',0.0),('f1',0.12),('f2',0.32),('f3',0.70)]
    for name,t in frames:
        with Grab() as g:
            for (i,j) in CLEAR:
                c=P(i+.5,j+.5)+n*hcl(i+.5,j+.5); s=cw(i,j)
                if t==0.0:
                    put_piece(i,j,1.0,lift=0.08); place(lambda: torus((0,0,0),.47,.045,(1,0.95,0.7),e=5),M_at(c+n*.08*s,s))
                elif t==0.12:
                    put_piece(i,j,1.18,lift=0.16); place(lambda: torus((0,0,0),.52,.05,(1,0.9,0.55),e=7),M_at(c+n*.08*s,s))
                elif t==0.32:
                    put_piece(i,j,0.55,lift=0.4)
                    for k in range(9): seed(c+Vector((random.uniform(-.7,.7),random.uniform(-.3,.7),random.uniform(.4,1.5)))*s,s*1.5,random.uniform(0,1))
                    for k in range(3): firefly(c+Vector((random.uniform(-.6,.6),random.uniform(-.2,.6),random.uniform(.5,1.3)))*s,s*1.6,8,True)
                else:
                    for k in range(9):
                        v=Vector((random.uniform(0.2,3.2),random.uniform(1.0,5.0),random.uniform(1.6,4.5)))*s
                        seed(c+v,s*1.5,random.uniform(0,1))
                    for k in range(3): firefly(c+Vector((random.uniform(0.5,2.5),random.uniform(1.5,4.5),random.uniform(1.5,3.8)))*s,s*1.6,8,True)
                    k2='strawb' if j!=3 else 'env'
                    for o in place(lambda: p2(k2), M_at(c+n*0.5*s,s*0.9)): noshadow(o)
        render(os.path.join(OUTD,'raw_fx_%s.png'%name))
        for o in g.objs:
            try: bpy.data.objects.remove(o,do_unlink=True)
            except Exception: pass
print('DONE_MODE',MODE)
