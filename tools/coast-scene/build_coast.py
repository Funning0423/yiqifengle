# 海岸支线 A「潮池礁盘」全量资产 (场景设计部 2026-10-29)
# blender -b --python build_coast.py -- <outdir>
# Writes: <out>/coast_meshes.json (engine-shot geometry, Y-up, flat-shaded, RGBA8 colours with baked AO),
#         <out>/coast_layout.json (instances), <out>/glb/*.glb (for the Creator bundle), <out>/stats.json
import bpy,bmesh,math,random,sys,json,os
from mathutils import Vector,noise,Matrix
from mathutils.bvhtree import BVHTree
OUT=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else '/workspace/tmp-exp/coast-build'
os.makedirs(OUT+'/glb',exist_ok=True)
ART='/workspace/wechat-game/art/x/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/GROKBOT-ART-001-ISLAND-EXTERIOR-v2.1.0/assets/glb/'
def hx(h):h=h.lstrip('#');return Vector([int(h[i:i+2],16)/255 for i in (0,2,4)])
def mix(a,b,t):return a*(1-t)+b*t
MESH={}      # name -> {'tris':[(p0,p1,p2)], 'cols':[(c0,c1,c2)], 'alpha':float,'emit':bool,'reuse':bool}
def new(name,reuse=False,alpha=1.0,emit=False,unlit=False):
  MESH[name]={'tris':[],'cols':[],'alpha':alpha,'emit':emit,'unlit':unlit,'reuse':reuse};return MESH[name]
def add_bm(name,bm,colfn,M=None):
  m=MESH[name];bm.normal_update()
  for f in bm.faces:
    vs=[v.co.copy() for v in f.verts]
    if M:vs=[M@v for v in vs]
    cs=[colfn(v,f) for v in vs]
    for i in range(1,len(vs)-1):
      m['tris'].append((vs[0],vs[i],vs[i+1]));m['cols'].append((cs[0],cs[i],cs[i+1]))
def ntri(name):return len(MESH[name]['tris'])
# ---------- AO (hemisphere rays against own + context triangles) ----------
def bake_ao(name,ctx_tris=None,rays=10,dist=0.6,strength=0.75):
  m=MESH[name];tris=m['tris']+(ctx_tris or [])
  verts=[];polys=[]
  for t in tris:
    b=len(verts);verts+=list(t);polys.append((b,b+1,b+2))
  bvh=BVHTree.FromPolygons(verts,polys,epsilon=0.0)
  random.seed(1);dirs=[]
  for i in range(rays):
    u=random.random();v=random.random();th=2*math.pi*u;z=0.15+0.85*v;r=math.sqrt(1-z*z);dirs.append(Vector((r*math.cos(th),r*math.sin(th),z)))
  out=[]
  for t,cs in zip(m['tris'],m['cols']):
    n=(t[1]-t[0]).cross(t[2]-t[0]);
    if n.length<1e-9:out.append(cs);continue
    n.normalize();tang=n.orthogonal().normalized();bit=n.cross(tang);nc=[]
    for p,c in zip(t,cs):
      o=p+n*0.004;hit=0
      for d in dirs:
        w=tang*d.x+bit*d.y+n*d.z;h=bvh.ray_cast(o,w,dist)
        if h[0] is not None:hit+=1-(h[3]/dist)*0.6
      ao=1-strength*hit/rays;nc.append(Vector(c[:3])*ao if len(c)==3 else c)
    out.append(nc)
  m['cols']=out
# ---------- primitives ----------
def ico(r,sub=2):
  bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=r);return bm
def rockbm(seed,sub=2,flat=0.55,rough=0.3):
  bm=ico(1,sub)
  for v in bm.verts:
    c=v.co.copy();d=1+rough*noise.noise(c*1.6+Vector((seed*3.1,seed*.7,seed*1.3)))+0.1*noise.noise(c*4+Vector((seed,0,0)))
    v.co=c*d;v.co.z*=flat
    if v.co.z<-0.15*flat:v.co.z=-0.15*flat-(v.co.z+0.15*flat)*0.2   # flat-ish base to sit on ground
  return bm
def facet_rock(seed,flat=0.6,cuts=7):
  random.seed(seed);bm=ico(1,2)
  for v in bm.verts:
    c=v.co.copy();v.co=c*(1+0.22*noise.noise(c*1.3+Vector((seed*3.1,seed*.7,seed*1.3))))
  for i in range(cuts):                       # planar cleavage faces -> chunky faceted low-poly
    n=Vector((random.uniform(-1,1),random.uniform(-1,1),random.uniform(-0.3,1))).normalized();d=random.uniform(0.62,0.85)
    g=bm.verts[:]+bm.edges[:]+bm.faces[:]
    r=bmesh.ops.bisect_plane(bm,geom=g,plane_co=n*d,plane_no=n,clear_outer=True)
    bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
  bmesh.ops.triangulate(bm,faces=bm.faces[:])
  for v in bm.verts:
    v.co.z*=flat
    if v.co.z<-0.1*flat:v.co.z=-0.1*flat-(v.co.z+0.1*flat)*0.25
  bmesh.ops.recalc_face_normals(bm,faces=bm.faces);return bm
def rock_col(a,b,seed):
  st=strata(a,b)
  def f(p,face):
    c=st(p,face);fc=face.calc_center_median();j=noise.noise(fc*3.7+Vector((seed,0,0)))
    c=c*(0.88+0.2*j)
    if face.normal.z<-0.2 or p.z<0.02:c=c*0.72                # wet dark foot
    return c
  return f
SAND=hx('#F2E0AE');SAND2=hx('#E8CF95');WET=hx('#C9AE7C');UNDER=hx('#5ED6CC');DEEP=hx('#2C9FC9')
def strata(base,dark):
  def f(p,face):
    b=0.5+0.5*math.sin(p.z*22+noise.noise(p*2)*2);c=mix(base,dark,0.35*b);
    if face.normal.z>0.75:c=mix(c,base*1.08,0.5)
    return c
  return f
# ===== 1. reef shelf: 6 slab variants split by the rock's own seams (4 dry + 2 wet seaward), carved dry hollow + shells,
#          barnacle/limpet crust on the rim, natural superellipse outline (corners open onto the reef bed), strata sides
SLAB_TOP=0.16
SHELLC=[hx('#FF9EB5'),hx('#FFD36E'),hx('#FFF4E0'),hx('#C9A7FF'),hx('#8FE3D2')]
SLABC=[('#D9893F','#9E5622'),('#C2643A','#83381E'),('#A8968A','#6E5E55'),('#D29A52','#94602C'),('#8E6448','#4E3424'),('#7E6656','#463428')]
def cone_at(name,r1,r2,d,seg,col,M):
  sb=bmesh.new();bmesh.ops.create_cone(sb,cap_ends=True,segments=seg,radius1=r1,radius2=r2,depth=d);add_bm(name,sb,col,M);sb.free()
for k in range(6):
  name='slab_%d'%k;new(name);random.seed(100+k);wet=k>=4
  base,dark=hx(SLABC[k][0]),hx(SLABC[k][1]);h=SLAB_TOP;A=16
  def outline(a,k=k):
    c,s_=abs(math.cos(a)),abs(math.sin(a));r=0.5*(c**9+s_**9)**(-1/9)
    return min(r,0.66)*(1+0.035*noise.noise(Vector((math.cos(a)*2.3+k*1.7,math.sin(a)*2.3,k))))-0.012
  RF=[0.0,0.16,0.34,0.5,0.68,0.84,0.94,1.0]
  bm=bmesh.new();rings=[]
  for ri,f in enumerate(RF):
    row=[]
    for ai in range(A if ri else 1):
      a=ai/A*6.283+(0.5/A*6.283 if ri%2 else 0);R0=outline(a)*f;x,y=math.cos(a)*R0,math.sin(a)*R0
      z=h+0.014*noise.noise(Vector((x*6+k,y*6,1)))+0.006*math.sin(x*14+y*9)
      if R0<0.3:z-=0.06*(1-(R0/0.3)**2)**0.7               # carved dry hollow
      if f>0.9:z-=0.04*((f-0.9)/0.1)                         # worn rim bevel
      row.append(bm.verts.new((x,y,z)))
    rings.append(row)
  for ai in range(A):bm.faces.new((rings[0][0],rings[1][ai],rings[1][(ai+1)%A]))
  for ri in range(1,len(RF)-1):
    for ai in range(A):
      a0,a1=rings[ri][ai],rings[ri][(ai+1)%A];b0,b1=rings[ri+1][ai],rings[ri+1][(ai+1)%A]
      if ri%2:bm.faces.new((a0,b1,a1));bm.faces.new((a0,b0,b1))
      else:bm.faces.new((a0,b0,a1));bm.faces.new((a1,b0,b1))
  low=[bm.verts.new((v.co.x*1.04,v.co.y*1.04,-0.03)) for v in rings[-1]]
  for ai in range(A):b=(ai+1)%A;bm.faces.new((rings[-1][ai],low[ai],low[b],rings[-1][b]))
  bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
  def col(p,f,base=base,dark=dark,wet=wet):
    r=math.hypot(p.x,p.y);c=strata(base,dark)(p,f)
    c=c*(0.93+0.14*noise.noise(Vector((p.x*3.1,p.y*3.1,7))))
    if f.normal.z<0.6:c=mix(c,dark*0.55,0.65)                 # seam walls dark
    elif math.hypot(p.x,p.y)>outline(math.atan2(p.y,p.x))*0.9:c=mix(c,dark*0.7,0.5)   # dark worn edge
    if r<0.3 and p.z<h-0.012:c=mix(c,hx('#D9AE7C'),0.55)      # dry hollow floor
    if wet and r>0.36:c=mix(c,hx('#5E8F4A'),0.25*max(0,noise.noise(Vector((p.x*5,p.y*5,3)))+0.3))
    return c
  add_bm(name,bm,col);bm.free()
  for s_ in range(5):                                         # shells in the hollow
    a=random.random()*6.283;rr=random.uniform(0.1,0.24);x,y=math.cos(a)*rr,math.sin(a)*rr
    z=h-0.06*(1-(rr/0.3)**2)**0.7
    cc=random.choice(SHELLC);cone_at(name,0.06,0.0,0.03,5,lambda p,f,cc=cc:cc*(0.8+0.3*max(0,f.normal.z)),Matrix.Translation((x,y,z+0.006))@Matrix.Rotation(random.random()*6.28,4,'Z')@Matrix.Rotation(1.3,4,'X'))
  for s_ in range(7 if not wet else 9):                       # barnacle crust on the rim
    a=random.random()*6.283;rr=outline(a)*random.uniform(0.8,0.92);x,y=math.cos(a)*rr,math.sin(a)*rr
    cone_at(name,0.026,0.012,0.03,5,lambda p,f:hx('#F4EAD6') if f.normal.z<0.9 else hx('#8C7A64'),Matrix.Translation((x,y,h-0.02)))
  for s_ in range(3):                                         # limpets
    a=random.random()*6.283;rr=outline(a)*random.uniform(0.62,0.8);x,y=math.cos(a)*rr,math.sin(a)*rr
    cone_at(name,0.045,0.0,0.035,6,lambda p,f:mix(hx('#D9CBB3'),hx('#8E7E6A'),0.5+0.5*math.sin(math.atan2(p.y-y,p.x-x)*6)),Matrix.Translation((x,y,h+0.004)))
  bake_ao(name,rays=12,dist=0.25,strength=0.5)
# reef bed under the slabs: one irregular rock platform, wet & weedy toward the sea (+y), visible in the seams
new('reef_base');bm=bmesh.new();A=40;RB=[0,0.35,0.65,0.85,0.95,1.0,1.08];rows=[]
for ri,f in enumerate(RB):
  row=[]
  for ai in range(A if ri else 1):
    a=ai/A*6.283;rr=4.05*(1+0.06*noise.noise(Vector((math.cos(a)*1.8,math.sin(a)*1.8,4))))*f
    x,y=math.cos(a)*rr*1.03,math.sin(a)*rr;x=max(-4.25,min(4.25,x));y=max(-4.15,min(4.3,y))
    z=0.05+0.02*noise.noise(Vector((x*2,y*2,5))) if f<1.0 else -0.16
    row.append(bm.verts.new((x,y,z)))
  rows.append(row)
for ai in range(A):bm.faces.new((rows[0][0],rows[1][ai],rows[1][(ai+1)%A]))
for ri in range(1,len(RB)-1):
  for ai in range(A):bm.faces.new((rows[ri][ai],rows[ri+1][ai],rows[ri+1][(ai+1)%A],rows[ri][(ai+1)%A]))
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
def rbcol(p,f):
  c=mix(hx('#4A3022'),hx('#36241A'),0.5+0.5*noise.noise(p*2.5))
  if p.y>1.8:c=mix(c,hx('#4E6E3C'),min(1,(p.y-1.8)/2.2)*0.55)   # wet, algae seaward
  return c
add_bm('reef_base',bm,rbcol);bm.free();bake_ao('reef_base',rays=8,dist=0.4,strength=0.4)
new('weed');random.seed(12)
for i in range(7):
  a=random.random()*6.28;r=random.uniform(0,0.06);hh=random.uniform(0.07,0.14)
  bm=bmesh.new();v0=bm.verts.new((-0.018,0,0));v1=bm.verts.new((0.018,0,0));v2=bm.verts.new((0.0,0.03,hh));bm.faces.new((v0,v1,v2))
  g=random.choice([hx('#3E8E3A'),hx('#6BA83C'),hx('#8A7A2E')]);add_bm('weed',bm,lambda p,f,g=g:mix(g*0.6,g*1.2,p.z/0.14),Matrix.Translation((math.cos(a)*r,math.sin(a)*r,0))@Matrix.Rotation(random.random()*6.28,4,'Z')@Matrix.Rotation(random.uniform(-.5,.5),4,'X'));bm.free()
# ===== 2. reef rim / foreground rocks (6 variants, sandstone strata + AO) =====
RK=[('#EDB27C','#C98552'),('#E2A270','#B8784A'),('#F2C08C','#D0945E'),('#DA9A68','#AD7148'),('#B4BCCC','#8C95A8'),('#E8AC78','#C0824E')]
for k,(a,b) in enumerate(RK):
  name='rock_%d'%k;new(name);bm=facet_rock(k*7+3,flat=0.55+0.08*(k%3))
  add_bm(name,bm,rock_col(hx(a),hx(b),k));bm.free();bake_ao(name,rays=12,dist=0.8,strength=0.5)
# moss / barnacle clusters (instanced on rocks)
new('barnacles');random.seed(7)
for i in range(7):
  sb=ico(0.035,1);M=Matrix.Translation((random.uniform(-.12,.12),random.uniform(-.12,.12),0))@Matrix.Scale(1,4,(0,0,1))
  for v in sb.verts:v.co.z*=0.6
  add_bm('barnacles',sb,lambda p,f:hx('#F7EEDA') if f.normal.z<0.9 else hx('#CFC3AE'),M);sb.free()
new('moss');random.seed(8)
for i in range(5):
  sb=ico(0.06,1)
  for v in sb.verts:v.co.z*=0.35
  add_bm('moss',sb,lambda p,f:mix(hx('#4FB648'),hx('#8ED65A'),max(0,f.normal.z)),Matrix.Translation((random.uniform(-.15,.15),random.uniform(-.15,.15),0)));sb.free()
new('drift');bm=bmesh.new();A=12;cen=bm.verts.new((0,0,0.1));ring=[]
for i in range(A):
  a=i/A*6.283;r=1+0.25*noise.noise(Vector((math.cos(a)*2,math.sin(a)*2,8))) ;ring.append(bm.verts.new((math.cos(a)*r,math.sin(a)*r*0.8,-0.02)))
mid=[bm.verts.new((v.co.x*0.55,v.co.y*0.55,0.075)) for v in ring]
for i in range(A):j=(i+1)%A;bm.faces.new((cen,mid[i],mid[j]));bm.faces.new((mid[i],ring[i],ring[j],mid[j]))
add_bm('drift',bm,lambda p,f:mix(hx('#F4E4B4'),hx('#E2C98E'),0.5+0.5*noise.noise(p*3)));bm.free()
new('starfish_deco');bm=bmesh.new();vs=[]
for i in range(10):
  a=i/10*6.283;r=0.16 if i%2==0 else 0.06;vs.append(bm.verts.new((math.cos(a)*r,math.sin(a)*r,0.0)))
c=bm.verts.new((0,0,0.04))
for i in range(10):bm.faces.new((vs[i],vs[(i+1)%10],c))
add_bm('starfish_deco',bm,lambda p,f:hx('#FF7F50')*(0.7+0.4*max(0,f.normal.z)));bm.free()
new('driftwood')
for (x0,a,l) in [(0,0.0,0.9),(0.42,0.5,0.5)]:
  sb=bmesh.new();bmesh.ops.create_cone(sb,cap_ends=True,segments=6,radius1=0.06,radius2=0.045,depth=l)
  add_bm('driftwood',sb,strata(hx('#C9B49A'),hx('#8E7A64')),Matrix.Translation((x0,a*0.4,0.05))@Matrix.Rotation(a,4,'Z')@Matrix.Rotation(1.5708,4,'Y'));sb.free()
bake_ao('driftwood',rays=6,dist=0.2,strength=0.4)
# ---- r3 dressing (original shapes): grass cap, fisher's net + poles, upturned dinghy, crab trap, rope coil, shell/pebble scatter, footprints
new('grasscap');bm=facet_rock(301,flat=0.35,cuts=6)
add_bm('grasscap',bm,lambda p,f:mix(hx('#4DB33C'),hx('#93DA5A'),0.5+0.5*noise.noise(p*2)) if f.normal.z>0.3 else mix(hx('#3E8E30'),hx('#2F6E26'),0.5));bm.free()
new('net_poles')
for sx in (-1,1):
  cone_at('net_poles',0.04,0.03,1.3,6,strata(hx('#B08A5E'),hx('#6E5236')),Matrix.Translation((sx*0.9,0,0.65))@Matrix.Rotation(sx*0.06,4,'Y'))
cone_at('net_poles',0.025,0.025,1.9,5,strata(hx('#B08A5E'),hx('#6E5236')),Matrix.Translation((0,0,1.24))@Matrix.Rotation(1.5708,4,'Y'))
new('net',alpha=0.85)
bm=bmesh.new();NX,NZ=8,5;G={}
for i in range(NX+1):
  for j in range(NZ+1):
    x=-0.85+1.7*i/NX;z=1.2-0.85*j/NZ-0.18*math.sin(math.pi*i/NX)*(j/NZ);G[i,j]=bm.verts.new((x,0.02*math.sin(i*1.7+j),z))
for i in range(NX):
  for j in range(NZ):bm.faces.new((G[i,j],G[i+1,j],G[i+1,j+1],G[i,j+1]))
add_bm('net',bm,lambda p,f:mix(hx('#3FA7A0'),hx('#2B7C78'),0.5+0.5*math.sin(p.x*40)*math.sin(p.z*40)));bm.free()
for k in range(3):cone_at('net',0.05,0.05,0.04,6,lambda p,f:hx('#FF8A3D'),Matrix.Translation((-0.5+0.5*k,0.0,0.62))@Matrix.Rotation(1.5708,4,'X'))
new('dinghy');bm=bmesh.new();ROW=[]
for i in range(7):
  t=i/6;y=-1.1+2.2*t;w=0.52*math.sin(math.pi*min(1,max(0.08,t)))**0.6;row=[]
  for a in range(7):
    th=math.pi*a/6;row.append(bm.verts.new((math.cos(th)*w,y,0.05+math.sin(th)*0.36*(0.7+0.3*math.sin(math.pi*t)))))
  ROW.append(row)
for i in range(6):
  for a in range(6):bm.faces.new((ROW[i][a],ROW[i+1][a],ROW[i+1][a+1],ROW[i][a+1]))
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
add_bm('dinghy',bm,lambda p,f:(hx('#2F7FC1') if p.z>0.28 else (hx('#F4EEDC') if p.z>0.12 else hx('#D9483B')))*(0.6+0.5*max(0,f.normal.z*0.7+0.3)));bm.free()
bake_ao('dinghy',rays=8,dist=0.4,strength=0.45)
new('crabtrap')
sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);add_bm('crabtrap',sb,lambda p,f:hx('#C9A56A') if f.normal.z>0.5 else hx('#8C6A3E'),Matrix.Translation((0,0,0.03))@Matrix.Diagonal((0.62,0.42,0.06,1)));sb.free()
for (x,y) in [(-0.28,-0.18),(0.28,-0.18),(-0.28,0.18),(0.28,0.18)]:cone_at('crabtrap',0.02,0.02,0.36,4,lambda p,f:hx('#8C6A3E'),Matrix.Translation((x,y,0.21)))
sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);add_bm('crabtrap',sb,lambda p,f:hx('#E0B978'),Matrix.Translation((0,0,0.39))@Matrix.Diagonal((0.62,0.42,0.04,1)));sb.free()
new('crabtrap_mesh',alpha=0.6);sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);add_bm('crabtrap_mesh',sb,lambda p,f:hx('#4F9C8E'),Matrix.Translation((0,0,0.21))@Matrix.Diagonal((0.56,0.36,0.3,1)));sb.free()
new('rope_coil')
for k in range(3):
  sb=bmesh.new();bmesh.ops.create_cone(sb,cap_ends=False,segments=10,radius1=0.22-0.05*k,radius2=0.2-0.05*k,depth=0.05);add_bm('rope_coil',sb,lambda p,f:mix(hx('#E8C98A'),hx('#B8955A'),0.5+0.5*math.sin(math.atan2(p.y,p.x)*10)),Matrix.Translation((0,0,0.025+0.045*k)));sb.free()
sb=bmesh.new();bmesh.ops.create_circle(sb,cap_ends=True,segments=10,radius=0.2);add_bm('rope_coil',sb,lambda p,f:hx('#C8A66A'),Matrix.Translation((0,0,0.005)));sb.free()
new('shells_scatter');random.seed(55)
for i in range(16):
  x=random.uniform(-0.9,0.9);y=random.uniform(-0.9,0.9)
  if random.random()<0.5:
    cc=random.choice(SHELLC);cone_at('shells_scatter',0.045,0.0,0.025,5,lambda p,f,cc=cc:cc*(0.8+0.3*max(0,f.normal.z)),Matrix.Translation((x,y,0.01))@Matrix.Rotation(random.random()*6.3,4,'Z')@Matrix.Rotation(1.3,4,'X'))
  else:
    sb=ico(random.uniform(0.025,0.05),1)
    for v in sb.verts:v.co.z*=0.55
    cc=random.choice([hx('#B9B2A8'),hx('#8F8780'),hx('#D8CFC2'),hx('#6F6A66')]);add_bm('shells_scatter',sb,lambda p,f,cc=cc:cc*(0.75+0.35*max(0,f.normal.z)),Matrix.Translation((x,y,0.012)));sb.free()
new('footprints',alpha=0.55,unlit=True)
for i in range(6):
  sb=bmesh.new();bmesh.ops.create_circle(sb,cap_ends=True,segments=6,radius=0.06);x=0.11*(1 if i%2 else -1);y=-0.9+0.36*i
  add_bm('footprints',sb,lambda p,f:hx('#C6A66C'),Matrix.Translation((x,y,0.004))@Matrix.Diagonal((0.75,1.4,1,1)));sb.free()
# ===== 3. terrain strip: dunes, irregular shoreline, shelf under water (vertex colour by height) =====
SHORE=5.2
def shore_y(x):return SHORE+1.4*noise.noise(Vector((x*0.13,3.3,0)))+0.5*math.sin(x*0.31+1.7)
def ground_z(x,y):
  sy=shore_y(x);d=y-sy
  if d<0:z=0.0+0.18*max(0,noise.noise(Vector((x*0.18,y*0.18,5))))*min(1,-d/3)+0.06*noise.noise(Vector((x*0.7,y*0.7,9)))*min(1,-d/2)
  else:z=-0.22*d-0.02*d*d
  if y<-6:z+=0.12*(-6-y)       # dune lip toward camera
  if abs(x)>4.9 and d<-1.5:z+=min(0.9,0.3*(abs(x)-4.9))*min(1,(-d-1.5)/2.5)   # dune banks left/right
  if y<-12.1:
    # r2: landing berm + ramp that meets the island's real beach (island mesh probe, tools/coast-scene/island_fit.py);
    # behind the ramp the coast terrain drops under the island sand so the island owns that ground.
    if abs(x)<1.7 and y>=-13.1:z=0.6+0.245*min(1,(-12.1-y)/1.0)+0.012*noise.noise(Vector((x*2,y*2,4)))
    elif abs(x)<1.7 and y>=-13.6:z=0.845-1.4*((-13.1-y)/0.5)
    else:z=min(z,0.6)-0.9*min(1,(-12.1-y)/1.2)
  elif y<-10.9 and abs(x)>1.3:z=max(z,0.6)
  if abs(x)<1.3 and -12.1<=y<-4.2:z=0.0+0.015*noise.noise(Vector((x,y,6)))   # terrace corridor S1..E
  elif abs(x)<1.7 and -12.1<=y<-4.2:z=min(z,0.6)*(abs(x)-1.3)/0.4
  return max(z,-1.4)
new('terrain');bm=bmesh.new();X0,X1,Y0,Y1=-14,14,-17,16;S=0.8
nx=int((X1-X0)/S);ny=int((Y1-Y0)/S);V={}
for i in range(nx+1):
  for j in range(ny+1):
    x=X0+i*S+(0.18*noise.noise(Vector((i,j,1))) if 0<i<nx else 0);y=Y0+j*S+(0.18*noise.noise(Vector((i,j,2))) if 0<j<ny else 0)
    V[i,j]=bm.verts.new((x,y,ground_z(x,y)))
for i in range(nx):
  for j in range(ny):
    a,b,c,d=V[i,j],V[i+1,j],V[i+1,j+1],V[i,j+1]
    if (i+j)%2:bm.faces.new((a,b,c));bm.faces.new((a,c,d))
    else:bm.faces.new((a,b,d));bm.faces.new((b,c,d))
def tcol(p,f):
  z=p.z;n=noise.noise(p*0.9);d=p.y-shore_y(p.x)
  if -1.3<d<0.15 and z>-0.12:return mix(WET,hx('#B89A6A'),0.3+0.3*n)     # wet-sand strip
  if z>0.02:c=mix(SAND,SAND2,0.5+0.5*n)
  elif z>-0.12:c=mix(WET,SAND2,0.4)
  elif z>-0.6:c=mix(UNDER,hx('#9FE7D6'),0.3+0.3*n)
  else:c=mix(DEEP,UNDER,max(0,(z+1.4)/0.8))
  return c
add_bm('terrain',bm,tcol);bm.free()
# ===== 4. headland: cluster of faceted cliff blocks (strata), grass cap, small beacon post (no second lighthouse) =====
HL=(4.6,SHORE+5.2)
new('headland');random.seed(4)
BL=[(0,0,0.0,2.2,1.5),(1.6,0.8,0.0,1.7,1.2),(-1.5,0.6,0.0,1.6,1.1),(0.5,1.8,0.0,1.9,1.4),(-0.9,-1.3,-0.3,1.3,0.8),(1.4,-1.0,-0.3,1.2,0.7),(0.2,0.3,1.4,1.5,0.9)]
for k,(x,y,z,sz,hz) in enumerate(BL):
  bm=facet_rock(200+k,flat=1.0,cuts=8);M=Matrix.Translation((HL[0]+x,HL[1]+y,z))@Matrix.Rotation(k*1.3,4,'Z')@Matrix.Diagonal((sz,sz*0.9,hz,1))
  add_bm('headland',bm,lambda p,f:(mix(hx('#5BBE45'),hx('#8AD65C'),0.5+0.5*noise.noise(p)) if (f.normal.z>0.72 and p.z>1.1) else rock_col(hx('#EAC79A'),hx('#C29A70'),k)(p,f)),M);bm.free()
bake_ao('headland',rays=10,dist=1.2,strength=0.55)
HTOP=2.25
new('beacon_post')
cone_at('beacon_post',0.09,0.07,1.3,6,lambda p,f:(hx('#FFFFFF') if int(p.z/0.26)%2==0 else hx('#E8503A'))*(0.7+0.35*max(0,f.normal.x*0.5+0.5)),Matrix.Translation((0,0,0.65)))
cone_at('beacon_post',0.2,0.2,0.06,8,lambda p,f:hx('#7E5A38'),Matrix.Translation((0,0,0.03)))
cone_at('beacon_post',0.12,0.12,0.03,8,lambda p,f:hx('#3A3A44'),Matrix.Translation((0,0,1.31)))
new('beacon_lamp',emit=True);cone_at('beacon_lamp',0.1,0.08,0.16,8,lambda p,f:hx('#FFE45C'),Matrix.Translation((0,0,1.4)))
cone_at('beacon_lamp',0.13,0.0,0.12,8,lambda p,f:hx('#FF8A3D'),Matrix.Translation((0,0,1.54)))
# ===== 5. foam: irregular double band following the shoreline, clustered gaps, varying width =====
new('foam',alpha=0.92,unlit=True);new('foam_inner',alpha=0.55,unlit=True)
for nm,off,wid,z in [('foam',0.0,0.34,-0.012),('foam_inner',0.55,0.18,-0.03)]:
  xs=[X0+0.35*i for i in range(int((X1-X0)/0.35)+1)]
  for i in range(len(xs)-1):
    x,x2=xs[i],xs[i+1];g=noise.noise(Vector((x*0.45,off*3,1)))
    if g<-0.3:continue
    def edge(xx,sgn):
      y=shore_y(xx)+off+0.12;w=wid*(0.45+1.1*abs(noise.noise(Vector((xx*0.9,off,2)))));return y,y+w*sgn
    ya,yb=edge(x,1);yc,yd=edge(x2,1)
    bm=bmesh.new();a=bm.verts.new((x,ya,z));b=bm.verts.new((x2,yc,z));c=bm.verts.new((x2,yd,z));d=bm.verts.new((x,yb,z));bm.faces.new((a,b,c,d))
    add_bm(nm,bm,lambda p,f:Vector((1,1,1)));bm.free()
# ===== 6. pieces (6 types, thick, single meshes, ≤200 tris each) =====
PC={'conch':'#FF7A59','star':'#FFC21A','coral':'#E8274B','float':'#1E7BFF','scallop':'#A35BFF','badge':'#14B87A'}
def shade(c,hi=1.22,lo=0.5):
  return lambda p,f:c*(lo+(hi-lo)*max(0,f.normal.z*0.8+0.2))
S=0.42
# conch: ONE swept spiral mesh (no separate ring -> no interpenetration)
new('piece_conch');bm=bmesh.new();rings=[];NR=11;NS=10
for i in range(NR+1):
  t=i/NR;z=t*S*1.45;r=S*0.62*(1-t)**0.85+0.02
  row=[]
  for j in range(NS):
    a=j/NS*6.283;rr=r*(1+0.22*max(0,math.sin(a*1+t*14)))   # whorl ridge spirals up the shell
    row.append(bm.verts.new((math.cos(a)*rr,math.sin(a)*rr,z)))
  rings.append(row)
for i in range(NR):
  for j in range(NS):k=(j+1)%NS;bm.faces.new((rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]))
bm.faces.new(list(reversed(rings[0])))
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
M=Matrix.Translation((0,0,S*0.42))@Matrix.Rotation(math.radians(70),4,'X')@Matrix.Translation((0,0,-S*0.55))
add_bm('piece_conch',bm,lambda p,f:(mix(hx(PC['conch']),hx('#FFE7D2'),0.7) if math.sin(math.atan2(p.y,p.x)+p.z*30)>0.55 else hx(PC['conch']))*(0.62+0.5*max(0,f.normal.z*0.8+0.2)),M);bm.free()
# star
new('piece_star');bm=bmesh.new();vs=[]
for i in range(10):
  a=i/10*6.283+math.pi/2;r=S*1.0 if i%2==0 else S*0.44;vs.append(bm.verts.new((math.cos(a)*r,math.sin(a)*r,0.0)))
top=[bm.verts.new((v.co.x*0.82,v.co.y*0.82,S*0.34)) for v in vs];c=bm.verts.new((0,0,S*0.58))
for i in range(10):
  j=(i+1)%10;bm.faces.new((vs[i],vs[j],top[j],top[i]));bm.faces.new((top[i],top[j],c))
bm.faces.new(list(reversed(vs)));bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
add_bm('piece_star',bm,shade(hx(PC['star'])));bm.free()
# coral: trunk + 3 branches merged, dark base
new('piece_coral')
for (x,y,h,r,tx,ty) in [(0,0,0.9,0.2,0,0),(0.12,0.05,0.62,0.14,0.25,0.1),(-0.1,0.08,0.7,0.14,-0.22,0.15),(0.02,-0.12,0.55,0.13,0.05,-0.24)]:
  bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=S*r,radius2=S*r*0.7,depth=S*h)
  M=Matrix.Translation((x*S,y*S,S*(0.12+h/2)))@Matrix.Rotation(ty*1.6,4,'X')@Matrix.Rotation(-tx*1.6,4,'Y')
  add_bm('piece_coral',bm,shade(hx(PC['coral'])),M);bm.free()
bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=8,radius1=S*0.6,radius2=S*0.5,depth=S*0.24);add_bm('piece_coral',bm,shade(hx('#A51632')),Matrix.Translation((0,0,S*0.12)));bm.free()
# glass float with rope band (band is a raised ring ON the surface, same mesh)
new('piece_float');bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=7,radius=S*0.62)
for v in bm.verts:
  if abs(v.co.z)<S*0.1:v.co*=1.06
add_bm('piece_float',bm,lambda p,f:(hx('#EAD7AA')*(0.7+0.4*max(0,f.normal.z)) if abs(p.z-S*0.64)<S*0.1 else hx(PC['float'])*(0.55+0.6*max(0,f.normal.z*0.8+0.2))),Matrix.Translation((0,0,S*0.64)));bm.free()
# scallop: ribbed fan, solid
new('piece_scallop');bm=bmesh.new();N=9;hinge=bm.verts.new((0,-S*0.5,S*0.08));top=[];bot=[]
for i in range(N+1):
  a=math.pi*0.12+math.pi*0.76*i/N;r=S*0.98;x,y=math.cos(a)*r,-S*0.5+math.sin(a)*r
  top.append(bm.verts.new((x,y,S*(0.2+0.12*(i%2)))));bot.append(bm.verts.new((x,y,0.0)))
hb=bm.verts.new((0,-S*0.5,0.0))
for i in range(N):
  bm.faces.new((hinge,top[i],top[i+1]));bm.faces.new((hb,bot[i+1],bot[i]));bm.faces.new((top[i],bot[i],bot[i+1],top[i+1]))
bm.faces.new((hinge,hb,bot[0],top[0]));bm.faces.new((hinge,top[N],bot[N],hb));bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
add_bm('piece_scallop',bm,shade(hx(PC['scallop'])),Matrix.Translation((0,0.06,0))@Matrix.Rotation(-0.3,4,'X'));bm.free()
# lighthouse badge: thick disc + white tower + lamp
new('piece_badge')
for (r1,r2,d,z,c) in [(0.85,0.8,0.36,0.18,PC['badge']),(0.3,0.2,0.62,0.67,'#FFFFFF'),(0.24,0.24,0.14,1.05,'#FFE36B'),(0.27,0.05,0.16,1.2,'#E8503A')]:
  bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=12 if r1>0.5 else 8,radius1=S*r1,radius2=S*r2,depth=S*d)
  add_bm('piece_badge',bm,shade(hx(c)),Matrix.Translation((0,0,S*z)));bm.free()
for k in PC:bake_ao('piece_'+k,rays=8,dist=0.15,strength=0.5)
# contact shadow disc (baked, shared) — pieces get real side light, slabs do NOT receive scene shadows (palm-shadow mask, R5)
new('contact',alpha=0.55,unlit=True);bm=bmesh.new();bmesh.ops.create_circle(bm,cap_ends=True,segments=14,radius=0.36)
add_bm('contact',bm,lambda p,f:hx('#4A2E1C'));bm.free()
# ===== 7. beacon: sea-glass pebbles (instanced 16 in the cracks), crack light line, preview anemone =====
new('seaglass',emit=True);bm=ico(0.07,1)
for v in bm.verts:v.co.z*=0.7
add_bm('seaglass',bm,lambda p,f:hx('#FFF27A'));bm.free()
new('beacon_line',emit=True,alpha=0.9,unlit=True)
for (dx,dy,sx,sy) in [(0,0.5,0.5,0.025),(0,-0.5,0.5,0.025),(0.5,0,0.025,0.5),(-0.5,0,0.025,0.5)]:
  bm=bmesh.new();bmesh.ops.create_grid(bm,x_segments=1,y_segments=1,size=1);add_bm('beacon_line',bm,lambda p,f:hx('#FFE45C'),Matrix.Translation((dx,dy,0.075))@Matrix.Diagonal((sx,sy,1,1)));bm.free()
new('anemone',emit=True);random.seed(3)
for i in range(8):
  a=i/8*6.283;bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=False,segments=4,radius1=0.018,radius2=0.004,depth=0.1)
  M=Matrix.Translation((math.cos(a)*0.03,math.sin(a)*0.03,0.06))@Matrix.Rotation(0.5,4,Vector((-math.sin(a),math.cos(a),0)))
  add_bm('anemone',bm,lambda p,f:hx('#9CFFF0'),M);bm.free()
bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=7,radius1=0.05,radius2=0.04,depth=0.04);add_bm('anemone',bm,lambda p,f:hx('#3FB7A8'),Matrix.Translation((0,0,0.02)));bm.free()
# tide-in sheet (only during a clear): thin water lens that fills one cell then drains
new('tide_sheet',alpha=0.6);bm=bmesh.new();bmesh.ops.create_circle(bm,cap_ends=True,segments=16,radius=0.44)
for v in bm.verts:v.co.z=0.012*noise.noise(v.co*9)
add_bm('tide_sheet',bm,lambda p,f:hx('#7FE6EE'));bm.free()
# ===== 8. theme prop 退潮铃, hermit crab, crab, gull, drift bottle, grass tufts, side pool =====
new('ebb_bell')
bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=0.07,radius2=0.05,depth=1.1);add_bm('ebb_bell',bm,strata(hx('#B98C5E'),hx('#7E5A38')),Matrix.Translation((0,0,0.55))@Matrix.Rotation(0.08,4,'X'));bm.free()
bm=bmesh.new();bmesh.ops.create_cube(bm,size=1);add_bm('ebb_bell',bm,strata(hx('#B98C5E'),hx('#7E5A38')),Matrix.Translation((0.17,0,1.05))@Matrix.Diagonal((0.42,0.07,0.06,1)));bm.free()
bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=10,radius1=0.13,radius2=0.05,depth=0.18);add_bm('ebb_bell',bm,shade(hx('#3EC1D8')),Matrix.Translation((0.32,0,0.88)));bm.free()
bm=ico(0.035,1);add_bm('ebb_bell',bm,shade(hx('#FFD34E')),Matrix.Translation((0.32,0,0.78)));bm.free()
new('hermit');bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=7,radius1=0.09,radius2=0.0,depth=0.16)
add_bm('hermit',bm,shade(hx('#FF9EB5')),Matrix.Translation((0,0,0.08))@Matrix.Rotation(1.2,4,'Y'));bm.free()
for s in (-1,1):
  bm=ico(0.025,1);add_bm('hermit',bm,shade(hx('#E8503A')),Matrix.Translation((0.1,s*0.03,0.03)));bm.free()
new('crab');bm=ico(0.11,1)
for v in bm.verts:v.co.z*=0.45;v.co.x*=1.3
add_bm('crab',bm,shade(hx('#F25C2A')),Matrix.Translation((0,0,0.06)));bm.free()
for s in (-1,1):
  for k in range(3):
    bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=False,segments=3,radius1=0.012,radius2=0.008,depth=0.12);add_bm('crab',bm,shade(hx('#D4461C')),Matrix.Translation((s*0.13,-0.06+k*0.06,0.03))@Matrix.Rotation(s*1.1,4,'Y'));bm.free()
  bm=ico(0.04,1);add_bm('crab',bm,shade(hx('#FF7A45')),Matrix.Translation((s*0.1,0.12,0.06)));bm.free()
  bm=ico(0.014,1);add_bm('crab',bm,lambda p,f:hx('#202020'),Matrix.Translation((s*0.04,0.08,0.11)));bm.free()
new('gull');bm=ico(0.12,1)
for v in bm.verts:v.co.y*=1.9;v.co.z*=0.9
add_bm('gull',bm,shade(hx('#FFFFFF'),1.05,0.75),Matrix.Translation((0,0,0.16)));bm.free()
for s in (-1,1):
  bm=bmesh.new();a=bm.verts.new((0,0.02,0.2));b=bm.verts.new((s*0.42,-0.06,0.27));c=bm.verts.new((0,-0.16,0.2));bm.faces.new((a,b,c) if s>0 else (a,c,b));add_bm('gull',bm,lambda p,f:hx('#C7CDD8'));bm.free()
bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=4,radius1=0.025,radius2=0.0,depth=0.08);add_bm('gull',bm,shade(hx('#FFB020')),Matrix.Translation((0,0.26,0.19))@Matrix.Rotation(-1.57,4,'X'));bm.free()
for s in (-1,1):
  bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=False,segments=3,radius1=0.01,radius2=0.01,depth=0.08);add_bm('gull',bm,shade(hx('#FFB020')),Matrix.Translation((s*0.04,0,0.04)));bm.free()
new('bottle');bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=7,radius1=0.06,radius2=0.06,depth=0.2);add_bm('bottle',bm,shade(hx('#6FE0B0')),Matrix.Rotation(1.57,4,'Y'));bm.free()
bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=0.03,radius2=0.025,depth=0.07);add_bm('bottle',bm,shade(hx('#C08A50')),Matrix.Translation((0.13,0,0))@Matrix.Rotation(1.57,4,'Y'));bm.free()
for k in range(3):
  nm='grass_%d'%k;new(nm);random.seed(30+k)
  for i in range(6+k):
    a=random.random()*6.28;r=random.uniform(0,0.12);h=random.uniform(0.25,0.45)
    bm=bmesh.new();v0=bm.verts.new((-0.025,0,0));v1=bm.verts.new((0.025,0,0));v2=bm.verts.new((0.0,0.05,h));bm.faces.new((v0,v1,v2))
    M=Matrix.Translation((math.cos(a)*r,math.sin(a)*r,0))@Matrix.Rotation(random.random()*6.28,4,'Z')@Matrix.Rotation(random.uniform(-.3,.3),4,'X')
    g=[hx('#3FAE3B'),hx('#62C64A'),hx('#8BD95E')][k];add_bm(nm,bm,lambda p,f,g=g:mix(g*0.7,g*1.15,p.z/0.45),M);bm.free()
new('flowers')
for i,c in enumerate(['#FF6FA3','#FFE15A','#FFFFFF','#B48CFF']):
  bm=ico(0.045,1);add_bm('flowers',bm,shade(hx(c)),Matrix.Translation((0.1*math.cos(i*1.6),0.1*math.sin(i*1.6),0.2)));bm.free()
  bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=False,segments=3,radius1=0.008,radius2=0.006,depth=0.2);add_bm('flowers',bm,lambda p,f:hx('#4FAE3E'),Matrix.Translation((0.1*math.cos(i*1.6),0.1*math.sin(i*1.6),0.1)));bm.free()
new('sidepool',alpha=0.7);bm=bmesh.new();bmesh.ops.create_circle(bm,cap_ends=True,segments=18,radius=1)
for v in bm.verts:r=1+0.18*noise.noise(v.co*2.2);v.co.x*=r;v.co.y*=r*0.7
add_bm('sidepool',bm,lambda p,f:hx('#3FD3D8'));bm.free()
# ===== reused island assets (baked palette -> vertex colour for the engine shot only; not counted as new) =====
def bake_glb(path,name,target_h=None):
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=path);objs=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
  new(name,reuse=True);dg=bpy.context.evaluated_depsgraph_get()
  for o in objs:
    me=o.evaluated_get(dg).to_mesh();img=None
    for m in o.data.materials:
      if m and m.use_nodes:
        for n in m.node_tree.nodes:
          if n.type=='TEX_IMAGE' and n.image:img=n.image
    px=list(img.pixels) if img else None;W_,H_=(img.size[0],img.size[1]) if img else (1,1)
    uv=me.uv_layers.active.data if me.uv_layers.active else None
    for p in me.polygons:
      vs=[o.matrix_world@me.vertices[me.loops[l].vertex_index].co for l in p.loop_indices];cs=[]
      for l in p.loop_indices:
        if px and uv:
          u,v=uv[l].uv;x=min(W_-1,max(0,int(u%1*W_)));y=min(H_-1,max(0,int(v%1*H_)));k=(y*W_+x)*4;c=Vector(px[k:k+3])
          c=Vector([x_**(1/2.2) for x_ in c])
        else:
          mm=o.data.materials[p.material_index] if o.data.materials else None;c=Vector(mm.diffuse_color[:3]) if mm else Vector((0.8,0.8,0.8))
        cs.append(c)
      for i in range(1,len(vs)-1):MESH[name]['tris'].append((vs[0],vs[i],vs[i+1]));MESH[name]['cols'].append((cs[0],cs[i],cs[i+1]))
  for o in objs:bpy.data.objects.remove(o)
  if target_h:
    zs=[p.z for t in MESH[name]['tris'] for p in t];s=target_h/(max(zs)-min(zs));mz=min(zs)
    MESH[name]['tris']=[tuple(Vector((p.x*s,p.y*s,(p.z-mz)*s)) for p in t) for t in MESH[name]['tris']]
bpy.ops.wm.read_factory_settings(use_empty=True)
bake_glb(ART+'env_prop_palm_tall_01.glb','reuse_palm_tall')
bake_glb(ART+'env_prop_palm_lean_01.glb','reuse_palm_lean')
new('arrival_steps')
for k in range(3):   # 3 steps, rise 0.2, tread 0.4: S0 (y -12.1, z .6) -> S1 (y -10.9, z 0)
  sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);top=0.6-0.2*(k+1)+0.2;y0=-12.1+0.4*k
  M=Matrix.Translation((0,y0+0.2,top/2))@Matrix.Diagonal((2.6,0.4,top,1))
  add_bm('arrival_steps',sb,lambda p,f:(mix(SAND,SAND2,0.5) if f.normal.z>0.8 else mix(hx('#E3B37E'),hx('#C99561'),0.5)),M);sb.free()
bake_ao('arrival_steps',rays=8,dist=0.3,strength=0.4)
bake_glb(ART+'env_cloud_01.glb','reuse_cloud')
bake_glb(ART+'env_prop_hydrangea_bush_01.glb','reuse_bush')
_m=MESH['reuse_cloud'];_nc=[]
for t in _m['tris']:
  n=(t[1]-t[0]).cross(t[2]-t[0]);n=n.normalized() if n.length>1e-9 else Vector((0,0,1))
  c=mix(hx('#CFE3F7'),hx('#FFFFFF'),min(1,max(0,0.55+0.6*n.z)));_nc.append((c,c,c))
_m['cols']=_nc
# ---------- layout (Blender Z-up coordinates, metres; board centre = origin) ----------
random.seed(77);L=[]
def put(m,x,y,z=0,rz=0,s=1.0,**kw):d=dict(mesh=m,p=[x,y,z],rz=rz,s=s);d.update(kw);L.append(d)
put('terrain',0,0);put('headland',0,0);put('foam',0,0,anim='foam');put('foam_inner',0,0,anim='foam2');put('reef_base',0,0,receive_shadow=False)
SL=[]
for r in range(7):
  for c in range(7):
    x=(c-3)*1.0;y=(3-r)*1.0;z=random.uniform(-0.03,0.03)       # cell centres stay regular
    v=random.choice([4,5]) if r==0 or (r==1 and random.random()<0.4) else random.randrange(4)
    put('slab_%d'%v,x+random.uniform(-.02,.02),y+random.uniform(-.02,.02),z,random.random()*6.283,board_cell=[r,c],receive_shadow=False,tilt=[random.uniform(-2.2,2.2),random.uniform(-2.2,2.2)]);SL.append((r,c,x,y,z))
for r in range(8):                                             # weed tufts in the seams (cell corners)
  for c in range(8):
    if random.random()<0.62:put('weed',(c-3.5)+random.uniform(-.06,.06),(3.5-r)+random.uniform(-.06,.06),0.05,random.random()*6.28,random.uniform(0.9,1.4),receive_shadow=False)
# rim rocks lean onto the outer slab edges (hide the slab skirt) + irregular outline
for i in range(44):
  a=i/44*6.283+random.uniform(-.05,.05);rr=4.05+0.45*abs(noise.noise(Vector((a*2,1,1))));x=math.cos(a)*rr*1.02;y=math.sin(a)*rr
  x=max(-4.3,min(4.3,x)) if abs(y)<3.6 else x;y=max(-4.25,min(4.3,y)) if abs(x)<3.6 else y
  s=random.uniform(0.3,0.55)
  if y<-3.4 and abs(x)<0.9:continue   # arrival gap (E)
  put('rock_%d'%random.randrange(6),x,y,-0.05,random.random()*6.28,s)
  if random.random()<0.5:put(random.choice(['barnacles','moss']),x,y,s*0.42,random.random()*6.28,1.0)
# R4 foreground: bottom row of rocks + grass/flowers overlapping the board's lower edge
for i,x in enumerate([-4.0,-2.9,-1.7,1.7,2.7,3.8]):
  s=random.uniform(0.5,0.72);xx=x+random.uniform(-.2,.2);yy=-4.7+random.uniform(-.12,.12)
  put('rock_%d'%(i%6),xx,yy,-0.2*s,random.random()*6.28,s);put('drift',xx,yy-0.1,ground_z(xx,yy)-0.01,random.random()*6.28,s*1.5)
for i in range(12):
  x=random.choice([-1,1])*random.uniform(1.4,4.6);put(random.choice(['grass_0','grass_1','grass_2','flowers']),x,-5.3+random.uniform(-.3,.2),ground_z(x,-5.3),random.random()*6.28,random.uniform(1.0,1.5))
# beach dressing
for i in range(26):
  x=random.uniform(-12,12);y=random.uniform(-9,SHORE-0.8)
  if abs(x)<5.2 and -5.6<y<5.0:continue
  if abs(x)<2.0 and y<-4.0:continue
  s=random.uniform(0.25,0.7);put('rock_%d'%random.randrange(6),x,y,ground_z(x,y)-0.22*s,random.random()*6.28,s);put('drift',x,y,ground_z(x,y)-0.01,random.random()*6.28,s*1.4)
for i in range(30):
  x=random.uniform(-12,12);y=random.uniform(-9,SHORE-1.2)
  if abs(x)<5.0 and -5.0<y<4.8:continue
  if abs(x)<1.8 and y<-4.0:continue
  put(random.choice(['grass_0','grass_1','grass_2','flowers']),x,y,ground_z(x,y),random.random()*6.28,random.uniform(0.9,1.4))
put('sidepool',-5.6,1.6,ground_z(-5.6,1.6)+0.008,0,0.75)
for (x,y,rz) in [(-1.8,-6.9,0.4),(2.3,-6.4,1.9),(-5.2,-3.9,3.0),(5.0,-5.2,1.1)]:put('starfish_deco',x,y,ground_z(x,y)+0.005,rz,1.1)
put('driftwood',3.4,-5.9,ground_z(3.4,-5.9),0.3,1.0);put('driftwood',-6.0,2.8,ground_z(-6.0,2.8),2.0,1.2)
put('sidepool',-2.6,-6.6,ground_z(-2.6,-6.6)+0.008,0.5,0.45);put('sidepool',5.7,-1.4,ground_z(5.7,-1.4)+0.008,1,0.6)
# beacon (current = row 2 col 4) + previews
BR,BC=2,4;bx,by=(BC-3)*1.0,(3-BR)*1.0
for i in range(16):
  t=i/16*4;side=int(t);f=t-side;q=[(-.5+f,.5),(.5,.5-f),(.5-f,-.5),(-.5,-.5+f)][side]
  put('seaglass',bx+q[0]*1.0,by+q[1]*1.0,0.07,random.random()*6,1.0,anim='beacon',k=i)
put('beacon_line',bx,by,0,anim='beacon_line')
for k,(r,c) in enumerate([(3,3),(4,1),(5,4)]):put('anemone',(c-3)+0.38,(3-r)+0.38,SLAB_TOP-0.025,0,1.0+0.2*(k==0),anim='anemone',k=k)
# pieces + contact discs
KINDS=list(PC);random.seed(41);LAY=[[None]*7 for _ in range(7)]
for r in range(7):
  for c in range(7):
    opts=[k for k in KINDS if not (c>=2 and LAY[r][c-1]==k==LAY[r][c-2]) and not (r>=2 and LAY[r-1][c]==k==LAY[r-2][c])];LAY[r][c]=random.choice(opts)
for (r,c,x,y,z) in SL:
  zz=z+SLAB_TOP-0.05      # sits on the shell bed in the dry hollow
  put('contact',x+0.05,y-0.03,zz+0.004,0,1.22,piece=True,receive_shadow=False);put('piece_'+LAY[r][c],x,y,zz,random.uniform(-.25,.25),1.22,piece=True,cell=[r,c])
# props / animals
put('arrival_steps',0,0,0)
# gull rocks (her LEFT, >=2.0 m off her line): faceted stratified cluster instead of one blob
for (x,y,sc,rz,k) in [(-2.5,-11.0,0.85,0.8,3),(-3.1,-10.5,0.6,2.1,0),(-2.2,-11.7,0.5,4.0,5)]:put('rock_%d'%k,x,y,ground_z(x,y)-0.2*sc,rz,sc)
put('gull',-2.5,-11.0,ground_z(-2.5,-11.0)+0.52,2.6,1.0,anim='gull_perch')
# r3: land wraps the board — low faceted cliffs / outcrops with grass caps + dune grass banks, left and right
random.seed(901)
for side in (-1,1):
  for i,(y,sc) in enumerate([(-6.5,1.5),(-4.2,1.9),(-1.8,2.2),(0.8,1.8),(3.0,1.4)]):
    x=side*(5.45+0.35*math.sin(i*1.7))+random.uniform(-.3,.3);zz=ground_z(x,y)-0.25*sc
    put('rock_%d'%((i*2+(side>0))%6),x,y,zz,random.random()*6.28,sc,cast_shadow=True)
    put('grasscap',x+random.uniform(-.15,.15),y,zz+0.5*sc*0.62,random.random()*6.28,sc*0.42)
    for g in range(4):
      gx=x+side*random.uniform(0.4,1.6);gy=y+random.uniform(-0.9,0.9);put(random.choice(['grass_0','grass_1','grass_2','grass_2','flowers']),gx,gy,ground_z(gx,gy),random.random()*6.28,random.uniform(0.9,1.7))
# fisher's corner (right side, sea end) and trap + rope (left, near the arrival) — all >=1.6 m off her line
put('net_poles',4.7,4.7,ground_z(4.7,4.7),0.35,1.0,cast_shadow=True);put('net',4.7,4.7,ground_z(4.7,4.7),0.35,1.0,cast_shadow=True)
put('dinghy',-4.9,4.6,ground_z(-4.9,4.6),1.35,1.0,cast_shadow=True)
put('crabtrap',-2.6,-7.6,ground_z(-2.6,-7.6),0.4,1.0,cast_shadow=True);put('crabtrap_mesh',-2.6,-7.6,ground_z(-2.6,-7.6),0.4,1.0)
put('rope_coil',-2.0,-8.3,ground_z(-2.0,-8.3),0,1.0)
put('driftwood',2.3,-8.9,ground_z(2.3,-8.9),2.5,1.1)
for (x,y,s_) in [(-3.6,-6.2,1.0),(3.3,-7.0,1.2),(-5.0,-1.0,0.9),(5.1,-2.6,1.0),(-1.9,-9.6,0.8),(2.6,-10.2,0.9),(4.2,-5.6,1.1),(-4.4,-8.8,1.0)]:put('shells_scatter',x,y,ground_z(x,y),random.random()*6.28,s_)
for i in range(7):put('footprints',0.05*math.sin(i),-10.6+1.0*i,0.001,0.03*math.sin(i*2),1.0)   # worn path S1 -> E (decals on the sand, not obstacles)
# foreground clusters below the board (R4 + density): faceted rocks with drifts, grass, shells (>=1.6 m off her line)
for (x,y,sc) in [(-3.0,-6.0,0.45),(-4.4,-7.0,0.6),(-1.9,-7.9,0.35),(2.1,-7.4,0.4),(3.9,-6.6,0.55),(4.6,-8.2,0.7),(-3.8,-9.4,0.5),(3.0,-9.6,0.45)]:
  put('rock_%d'%random.randrange(6),x,y,ground_z(x,y)-0.22*sc,random.random()*6.28,sc,cast_shadow=True);put('drift',x,y,ground_z(x,y)-0.01,random.random()*6.28,sc*1.4)
  for g in range(3):
    gx=x+random.uniform(-.6,.6);gy=y+random.uniform(-.5,.5)
    if abs(gx)>1.6:put(random.choice(['grass_0','grass_1','grass_2','flowers']),gx,gy,ground_z(gx,gy),random.random()*6.28,random.uniform(0.8,1.8))
# two tide pools with anemones outside the board
for (x,y,sc) in [(-3.4,-5.9,0.55),(3.6,-6.1,0.5)]:
  put('sidepool',x,y,ground_z(x,y)+0.008,random.random()*6,sc)
  for a in range(3):put('anemone',x+0.25*math.cos(a*2.1),y+0.18*math.sin(a*2.1),ground_z(x,y)+0.01,0,0.9,anim='anemone',k=a)
# dune grass + flowers clusters at mixed sizes along the arrival (>=1.6 m off the line)
for i in range(22):
  side=random.choice([-1,1]);x=side*random.uniform(1.7,5.0);y=random.uniform(-12.8,-5.4)
  put(random.choice(['grass_0','grass_1','grass_2','flowers']),x,y,ground_z(x,y),random.random()*6.28,random.uniform(0.7,2.0))
put('ebb_bell',4.55,-3.15,0.0,0.3,1.0,anim='bell')
put('hermit',-5.4,1.5,ground_z(-5.4,1.5),0.5,1.0,anim='hermit')
put('crab',-4.9,-2.3,ground_z(-4.9,-2.3),0.7,1.0,anim='crab')
put('gull',3.9,4.25,0.36,-0.6,1.0,anim='gull_perch')
put('gull',-3.0,12.0,4.5,0.9,1.0,anim='gull_fly',k=0);put('gull',2.5,14.0,5.5,1.2,0.9,anim='gull_fly',k=1)
put('bottle',-3.5,SHORE+6.0,-0.02,0.4,1.0,anim='bottle')
put('beacon_post',HL[0]+0.2,HL[1]+0.3,HTOP,0.6,1.0,cast_shadow=True);put('beacon_lamp',HL[0]+0.2,HL[1]+0.3,HTOP,0.6,1.0,anim='lamp')
put('reuse_palm_tall',-6.4,SHORE-1.4,ground_z(-6.4,SHORE-1.4),0.4,1.0,reuse=True,cast_shadow=True)
put('reuse_palm_lean',6.6,SHORE-0.8,ground_z(6.6,SHORE-0.8),2.6,1.0,reuse=True,cast_shadow=True)
put('reuse_palm_tall',-8.5,-3.5,ground_z(-8.5,-3.5),1.2,0.85,reuse=True,cast_shadow=True)
put('reuse_bush',6.2,1.8,ground_z(6.2,1.8),0,1.0,reuse=True);put('reuse_bush',-6.3,-0.8,ground_z(-6.3,-0.8),1,0.9,reuse=True)
for k,(x,y,z,sc) in enumerate([(-30,150,1,0.9),(22,165,3,1.1),(60,145,0,0.8),(-78,160,2,1.0),(100,170,1,0.9)]):put('reuse_cloud',x,y,z,k*0.9,sc,reuse=True,anim='cloud',k=k)
# ---------- export: engine JSON (Y-up: x, z, -y) ----------
def conv(v):return [round(v.x,4),round(v.z,4),round(-v.y,4)]
out={}
for n,m in MESH.items():
  P=[];C=[];Nn=[]
  for t,cs in zip(m['tris'],m['cols']):
    nrm=(t[1]-t[0]).cross(t[2]-t[0])
    if nrm.length<1e-10:continue
    nrm.normalize()
    for p,c in zip(t,cs):
      P+=conv(p);Nn+=conv(nrm);cc=[max(0,min(255,int(round(x*255)))) for x in c[:3]];C+=cc+[int(m['alpha']*255)]
  out[n]=dict(positions=P,normals=Nn,colors=C,alpha=m['alpha'],emit=m['emit'],unlit=m['unlit'],reuse=m['reuse'],tris=len(P)//9)
json.dump(out,open(OUT+'/coast_meshes.json','w'))
PLACEMENT=dict(parent='island scene_root (frame of combined_anchors_m.json / combined_visual_m.glb)',position=[-0.6,-0.845,21.5],yaw_deg=180,scale=1,
  anchors_local=dict(ramp_start=[0,0.845,13.1],S0=[0,0.6,12.1],S1=[0,0,10.9],E=[0,0,4.9],stop=[0,0,5.15],board_centre=[0,0,0]),
  island_walk=dict(start='exit_point',via=['exit_path_06..17',[-0.7,0,7.4]],ramp_start_world=[-0.6,0,8.4]))
json.dump(dict(layout=[dict(d,p=[d['p'][0],d['p'][2],-d['p'][1]]) for d in L],shore=SHORE,headland=[HL[0],-HL[1]],placement=PLACEMENT),open(OUT+'/coast_layout.json','w'))
stats={n:out[n]['tris'] for n in out};stats['_new_unique']=sum(v for n,v in stats.items() if not out[n]['reuse']);stats['_reuse']=sum(v for n,v in stats.items() if n in out and out[n]['reuse'])
json.dump(stats,open(OUT+'/stats.json','w'),indent=1);print('STATS',json.dumps(stats))
# ---------- export: glb per group for the Creator bundle (new meshes only) ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
groups={'coast_board':[n for n in out if n.startswith(('slab_','reef_base','weed','contact','seaglass','beacon_line','anemone','tide_sheet'))],
 'coast_pieces':[n for n in out if n.startswith('piece_')],
 'coast_rocks':[n for n in out if n.startswith(('rock_','barnacles','moss'))],
 'coast_terrain':['terrain','arrival_steps','headland','beacon_post','beacon_lamp','drift','foam','foam_inner','sidepool'],
 'coast_props':['grasscap','net_poles','net','dinghy','crabtrap','crabtrap_mesh','rope_coil','shells_scatter','footprints','starfish_deco','driftwood','ebb_bell','hermit','crab','gull','bottle','grass_0','grass_1','grass_2','flowers']}
for g,names in groups.items():
  for o in list(bpy.data.objects):bpy.data.objects.remove(o)
  for n in names:
    m=MESH[n];me=bpy.data.meshes.new(n);verts=[];faces=[]
    for t in m['tris']:b=len(verts);verts+=[tuple(p) for p in t];faces.append((b,b+1,b+2))
    me.from_pydata(verts,[],faces);ca=me.color_attributes.new('Col','BYTE_COLOR','CORNER')
    i=0
    for cs in m['cols']:
      for c in cs:ca.data[i].color=(c[0]**2.2,c[1]**2.2,c[2]**2.2,m['alpha']);i+=1
    o=bpy.data.objects.new(n,me);bpy.context.scene.collection.objects.link(o)
  kw=dict(filepath=OUT+'/glb/%s.glb'%g,export_format='GLB',use_selection=False,export_normals=True,export_apply=True)
  for extra in ({'export_vertex_color':'ACTIVE'},{'export_colors':True},{}):
    try:bpy.ops.export_scene.gltf(**kw,**extra);break
    except TypeError:continue
print('DONE')
