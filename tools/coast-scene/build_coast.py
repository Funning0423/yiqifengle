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
SAND=hx('#F2E0AE');SAND2=hx('#E8CF95');WET=hx('#C9AE7C');UNDER=hx('#5ED6CC');DEEP=hx('#2C9FC9')
def strata(base,dark):
  def f(p,face):
    b=0.5+0.5*math.sin(p.z*22+noise.noise(p*2)*2);c=mix(base,dark,0.35*b);
    if face.normal.z>0.75:c=mix(c,base*1.08,0.5)
    return c
  return f
# ===== 1. board slabs (4 variants): sandstone joint block with a DRY hollow lined with coloured shells =====
SLAB_TOP=0.16
SHELLC=[hx('#FF9EB5'),hx('#FFD36E'),hx('#FFF4E0'),hx('#C9A7FF'),hx('#8FE3D2')]
for k in range(4):
  name='slab_%d'%k;new(name);random.seed(100+k)
  base=[hx('#F6CC96'),hx('#F2C088'),hx('#F8D4A2'),hx('#EFBA80')][k];dark=hx('#D49A62')
  bm=bmesh.new();N=8;h=SLAB_TOP;W=0.47
  # top grid (sculpted, hollow), skirt sides -> one closed mesh
  grid={}
  for i in range(N+1):
    for j in range(N+1):
      x=-W+2*W*i/N;y=-W+2*W*j/N;r=math.hypot(x,y);z=h+0.012*noise.noise(Vector((x*5+k,y*5,0)))
      if r<0.31:z-=0.055*(1-(r/0.31)**2)**0.7     # 石窝 (dry hollow)
      e=max(abs(x),abs(y))
      if e>W-0.07:z-=0.035*((e-(W-0.07))/0.07)**1.5  # bevelled rim
      grid[i,j]=bm.verts.new((x,y,z))
  for i in range(N):
    for j in range(N):bm.faces.new((grid[i,j],grid[i+1,j],grid[i+1,j+1],grid[i,j+1]))
  ring=[grid[i,0] for i in range(N)]+[grid[N,j] for j in range(N)]+[grid[i,N] for i in range(N,0,-1)]+[grid[0,j] for j in range(N,0,-1)]
  low=[bm.verts.new((v.co.x*1.02,v.co.y*1.02,-0.02)) for v in ring]
  for a in range(len(ring)):b=(a+1)%len(ring);bm.faces.new((ring[a],low[a],low[b],ring[b]))
  bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
  def col(p,f,base=base,dark=dark):
    r=math.hypot(p.x,p.y);c=strata(base,dark)(p,f)
    if r<0.31 and p.z<h-0.01:c=mix(c,hx('#CFA06F'),0.5)   # hollow floor, dry & darker
    return c
  add_bm(name,bm,col)
  # shells in the hollow (merged, small, low)
  for s in range(6):
    a=random.random()*6.283;rr=random.uniform(0.08,0.24);x,y=math.cos(a)*rr,math.sin(a)*rr
    r0=math.hypot(x,y);z=h-0.055*(1-(r0/0.31)**2)**0.7
    sb=bmesh.new();bmesh.ops.create_cone(sb,cap_ends=True,segments=5,radius1=0.065,radius2=0.0,depth=0.03)
    M=Matrix.Translation((x,y,z+0.006))@Matrix.Rotation(random.random()*6.28,4,'Z')@Matrix.Rotation(1.3,4,'X')@Matrix.Scale(1,4,(0,0,1))
    cc=random.choice(SHELLC);add_bm(name,sb,lambda p,f,cc=cc:cc*(0.85+0.25*max(0,f.normal.z)),M);sb.free()
  bm.free();bake_ao(name,rays=12,dist=0.3,strength=0.45)
# joint bed: sits fully inside the slab footprint (fixes the outer black edge), dark wet sand in the cracks
new('joint_bed');bm=bmesh.new();bmesh.ops.create_grid(bm,x_segments=1,y_segments=1,size=3.42)
for v in bm.verts:v.co.z=0.03
add_bm('joint_bed',bm,lambda p,f:hx('#8A6646'));bm.free()
# ===== 2. reef rim / foreground rocks (6 variants, sandstone strata + AO) =====
RK=[('#EDB27C','#C98552'),('#E2A270','#B8784A'),('#F2C08C','#D0945E'),('#DA9A68','#AD7148'),('#B4BCCC','#8C95A8'),('#E8AC78','#C0824E')]
for k,(a,b) in enumerate(RK):
  name='rock_%d'%k;new(name);bm=rockbm(k*7+3,sub=3,flat=0.5+0.08*(k%3))
  add_bm(name,bm,strata(hx(a),hx(b)));bm.free();bake_ao(name,rays=12,dist=0.8,strength=0.45)
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
# ===== 3. terrain strip: dunes, irregular shoreline, shelf under water (vertex colour by height) =====
SHORE=5.2
def shore_y(x):return SHORE+1.4*noise.noise(Vector((x*0.13,3.3,0)))+0.5*math.sin(x*0.31+1.7)
def ground_z(x,y):
  sy=shore_y(x);d=y-sy
  if d<0:z=0.0+0.18*max(0,noise.noise(Vector((x*0.18,y*0.18,5))))*min(1,-d/3)+0.06*noise.noise(Vector((x*0.7,y*0.7,9)))*min(1,-d/2)
  else:z=-0.22*d-0.02*d*d
  if y<-6:z+=0.12*(-6-y)       # dune lip toward camera
  if y<-12.1:z=0.6+0.04*noise.noise(Vector((x*0.6,y*0.6,4)))   # arrival ledge = island ground (world y 0)
  elif y<-10.9 and abs(x)>1.3:z=max(z,0.6)
  if abs(x)<1.3 and -12.1<=y<-4.2:z=0.0+0.015*noise.noise(Vector((x,y,6)))   # terrace corridor S1..E
  elif abs(x)<1.7 and -12.1<=y<-4.2:z=min(z,0.6)*(abs(x)-1.3)/0.4
  return max(z,-1.4)
new('terrain');bm=bmesh.new();X0,X1,Y0,Y1=-14,14,-17,16;S=0.7
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
  z=p.z;n=noise.noise(p*0.9)
  if z>0.02:c=mix(SAND,SAND2,0.5+0.5*n)
  elif z>-0.12:c=mix(WET,SAND2,0.4)
  elif z>-0.6:c=mix(UNDER,hx('#9FE7D6'),0.3+0.3*n)
  else:c=mix(DEEP,UNDER,max(0,(z+1.4)/0.8))
  return c
add_bm('terrain',bm,tcol);bm.free()
# ===== 4. headland under the lighthouse: tiered cliff strata, ledges, grass cap, path steps, skirt rocks =====
HL=(4.3,SHORE+5.6)
new('headland');random.seed(4)
def ring_bm(r0,z0,z1,seg,seed,amp):
  bm=bmesh.new();top=[];bot=[]
  for i in range(seg):
    a=i/seg*6.283;rr=r0*(1+amp*noise.noise(Vector((math.cos(a)*1.4+seed,math.sin(a)*1.4,seed))))
    top.append(bm.verts.new((math.cos(a)*rr*1.25,math.sin(a)*rr,z1)));bot.append(bm.verts.new((math.cos(a)*rr*1.32,math.sin(a)*rr*1.06,z0)))
  for i in range(seg):j=(i+1)%seg;bm.faces.new((bot[i],bot[j],top[j],top[i]))
  bm.faces.new(top);return bm
tiers=[(3.3,-1.2,0.8,'#B79B7C','#8C7258'),(2.85,0.8,1.8,'#C9AE8C','#9B8064'),(2.45,1.8,2.6,'#D6BE9A','#A88E70')]
for k,(r,z0,z1,a,b) in enumerate(tiers):
  bm=ring_bm(r,z0,z1,34,k+2,0.16)
  for f in bm.faces:
    if len(f.verts)>4:continue
  add_bm('headland',bm,lambda p,f,a=a,b=b:(mix(hx('#5BBE45'),hx('#86D35A'),0.5+0.5*noise.noise(p)) if f.normal.z>0.8 else strata(hx(a),hx(b))(p,f)),Matrix.Translation((HL[0],HL[1],0)));bm.free()
bm=ring_bm(2.3,2.6,2.72,30,9,0.12);add_bm('headland',bm,lambda p,f:mix(hx('#56BA42'),hx('#7FD058'),0.5+0.5*noise.noise(p*1.3)),Matrix.Translation((HL[0],HL[1],0)));bm.free()
for s in range(7):   # path steps cut into the tiers (structure)
  sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);M=Matrix.Translation((HL[0]-3.3+s*0.3,HL[1]-2.6+s*0.22,0.2+s*0.36))@Matrix.Rotation(0.6,4,'Z')@Matrix.Diagonal((0.9,0.45,0.18,1))
  add_bm('headland',sb,lambda p,f:hx('#E9D7B4') if f.normal.z>0.8 else hx('#B79B7C'),M);sb.free()
bake_ao('headland',rays=10,dist=1.2,strength=0.55)
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
def shade(c,hi=1.12,lo=0.62):
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
bake_glb(ART+'env_lighthouse_ext.glb','reuse_lighthouse',9.0)
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
# ---------- layout (Blender Z-up coordinates, metres; board centre = origin) ----------
random.seed(77);L=[]
def put(m,x,y,z=0,rz=0,s=1.0,**kw):d=dict(mesh=m,p=[x,y,z],rz=rz,s=s);d.update(kw);L.append(d)
put('terrain',0,0);put('headland',0,0);put('foam',0,0,anim='foam');put('foam_inner',0,0,anim='foam2');put('joint_bed',0,0)
SL=[]
for r in range(7):
  for c in range(7):
    x=(c-3)*1.0+random.uniform(-.015,.015);y=(3-r)*1.0+random.uniform(-.015,.015);z=random.uniform(-0.02,0.02)
    put('slab_%d'%random.randrange(4),x,y,z,random.choice([0,1.5708,3.1416,4.712]),board_cell=[r,c],receive_shadow=False);SL.append((r,c,x,y,z))
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
  put('rock_%d'%(i%6),x+random.uniform(-.2,.2),-4.7+random.uniform(-.12,.12),-0.05,random.random()*6.28,random.uniform(0.5,0.72))
for i in range(12):
  x=random.choice([-1,1])*random.uniform(1.4,4.6);put(random.choice(['grass_0','grass_1','grass_2','flowers']),x,-5.3+random.uniform(-.3,.2),ground_z(x,-5.3),random.random()*6.28,random.uniform(1.0,1.5))
# beach dressing
for i in range(26):
  x=random.uniform(-12,12);y=random.uniform(-9,SHORE-0.8)
  if abs(x)<5.2 and -5.6<y<5.0:continue
  if abs(x)<2.0 and y<-4.0:continue
  put('rock_%d'%random.randrange(6),x,y,ground_z(x,y)-0.05,random.random()*6.28,random.uniform(0.25,0.7))
for i in range(30):
  x=random.uniform(-12,12);y=random.uniform(-9,SHORE-1.2)
  if abs(x)<5.0 and -5.0<y<4.8:continue
  if abs(x)<1.8 and y<-4.0:continue
  put(random.choice(['grass_0','grass_1','grass_2','flowers']),x,y,ground_z(x,y),random.random()*6.28,random.uniform(0.9,1.4))
put('sidepool',-5.6,1.6,ground_z(-5.6,1.6)+0.008,0,0.75);put('sidepool',5.7,-1.4,ground_z(5.7,-1.4)+0.008,1,0.6)
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
  put('contact',x+0.05,y-0.03,zz+0.004,0,1.0,piece=True,receive_shadow=False);put('piece_'+LAY[r][c],x,y,zz,random.uniform(-.25,.25),1.0,piece=True,cell=[r,c])
# props / animals
put('arrival_steps',0,0,0)
put('rock_2',-2.4,-11.0,ground_z(-2.4,-11.0)-0.05,0.8,1.25)   # gull rock: local -x = world +x after yaw 180 = her LEFT, top ~0.95 m above terrace
put('gull',-2.4,-11.0,ground_z(-2.4,-11.0)+0.88,2.6,1.0,anim='gull_perch')
put('ebb_bell',4.55,-3.15,0.0,0.3,1.0,anim='bell')
put('hermit',-5.4,1.5,ground_z(-5.4,1.5),0.5,1.0,anim='hermit')
put('crab',-4.9,-2.3,ground_z(-4.9,-2.3),0.7,1.0,anim='crab')
put('gull',3.9,4.25,0.36,-0.6,1.0,anim='gull_perch')
put('gull',-3.0,12.0,4.5,0.9,1.0,anim='gull_fly',k=0);put('gull',2.5,14.0,5.5,1.2,0.9,anim='gull_fly',k=1)
put('bottle',-3.5,SHORE+6.0,-0.02,0.4,1.0,anim='bottle')
put('reuse_lighthouse',HL[0]+0.3,HL[1]+0.4,2.65,0.6,0.40,reuse=True)
put('reuse_palm_tall',-6.4,SHORE-1.4,ground_z(-6.4,SHORE-1.4),0.4,1.0,reuse=True,cast_shadow=True)
put('reuse_palm_lean',6.6,SHORE-0.8,ground_z(6.6,SHORE-0.8),2.6,1.0,reuse=True,cast_shadow=True)
put('reuse_palm_tall',-8.5,-3.5,ground_z(-8.5,-3.5),1.2,0.85,reuse=True,cast_shadow=True)
put('reuse_bush',6.2,1.8,ground_z(6.2,1.8),0,1.0,reuse=True);put('reuse_bush',-6.3,-0.8,ground_z(-6.3,-0.8),1,0.9,reuse=True)
put('reuse_cloud',-12,40,14,0,3.0,reuse=True,anim='cloud',k=0);put('reuse_cloud',14,48,17,1,3.4,reuse=True,anim='cloud',k=1)
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
json.dump(dict(layout=[dict(d,p=[d['p'][0],d['p'][2],-d['p'][1]]) for d in L],shore=SHORE,headland=[HL[0],-HL[1]]),open(OUT+'/coast_layout.json','w'))
stats={n:out[n]['tris'] for n in out};stats['_new_unique']=sum(v for n,v in stats.items() if not out[n]['reuse']);stats['_reuse']=sum(v for n,v in stats.items() if n in out and out[n]['reuse'])
json.dump(stats,open(OUT+'/stats.json','w'),indent=1);print('STATS',json.dumps(stats))
# ---------- export: glb per group for the Creator bundle (new meshes only) ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
groups={'coast_board':[n for n in out if n.startswith(('slab_','joint_bed','contact','seaglass','beacon_line','anemone','tide_sheet'))],
 'coast_pieces':[n for n in out if n.startswith('piece_')],
 'coast_rocks':[n for n in out if n.startswith(('rock_','barnacles','moss'))],
 'coast_terrain':['terrain','arrival_steps','headland','foam','foam_inner','sidepool'],
 'coast_props':['ebb_bell','hermit','crab','gull','bottle','grass_0','grass_1','grass_2','flowers']}
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
