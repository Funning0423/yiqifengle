# 海岸支线 A「潮池礁盘」全量资产 (场景设计部 2026-10-29)
# blender -b --python build_coast.py -- <outdir>
# Writes: <out>/coast_meshes.json (engine-shot geometry, Y-up, flat-shaded, RGBA8 colours with baked AO),
#         <out>/coast_layout.json (runtime instances, no piece_*), <out>/coast_layout_full.json (all instances incl. piece_*, tools/preview), <out>/glb/*.glb (for the Creator bundle), <out>/stats.json
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
class _N:
  def __init__(s,n):s.normal=n
def add_bm(name,bm,colfn,M=None):
  m=MESH[name];bm.normal_update()
  for f in bm.faces:
    vs=[v.co.copy() for v in f.verts]
    if M:vs=[M@v for v in vs]
    if name.startswith('piece_'):   # r5d: soft painted shading — smooth vertex normals for the baked paint (no facets)
      global _FC;_FC=sum(vs,Vector())/len(vs)   # r5f: face centre for per-face bands (scallop ribs)
      R3=(M.to_3x3() if M else Matrix.Identity(3));cs=[colfn(vv,_N((R3@v.normal).normalized())) for vv,v in zip(vs,f.verts)]
    else:cs=[colfn(v,f) for v in vs]
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
def facet_rock(seed,flat=0.6,cuts=10):
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
def rock_col(a,b,seed,band=0.16):
  def f(p,face):
    fc=face.calc_center_median();j=noise.noise(fc*3.7+Vector((seed,0,0)))
    k=int(math.floor((p.z+0.06*noise.noise(p*1.3+Vector((seed,1,0))))/band))%3
    c=[a*1.02,mix(a,b,0.2),mix(a,b,0.32)][k]   # r5: soft tone bands (island rocks)                          # hard sedimentary bands
    if face.normal.z>0.75:c=mix(c,a*1.1,0.55)                    # weathered tops
    elif abs(face.normal.z)<0.35 and (abs(math.sin(fc.x*12.9+fc.y*78.2+fc.z*37.7)*4375.5)%1)>0.62:c=c*0.92   # r5: faint crevices
    c=c*(0.96+0.06*j)
    if face.normal.z<-0.2 or p.z<0.02:c=c*0.9                # wet dark foot
    return c
  return f
SAND=hx('#F3F0DC');SAND2=hx('#EAE6CF');WET=hx('#D8D2B4')   # r5d: island v2.2 beach (H~0.17 S~0.07 V~0.86 rendered)
UNDER=hx('#5FD8D0');DEEP=hx('#2FB4CC')   # r5b: warm sand, vivid shelf   # r5: lighter sand, pale cyan-green shelf
def strata(base,dark):
  def f(p,face):
    b=0.5+0.5*math.sin(p.z*22+noise.noise(p*2)*2);c=mix(base,dark,0.12*b);
    if face.normal.z>0.75:c=mix(c,base*1.08,0.5)
    return c
  return f
# ===== 1. reef shelf: 6 slab variants split by the rock's own seams (4 dry + 2 wet seaward), carved dry hollow + shells,
#          barnacle/limpet crust on the rim, natural superellipse outline (corners open onto the reef bed), strata sides
SLAB_TOP=0.16
SHELLC=[hx('#FF9EB5'),hx('#FFD36E'),hx('#FFF4E0'),hx('#C9A7FF'),hx('#8FE3D2')]
SLABC=[('#C4CEC0','#B1BBAD')]*6   # r5d: soft pale sage stone (island tile panel S 0.11 V 0.79)
_OLDSLAB=[('#E2DACB','#D2C9B8')]*6   # r5c: one uniform tone for all variants   # r5: soft pale warm grey
def cone_at(name,r1,r2,d,seg,col,M):
  sb=bmesh.new();bmesh.ops.create_cone(sb,cap_ends=True,segments=seg,radius1=r1,radius2=r2,depth=d);add_bm(name,sb,col,M);sb.free()
for k in range(6):
  name='slab_%d'%k;new(name);random.seed(100+k);wet=k>=4
  base,dark=hx(SLABC[k][0]),hx(SLABC[k][1]);h=SLAB_TOP;A=14
  def outline(a,k=k):
    c,s_=abs(math.cos(a)),abs(math.sin(a));r=0.468*(c**9+s_**9)**(-1/9)   # r5f: base 0.89 of the cell, gap 0.10 (island L13)
    return min(r,0.66)*(1+0.035*noise.noise(Vector((math.cos(a)*2.3+k*1.7,math.sin(a)*2.3,k))))-0.012
  RF=[0.0,0.3,0.55,0.72,0.84,0.92,0.97,1.0]   # r5: island-rock density
  bm=bmesh.new();rings=[]
  for ri,f in enumerate(RF):
    row=[]
    for ai in range(A if ri else 1):
      a=ai/A*6.283+(0.5/A*6.283 if ri%2 else 0);R0=outline(a)*f;x,y=math.cos(a)*R0,math.sin(a)*R0
      z=h+0.014*noise.noise(Vector((x*6+k,y*6,1)))+0.006*math.sin(x*14+y*9)
      if R0<0.3:z-=0.06*(1-(R0/0.3)**2)**0.7               # carved dry hollow
      if f>0.78:u=(f-0.78)/0.22;z-=0.13*(1-math.sqrt(max(0.0,1-u*u)))   # r5: rounded rim roll-off (r ~0.13 m)
      row.append(bm.verts.new((x,y,z)))
    rings.append(row)
  for ai in range(A):bm.faces.new((rings[0][0],rings[1][ai],rings[1][(ai+1)%A]))
  for ri in range(1,len(RF)-1):
    for ai in range(A):
      a0,a1=rings[ri][ai],rings[ri][(ai+1)%A];b0,b1=rings[ri+1][ai],rings[ri+1][(ai+1)%A]
      if ri%2:bm.faces.new((a0,b1,a1));bm.faces.new((a0,b0,b1))
      else:bm.faces.new((a0,b0,a1));bm.faces.new((a1,b0,b1))
  low=[bm.verts.new((v.co.x*1.015,v.co.y*1.015,-0.03)) for v in rings[-1]]
  for ai in range(A):b=(ai+1)%A;bm.faces.new((rings[-1][ai],low[ai],low[b],rings[-1][b]))
  bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
  def col(p,f,base=base,dark=dark,wet=wet):
    r=math.hypot(p.x,p.y);c=mix(base,strata(base,dark)(p,f),0.2)
    c=c*(0.99+0.02*noise.noise(Vector((p.x*3.1,p.y*3.1,7))))   # r5c: even brightness
    if f.normal.z<0.35:c=mix(c,dark*0.85,0.45)                 # seam walls dark
    elif math.hypot(p.x,p.y)>outline(math.atan2(p.y,p.x))*0.9:c=mix(c,dark,0.25)   # soft worn edge
    if r<0.3 and p.z<h-0.012:c=mix(c,base*0.94,0.3)            # dry hollow floor (stays dark under the piece)
    if False and wet and r>0.36:c=mix(c,hx('#9FC48A'),0.18*max(0,noise.noise(Vector((p.x*5,p.y*5,3)))+0.3))
    return c
  add_bm(name,bm,col);bm.free()
  for s_ in range(0):                                         # r5c: removed (tidy board) — one tone-on-tone shell in the hollow (r4b: no confetti)
    a=random.random()*6.283;rr=random.uniform(0.1,0.24);x,y=math.cos(a)*rr,math.sin(a)*rr
    z=h-0.06*(1-(rr/0.3)**2)**0.7
    cc=mix(base,hx('#FFFFFF'),0.22);cone_at(name,0.06,0.0,0.03,5,lambda p,f,cc=cc:cc*(0.8+0.3*max(0,f.normal.z)),Matrix.Translation((x,y,z+0.006))@Matrix.Rotation(random.random()*6.28,4,'Z')@Matrix.Rotation(1.3,4,'X'))
  for s_ in range(0):                       # r5c: removed — barnacle crust on the rim
    a=random.random()*6.283;rr=outline(a)*random.uniform(0.8,0.92);x,y=math.cos(a)*rr,math.sin(a)*rr
    cone_at(name,0.026,0.012,0.03,5,lambda p,f:hx('#F6EFE2') if f.normal.z<0.9 else hx('#C8BBA6'),Matrix.Translation((x,y,h-0.02)))
  for s_ in range(0):                                         # r5c: removed — limpets
    a=random.random()*6.283;rr=outline(a)*random.uniform(0.62,0.8);x,y=math.cos(a)*rr,math.sin(a)*rr
    cone_at(name,0.045,0.0,0.035,6,lambda p,f:mix(hx('#D9CBB3'),hx('#8E7E6A'),0.5+0.5*math.sin(math.atan2(p.y-y,p.x-x)*6)),Matrix.Translation((x,y,h+0.004)))
  bake_ao(name,rays=12,dist=0.25,strength=0.15)
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
  c=mix(hx('#BAC8BE'),hx('#B2C0B6'),0.5+0.5*noise.noise(p*2.5))   # r5f: tray floor one value step below the slabs (island gap V0.76 vs tile 0.81)   # r5d: seam floor one step below the slabs   # r5c: cream tray floor in the seams
  if False:c=mix(c,hx('#8DB07A'),min(1,(p.y-1.8)/2.2)*0.4)   # wet, algae seaward
  return c
bm.normal_update()
for _f in bm.faces:
  if _f.normal.z<0:_f.normal_flip()   # r5f: open disc — keep faces up (was back-face culled; gaps showed sand)
add_bm('reef_base',bm,rbcol);bm.free();bake_ao('reef_base',rays=8,dist=0.4,strength=0.15)
new('weed');random.seed(12)
for i in range(7):
  a=random.random()*6.28;r=random.uniform(0,0.06);hh=random.uniform(0.07,0.14)
  bm=bmesh.new();v0=bm.verts.new((-0.018,0,0));v1=bm.verts.new((0.018,0,0));v2=bm.verts.new((0.0,0.03,hh));bm.faces.new((v0,v1,v2))
  g=random.choice([hx('#3E8E3A'),hx('#6BA83C'),hx('#8A7A2E')]);add_bm('weed',bm,lambda p,f,g=g:mix(g*0.6,g*1.2,p.z/0.14),Matrix.Translation((math.cos(a)*r,math.sin(a)*r,0))@Matrix.Rotation(random.random()*6.28,4,'Z')@Matrix.Rotation(random.uniform(-.5,.5),4,'X'));bm.free()
# r5c: tray rim — a rounded cream stone kerb around the 7x7 board (island tray edge feel), swept tube on a rounded rectangle
new('board_rim');bm=bmesh.new();HW=3.72;RC=0.55;TR=0.2;NP=56;NT=6;path=[]
for i in range(NP):
  u=i/NP*4;sd=int(u);f=u-sd
  cs=[(HW-RC,HW-RC),(-(HW-RC),HW-RC),(-(HW-RC),-(HW-RC)),(HW-RC,-(HW-RC))][sd];a=sd*math.pi/2+f*math.pi/2
  path.append(Vector((cs[0]+RC*math.cos(a),cs[1]+RC*math.sin(a),0.02)))   # r5d: sunk ~0.13 into the sand (contact)
rows=[]
for i,pt in enumerate(path):
  tg=(path[(i+1)%NP]-path[i-1]).normalized();out_=Vector((tg.y,-tg.x,0));row=[]
  for j in range(NT):
    a=j/NT*2*math.pi;row.append(bm.verts.new(pt+out_*math.cos(a)*TR*1.15+Vector((0,0,1))*math.sin(a)*TR*0.75))
  rows.append(row)
for i in range(NP):
  for j in range(NT):bm.faces.new((rows[i][j],rows[(i+1)%NP][j],rows[(i+1)%NP][(j+1)%NT],rows[i][(j+1)%NT]))
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
def rimcol(p,f):   # r5d: weathered sandstone kerb blocks — joints every ~0.75 m, grain, damp darker foot where it meets the sand
  u=(math.atan2(p.y,p.x)*3.9+ (p.x+p.y)*0.9);j=abs(math.sin((abs(p.x)+abs(p.y))*4.2))
  c=mix(hx('#B9A98A'),hx('#D8CCB0'),max(0,f.normal.z)*0.8+0.2)*(0.93+0.09*noise.noise(Vector((p.x*4,p.y*4,p.z*9))))
  if j<0.12:c=c*0.8
  if p.z<0.0:c=mix(c,hx('#9E8F72'),0.5)
  return c
add_bm('board_rim',bm,rimcol);bm.free();bake_ao('board_rim',rays=8,dist=0.3,strength=0.45)
# ===== 2. reef rim / foreground rocks (6 variants, sandstone strata + AO) =====
RK=[('#B9C0C8','#7E8894'),('#DDD5C4','#A9A08C'),('#A7B0B8','#6E7884'),('#E8E0CE','#B4AA94'),('#929CA8','#5C6672'),('#D2CAB8','#9A917E')]
for k,(a,b) in enumerate(RK):
  name='rock_%d'%k;new(name);bm=facet_rock(k*7+3,flat=0.55+0.08*(k%3))
  add_bm(name,bm,rock_col(hx(a),hx(b),k));bm.free();bake_ao(name,rays=12,dist=0.8,strength=0.5)
for k in range(3):
  name='boulder_%d'%k;new(name);bm=facet_rock(500+k*11,flat=0.62+0.1*k,cuts=12)
  add_bm(name,bm,rock_col(hx(['#E6BE8A','#DDB07E','#E9C596'][k]),hx(['#8E6644','#84603E','#987050'][k]),20+k,band=0.2));bm.free();bake_ao(name,rays=12,dist=0.8,strength=0.55)
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
add_bm('drift',bm,lambda p,f:mix(SAND,SAND2*0.97,0.5+0.5*noise.noise(p*3)));bm.free()
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
add_bm('grasscap',bm,lambda p,f:mix(hx('#65a546'),hx('#bac66a'),0.5+0.5*noise.noise(p*2)) if f.normal.z>0.3 else mix(hx('#5f8a45'),hx('#9fb14c'),0.5));bm.free()
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
for _py in (-0.14,0.0,0.14):   # r5b: 3 separate base planks (1.5 cm gaps)
  sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);bmesh.ops.bevel(sb,geom=sb.edges[:],offset=0.22,segments=2,affect='EDGES');add_bm('crabtrap',sb,lambda p,f:mix(hx('#a3723d'),hx('#d8ab68'),max(0,f.normal.z)),Matrix.Translation((0,_py,0.03))@Matrix.Diagonal((0.62,0.125,0.06,1)));sb.free()
for (x,y) in [(-0.28,-0.18),(0.28,-0.18),(-0.28,0.18),(0.28,0.18)]:cone_at('crabtrap',0.02,0.02,0.36,4,lambda p,f:hx('#9c7444'),Matrix.Translation((x,y,0.21)))
for _py in (-0.14,0.0,0.14):   # r5b: 3 separate lid planks, no overlap
  sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);bmesh.ops.bevel(sb,geom=sb.edges[:],offset=0.22,segments=2,affect='EDGES');add_bm('crabtrap',sb,lambda p,f:mix(hx('#b8894d'),hx('#e3bd7c'),max(0,f.normal.z)),Matrix.Translation((0,_py,0.39+0.004*(_py>0)))@Matrix.Diagonal((0.62,0.125,0.05,1)));sb.free()
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
  if y<-8.5 and abs(x)>1.9 and z>0.3:z+=0.07*noise.noise(Vector((x*0.6,y*0.6,11)))+0.02*math.sin(x*2.4+y*0.9)   # r5b: gentle undulation + ripples
  if abs(x)<1.3 and -12.1<=y<-4.2:z=0.0+0.015*noise.noise(Vector((x,y,6)))   # terrace corridor S1..E
  elif abs(x)<1.7 and -12.1<=y<-4.2:z=min(z,0.6)*(abs(x)-1.3)/0.4
  if abs(x)<3.85 and abs(y)<3.85:z=min(z,-0.02)   # r5f: sand stays under the tray floor (gaps show the sage floor, not sand)
  return max(z,-1.4)
new('terrain');bm=bmesh.new();X0,X1,Y0,Y1=-14,14,-17,16;S=0.8   # smooth-shaded in r5b
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
  if z>0.02:c=mix(SAND,SAND2,0.5+0.5*n)*(0.97+0.035*math.sin(p.x*2.6+p.y*1.1+2*n))   # r5b: soft ripple bands
  elif z>-0.12:c=mix(WET,SAND2,0.4)
  elif z>-0.6:c=mix(UNDER,hx('#9FE7D6'),0.3+0.3*n)
  else:c=mix(DEEP,UNDER,max(0,(z+1.4)/0.8))
  return c
add_bm('terrain',bm,tcol);bm.free()
# ===== 4. headland: cluster of faceted cliff blocks (strata), grass cap, small beacon post (no second lighthouse) =====
HL=(8.2,SHORE+5.2)   # r5c: was 4.6 (cut in at the game view's top right)
new('headland');random.seed(4)
BL=[(0,0,0.0,2.2,1.5),(1.6,0.8,0.0,1.7,1.2),(-1.5,0.6,0.0,1.6,1.1),(0.5,1.8,0.0,1.9,1.4),(-0.9,-1.3,-0.3,1.3,0.8),(1.4,-1.0,-0.3,1.2,0.7),(0.2,0.3,1.4,1.5,0.9)]
for k,(x,y,z,sz,hz) in enumerate(BL):
  bm=facet_rock(200+k,flat=1.0,cuts=11);M=Matrix.Translation((HL[0]+x,HL[1]+y,z))@Matrix.Rotation(k*1.3,4,'Z')@Matrix.Diagonal((sz,sz*0.9,hz,1))
  add_bm('headland',bm,lambda p,f:(mix(hx('#65a546'),hx('#bac66a'),0.5+0.5*noise.noise(p)) if (f.normal.z>0.72 and p.z>1.1) else rock_col(hx('#E2D6C0'),hx('#BFB29C'),k,band=0.22)(p,f)),M);bm.free()
for (x,y,z,w,dd,rz) in [(0.9,-1.6,0.55,1.1,0.45,0.3),(-1.4,-0.9,0.85,0.9,0.4,-0.5),(1.9,-0.2,1.05,0.8,0.35,0.9),(-0.4,-1.9,0.25,1.2,0.5,0.1)]:   # ledges
  sb=facet_rock(260+int(x*10),flat=0.18,cuts=6);add_bm('headland',sb,rock_col(hx('#EADFCB'),hx('#C6B8A2'),7,band=0.3),Matrix.Translation((HL[0]+x,HL[1]+y,z))@Matrix.Rotation(rz,4,'Z')@Matrix.Diagonal((w,dd,0.35,1)));sb.free()
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
PC={'conch':'#A8642A','star':'#D9731A','coral':'#FF4A3A','float':'#4374BC','scallop':'#348A7C','badge':'#468F30'}   # r5e: a further step deeper (median toward 2.0)   # r5d: one step deeper vs the darker sage slab (floor 1.19)
_PC_R5C=None   # r5c: conch, starfish, coral knob, blue mussel, teal scallop, kelp leaf   # r5b: island-calibrated (acorn/strawberry/blueberry/leaf/shell value+saturation)   # r5: pastel natural (scallop = island teal band)
LDIR=Vector((-0.45,0.35,0.82)).normalized()   # r5c: island sprite key light (top-left), baked; pieces render unlit (matte, no specular)
def paint(c,n,hi=1.12,lo=0.62):   # r5d: clear light/dark sides (was 1.1/0.8)
  d=max(0.0,n.dot(LDIR));return c*(lo+(hi-lo)*d)+Vector((1,1,1))*0.06*max(0,d-0.85)/0.15
def shade(c,hi=1.12,lo=0.7):
  return lambda p,f:c*(lo+(hi-lo)*max(0,f.normal.z*0.8+0.2))
def pshade(c):return lambda p,f:paint(c,f.normal)
S=0.42
# conch: ONE swept spiral mesh (no separate ring -> no interpenetration)
new('piece_conch');bm=bmesh.new();_BL=bm.verts.layers.int.new('band');rings=[];NR=11;NS=10
for i in range(NR+1):
  t=i/NR;z=t*S*1.45;r=S*0.62*(1-t)**0.85+0.02
  row=[]
  for j in range(NS):
    a=j/NS*6.283;bd=int(t*5.5)%2;rr=r*(1.15 if bd else 0.95)*(1+0.06*math.sin(a+t*9))   # r5e2: 5-6 bold whorl bands with real relief
    vv=bm.verts.new((math.cos(a)*rr,math.sin(a)*rr,z));vv[_BL]=bd;row.append(vv)
  rings.append(row)
for i in range(NR):
  for j in range(NS):k=(j+1)%NS;bm.faces.new((rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]))
bm.faces.new(list(reversed(rings[0])))
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
M=Matrix.Translation((0,0,S*0.42))@Matrix.Rotation(math.radians(70),4,'X')@Matrix.Translation((0,0,-S*0.55))
_BK={tuple(round(c,4) for c in (M@v.co)):v[_BL] for v in bm.verts}
add_bm('piece_conch',bm,lambda p,f:paint(mix(hx(PC['conch']),hx('#F8E2C0'),0.8) if _BK.get(tuple(round(c,4) for c in p),0) else hx(PC['conch'])*0.86,f.normal),M);bm.free()   # r5e2: light/dark value step per band
# star
new('piece_star');bm=bmesh.new();vs=[]
for i in range(10):
  pass
NSTAR=30
for i in range(NSTAR):   # r5: puffy rounded arms (smooth 5-lobe radius)
  a=i/NSTAR*6.283+math.pi/2;r=S*(0.56+0.40*(0.5+0.5*math.cos(5*(a-math.pi/2)))**1.6);vs.append(bm.verts.new((math.cos(a)*r,math.sin(a)*r,0.0)))
top=[bm.verts.new((v.co.x*0.8,v.co.y*0.8,S*0.3)) for v in vs];c=bm.verts.new((0,0,S*0.46))
for i in range(NSTAR):
  j=(i+1)%NSTAR;bm.faces.new((vs[i],vs[j],top[j],top[i]));bm.faces.new((top[i],top[j],c))
bm.faces.new(list(reversed(vs)));bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
add_bm('piece_star',bm,pshade(hx(PC['star'])));bm.free()
for i in range(5):   # r5e: raised dots along each arm (island-sprite detail)
  a=math.pi/2+i*2*math.pi/5
  for rr in (0.28,0.55):
    sb=ico(S*0.085,1)
    for v in sb.verts:v.co.z*=0.6
    add_bm('piece_star',sb,lambda p,f:paint(hx('#F7C070'),f.normal),Matrix.Translation((math.cos(a)*rr*S,math.sin(a)*rr*S,S*(0.46-0.16*rr/0.77)-0.004)));sb.free()
# coral: trunk + 3 branches merged, dark base
new('piece_coral')   # r5c: rounded knob coral, matte (replaces trunk+rim)
for (x,y,z,r) in [(0,0,0.45,0.46),(0.38,0.12,0.36,0.34),(-0.36,0.16,0.38,0.34),(0.05,-0.38,0.34,0.34),(0.1,0.3,0.74,0.3),(-0.15,-0.1,0.82,0.28)]:
  bm=ico(S*r,2);add_bm('piece_coral',bm,lambda p,f:paint(mix(hx(PC['coral']),hx('#FFE0CC'),0.85) if noise.noise(p*11)>0.22 else hx(PC['coral']),f.normal),Matrix.Translation((x*S,y*S,z*S)));bm.free()
# r5c: blue mussel (replaces the glossy glass float): elongated rounded shell, matte
new('piece_float');bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=10,radius=1)
_BL=bm.verts.layers.int.new('band')
for v in bm.verts:
  x,y,z=v.co;t=(y+1)/2;w=0.46+0.36*math.sin(math.pi*min(1,t*1.15))**0.7;bd=int(round(math.acos(max(-1,min(1,z)))/(math.pi/10)))%2;v[_BL]=bd;k_=1.1 if bd else 0.94   # r5e2: bold concentric growth bands (relief + value step)
  v.co=Vector((x*S*w*1.1*k_,y*S*0.82*k_,max(z,-0.25)*S*0.42))
_MF=Matrix.Translation((0,0,S*0.22))@Matrix.Rotation(0.6,4,'Z');_BK={tuple(round(c,4) for c in (_MF@v.co)):v[_BL] for v in bm.verts}
add_bm('piece_float',bm,lambda p,f:paint(mix(hx(PC['float']),hx('#C4DBF6'),0.72) if _BK.get(tuple(round(c,4) for c in p),0) else mix(hx(PC['float']),hx('#152B5C'),0.66),f.normal),_MF);bm.free()
# scallop: ribbed fan, solid
new('piece_scallop');bm=bmesh.new();N=6;RIB={}   # r5e: upright ribbed fan (island shell aspect), leaning back 40 deg, hinge on the slab
LEAN=math.radians(45);R_=S*1.32;T_=S*0.08
def _lean(x,y,z):return (x,y*math.cos(LEAN)+z*math.sin(LEAN),-y*math.sin(LEAN)+z*math.cos(LEAN))
hf=bm.verts.new(_lean(0,-T_,0.03));hb=bm.verts.new(_lean(0,T_,0.03));fr=[];bk=[]
for i in range(N+1):
  a=math.pi*0.3+math.pi*0.4*i/N;x,z=math.cos(a)*R_,0.03+math.sin(a)*R_;rib=(i%2)
  v1=bm.verts.new(_lean(x,-T_-(S*0.05 if rib else 0),z));v2=bm.verts.new(_lean(x,T_,z));fr.append(v1);bk.append(v2)
for i in range(N):
  f=bm.faces.new((hf,fr[i+1],fr[i]));RIB[f.index if False else id(f)]=0
  bm.faces.new((hb,bk[i],bk[i+1]));bm.faces.new((fr[i],fr[i+1],bk[i+1],bk[i]))
bm.faces.new((hf,fr[0],bk[0],hb));bm.faces.new((hf,hb,bk[N],fr[N]));bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
def _scol(p,f):
  # rib shading: angle around the hinge in the un-leaned fan plane
  q=_FC;y=q.y*math.cos(LEAN)-q.z*math.sin(LEAN);zq=q.y*math.sin(LEAN)+q.z*math.cos(LEAN);k=(math.atan2(zq-0.03,q.x)-math.pi*0.3)/(math.pi*0.4/N)
  z=p.y*math.sin(LEAN)+p.z*math.cos(LEAN)
  c=hx(PC['scallop'])*(1.25 if int(math.floor(k))%2 else 0.7)
  if math.hypot(p.x,z-0.03)>R_*0.9:c=mix(c,hx('#BDEBDF'),0.35)
  return paint(c,f.normal)
add_bm('piece_scallop',bm,_scol);bm.free()
sb=ico(1.0,1);add_bm('piece_scallop',sb,lambda p,f:paint(hx(PC['scallop'])*0.95,f.normal),Matrix.Translation((0,0.04,0.03))@Matrix.Diagonal((R_*0.46,S*0.24,0.035,1)));sb.free()   # r5e: rounded hinge (solid foot on the slab)
# lighthouse badge: thick disc + white tower + lamp
new('piece_badge');bm=bmesh.new();NL=9;top=[];bot=[]   # r5c: kelp leaf (replaces lantern-on-disc)
for i in range(NL+1):
  t=i/NL;y=-S*0.85+S*1.7*t;w=S*0.62*math.sin(math.pi*t)**0.6;zc=S*(0.12+0.12*math.sin(math.pi*t))
  top.append((bm.verts.new((-w,y,zc*0.7)),bm.verts.new((0,y,zc+S*0.05)),bm.verts.new((w,y,zc*0.7))))
  bot.append((bm.verts.new((-w*0.95,y,zc*0.7-S*0.06)),bm.verts.new((0,y,zc-S*0.04)),bm.verts.new((w*0.95,y,zc*0.7-S*0.06))))
for i in range(NL):
  a,b=top[i],top[i+1];c_,d=bot[i],bot[i+1]
  for j in range(2):
    bm.faces.new((a[j],a[j+1],b[j+1],b[j]));bm.faces.new((c_[j],d[j],d[j+1],c_[j+1]))
  bm.faces.new((a[0],b[0],d[0],c_[0]));bm.faces.new((a[2],c_[2],d[2],b[2]))
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
def _leafz(x,y):
  t=(y+S*0.85)/(S*1.7);w=max(1e-4,S*0.62*math.sin(math.pi*max(0,min(1,t)))**0.6);zc=S*(0.12+0.12*math.sin(math.pi*max(0,min(1,t))));u=min(1,abs(x)/w);return (zc+S*0.05)*(1-u)+zc*0.7*u
for k_ in range(4):   # r5e: side veins (raised thin strips), 4 per side
  for sg in (-1,1):
    y0=-S*0.5+k_*S*0.32;x1=sg*S*0.36*math.sin(math.pi*(k_+1)/5.2);y1=y0+S*0.3;sb=bmesh.new();vv=[]
    for (x,y,o) in [(0,y0,-1),(0,y0,1),(x1,y1,1),(x1,y1,-1)]:vv.append(sb.verts.new((x,y+o*S*0.018,_leafz(x,y)+0.006)))
    sb.faces.new(vv if sg>0 else vv[::-1])
    for t_ in sb.faces:pass
    add_bm('piece_badge',sb,lambda p,f:paint(hx('#A9D46A'),Vector((0,0,1))),Matrix.Rotation(0.5,4,'Z'));sb.free()
add_bm('piece_badge',bm,lambda p,f:paint(mix(hx(PC['badge']),hx('#A9D46A'),0.7) if abs(p.x)<S*0.035 else hx(PC['badge']),f.normal),Matrix.Rotation(0.5,4,'Z'));bm.free()
FSC={'conch':1.25,'star':0.89,'coral':1.18,'float':0.92,'scallop':1.06,'badge':1.29}   # r5f: per-type footprint -> island median 0.84 of cell
ZK={'conch':1.05,'star':1.5,'coral':1.1,'float':1.5,'scallop':1.0,'badge':1.7}   # r5d: chunky upright volume (visible sides from the board camera)
for k in PC:
  m=MESH['piece_'+k];m['tris']=[tuple(Vector((v.x,v.y,v.z*ZK[k])) for v in t) for t in m['tris']]
for k in PC:bake_ao('piece_'+k,rays=8,dist=0.15,strength=0.22)
# contact shadow disc (baked, shared) — pieces get real side light, slabs do NOT receive scene shadows (palm-shadow mask, R5)
new('contact',alpha=0.42,unlit=True);bm=bmesh.new();bmesh.ops.create_circle(bm,cap_ends=True,segments=14,radius=0.36)
add_bm('contact',bm,lambda p,f:hx('#7A6652'));bm.free()
# ===== 7. beacon: sea-glass pebbles (instanced 16 in the cracks), crack light line, preview anemone =====
new('seaglass',emit=True);bm=ico(0.07,1)
for v in bm.verts:v.co.z*=0.7
add_bm('seaglass',bm,lambda p,f:hx('#FFF27A'));bm.free()
new('beacon_line',emit=True,alpha=0.9,unlit=True)
for (dx,dy,sx,sy) in [(0,0.5,0.5,0.025),(0,-0.5,0.5,0.025),(0.5,0,0.025,0.5),(-0.5,0,0.025,0.5)]:
  bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=6,radius1=0.022,radius2=0.022,depth=0.92)   # r5b: rounded band (island lighthouse lamp bands)
  add_bm('beacon_line',bm,lambda p,f:mix(hx('#FFD866'),hx('#FFF4C8'),max(0,f.normal.z)),Matrix.Translation((dx,dy,0.07))@(Matrix.Rotation(1.5708,4,'Y') if sx>sy else Matrix.Rotation(1.5708,4,'X')));bm.free()
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
new('arrival_steps');random.seed(77)
# r4c: island v2.x stone = palette band 'trim' (door threshold, jambs, lintel: make_palette.py #a38c66 -> #d4bb8e -> #e8d5a8),
# one flat gradient sample per block (island palette-UV treatment), slight bevels, a few chipped corners
TRIM=[hx('#a38c66'),hx('#d4bb8e'),hx('#e8d5a8')]
def trim(u):
  u=max(0.0,min(1.0,u));return mix(TRIM[0],TRIM[1],u/0.5) if u<0.5 else mix(TRIM[1],TRIM[2],(u-0.5)/0.5)
CHIP={(0,0),(1,2),(2,1),(0,2)}
for k in range(3):   # 3 steps, rise 0.2, tread 0.4: S0 (y -12.1, z .6) -> S1 (y -10.9, z 0)
  top=0.6-0.2*(k+1)+0.2;y0=-12.1+0.4*k
  for j,(x0,w) in enumerate([(-0.92,0.72),(0.0,0.8),(0.9,0.74)]):
    sb=bmesh.new();bmesh.ops.create_cube(sb,size=1)
    if (k,j) in CHIP:   # knock off one top corner (chipped / broken stone)
      cx,cy=random.choice([(-1,1),(1,1),(-1,-1),(1,-1)]);n=Vector((cx,cy,1.3)).normalized()
      bmesh.ops.bisect_plane(sb,geom=sb.verts[:]+sb.edges[:]+sb.faces[:],plane_co=Vector((cx*0.5,cy*0.5,0.5))-n*0.30,plane_no=n,clear_outer=True)
      bmesh.ops.holes_fill(sb,edges=[e for e in sb.edges if e.is_boundary],sides=0)
    bmesh.ops.bevel(sb,geom=[e for e in sb.edges],offset=0.09,segments=3,affect='EDGES')   # r5b: rounder
    for v in sb.verts:v.co+=Vector((0.02*noise.noise(Vector((v.co.x*2+k*3,v.co.y*2+j,2))),0.015*noise.noise(Vector((v.co.y*2+j,k,4))),0.01*noise.noise(Vector((v.co.x*3+k,v.co.y*3+j,1)))))
    hh=top+0.06+0.03*random.uniform(-1,1)
    M=Matrix.Translation((x0+0.03*math.sin(k*3+j),y0+0.2-0.03,top-hh/2+0.01*random.uniform(-1,1)))@Matrix.Rotation(random.uniform(-0.08,0.08),4,'Z')@Matrix.Diagonal((w,0.48,hh,1))
    ub=random.uniform(0.42,0.62)
    zb=top-hh+0.0;RIS=hx('#d6b882')   # r5b: lighter warm riser (bar: risers vs sand >= 1.3)
    def sc_(p,f,ub=ub,zb=zb,RIS=RIS):   # r4d: value separation from the sand
      n=f.normal;ax=max(abs(n.x),abs(n.y),abs(n.z))
      if ax<0.93 and n.z<0.75 and n.z>-0.5 and abs(n.z)>0.12:return trim(0.0)*0.8     # broken chip face (oblique cut): dark
      if n.z>0.8:return trim(ub+0.18)                                                 # light worn top
      if n.z>0.3:return mix(trim(1.0),hx('#FFF6E0'),0.4)                              # crisp light bevel highlight
      if n.z>-0.5:
        ao=max(0.0,min(1.0,(p.z-zb)/0.14))
        return RIS*(0.86+0.14*ao)*(0.95+0.1*((k*3+j)%3)/2)                            # dark riser + baked AO at its foot
      return trim(0.0)*0.5
    add_bm('arrival_steps',sb,sc_,M);sb.free()
bake_ao('arrival_steps',rays=8,dist=0.3,strength=0.4)
STEP_DRIFT=[(x,-10.86) for x in (-1.05,-0.25,0.55,1.2)]+[(sx*1.36,y) for sx in (-1,1) for y in (-11.85,-11.35)]
bake_glb(ART+'env_cloud_01.glb','reuse_cloud')
for _k in range(3):   # r5: island rocks (rounded, soft, pale grey) + warm sand-tinted copy; reuse, not new triangles
  bake_glb(ART+'env_prop_rock_%02d.glb'%(_k+1),'reuse_rock_%d'%_k)
  _m=MESH['reuse_rock_%d'%_k];zs=[p.z for t in _m['tris'] for p in t];xs=[abs(p.x) for t in _m['tris'] for p in t]+[abs(p.y) for t in _m['tris'] for p in t];_s=1.0/max(xs);_z0=min(zs)
  _m['tris']=[tuple(Vector((p.x*_s,p.y*_s,(p.z-_z0)*_s-0.1)) for p in t) for t in _m['tris']]
  MESH['reuse_rock_s%d'%_k]=dict(_m);MESH['reuse_rock_s%d'%_k]['cols']=[tuple(mix(Vector(c[:3]),hx('#E9D7B0'),0.38) for c in cs) for cs in _m['cols']]
bake_glb(ART+'env_prop_hydrangea_bush_01.glb','reuse_bush')
bake_glb(ART+'env_prop_flowers_01.glb','reuse_flowers');bake_glb(ART+'env_prop_grass_tuft_01.glb','reuse_grass_a');bake_glb(ART+'env_prop_grass_tuft_02.glb','reuse_grass_b')
for _n in ['grass_0','grass_1','grass_2','flowers','barnacles','moss']:MESH.pop(_n,None)          # replaced by the island's own flora (reuse)
new('blob',alpha=0.42,unlit=True);_bc=hx('#4A3626')
for _i in range(12):      # radial gradient: centre alpha 1 -> 0.45 at r .45 -> 0 at r 1 (no ring edge)
  a0,a1=_i/12*6.2832,(_i+1)/12*6.2832;c0,c1=Vector((math.cos(a0),math.sin(a0),0)),Vector((math.cos(a1),math.sin(a1),0))
  for (r0,r1,al0,al1) in [(0,0.45,1.0,0.45),(0.45,1.0,0.45,0.0)]:
    q=[c0*r0,c0*r1,c1*r1,c1*r0];al=[al0,al1,al1,al0]
    for t in ([0,1,2],[0,2,3]):
      if r0==0 and t==[0,2,3]:continue
      MESH['blob']['tris'].append(tuple(q[i].copy() for i in t));MESH['blob']['cols'].append(tuple((_bc.x,_bc.y,_bc.z,al[i]) for i in t))
def base_ao(name,h=0.1,k=0.5):     # island-style ground darkening at the foot of props/pieces (as the island palette's dark base band)
  m=MESH[name];zs=[p.z for t in m['tris'] for p in t];z0=min(zs);out=[]
  for t,cs in zip(m['tris'],m['cols']):out.append([Vector(c[:3])*(1-k*max(0,1-(p.z-z0)/h)) for p,c in zip(t,cs)])
  m['cols']=out
for _n in ['dinghy','crabtrap','rope_coil','ebb_bell','net_poles','driftwood','hermit','crab']:base_ao(_n,h=0.12 if _n.startswith('piece') else 0.15)
_m=MESH['reuse_cloud'];_nc=[]
for t in _m['tris']:
  n=(t[1]-t[0]).cross(t[2]-t[0]);n=n.normalized() if n.length>1e-9 else Vector((0,0,1))
  c=mix(hx('#CFE3F7'),hx('#FFFFFF'),min(1,max(0,0.55+0.6*n.z)));_nc.append((c,c,c))
_m['cols']=_nc
new('fisher_hut')   # r5c: small fisher's hut, island bands: shingle roof, slate walls, wood door/trim
sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);bmesh.ops.bevel(sb,geom=sb.edges[:],offset=0.08,segments=2,affect='EDGES')
add_bm('fisher_hut',sb,lambda p,f:mix(hx('#98B8D2'),hx('#BCD4E6'),0.5+0.5*f.normal.z),Matrix.Translation((0,0,0.5))@Matrix.Diagonal((1.3,1.0,1.0,1)));sb.free()
for sgn in (-1,1):
  sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);bmesh.ops.bevel(sb,geom=sb.edges[:],offset=0.12,segments=2,affect='EDGES')
  add_bm('fisher_hut',sb,lambda p,f:mix(hx('#D98E4E'),hx('#EFB070'),max(0,f.normal.z)),Matrix.Translation((0,sgn*0.33,1.17))@Matrix.Rotation(-sgn*0.62,4,'X')@Matrix.Diagonal((1.55,0.86,0.1,1)));sb.free()
sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);add_bm('fisher_hut',sb,lambda p,f:mix(hx('#98B8D2'),hx('#BCD4E6'),0.5+0.5*f.normal.z),Matrix.Translation((0,0,1.0))@Matrix.Rotation(math.pi/4,4,'X')@Matrix.Diagonal((1.28,0.54,0.54,1)));sb.free()   # r5d: gable fill under the roof
sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);add_bm('fisher_hut',sb,lambda p,f:hx('#a3723d'),Matrix.Translation((0.25,-0.505,0.36))@Matrix.Diagonal((0.36,0.03,0.66,1)));sb.free()
sb=bmesh.new();bmesh.ops.create_cube(sb,size=1);add_bm('fisher_hut',sb,lambda p,f:hx('#fff3c6'),Matrix.Translation((-0.32,-0.505,0.6))@Matrix.Diagonal((0.26,0.03,0.24,1)));sb.free()
bake_ao('fisher_hut',rays=8,dist=0.5,strength=0.35)
new('grasspatch');bm=bmesh.new();A=18;cen=bm.verts.new((0,0,0.07));ring=[];mid=[]   # r5c: low dune-grass ground cover (island grass band)
for i in range(A):
  a=i/A*6.283;r=1+0.22*noise.noise(Vector((math.cos(a)*1.7,math.sin(a)*1.7,21)));ring.append(bm.verts.new((math.cos(a)*r,math.sin(a)*r,-0.03)));mid.append(bm.verts.new((math.cos(a)*r*0.62,math.sin(a)*r*0.62,0.05)))
for i in range(A):j=(i+1)%A;bm.faces.new((cen,mid[i],mid[j]));bm.faces.new((mid[i],ring[i],ring[j],mid[j]))
add_bm('grasspatch',bm,lambda p,f:mix(hx('#4f9a3a'),hx('#8fbf4a'),0.5+0.5*noise.noise(p*2.3)));bm.free()
new('buoy');cone_at('buoy',0.16,0.12,0.5,10,lambda p,f:(hx('#E3AE80') if p.z<0.32 else hx('#fbf8ec')) if p.z<0.42 else hx('#E3AE80'),Matrix.Translation((0,0,0.25)))   # r5e2: buoy body toned to the island roof family (rendered S was 0.87)
cone_at('buoy',0.05,0.05,0.18,6,lambda p,f:hx('#ffcf78'),Matrix.Translation((0,0,0.59)))
# ---------- layout (Blender Z-up coordinates, metres; board centre = origin) ----------
random.seed(77);L=[]
def put(m,x,y,z=0,rz=0,s=1.0,**kw):d=dict(mesh=m,p=[x,y,z],rz=rz,s=s);d.update(kw);L.append(d)
put('terrain',0,0);put('headland',0,0);put('foam',0,0,anim='foam');put('foam_inner',0,0,anim='foam2');put('reef_base',0,0,receive_shadow=False)
SL=[]
for r in range(7):
  for c in range(7):
    x=(c-3)*1.0;y=(3-r)*1.0;z=random.uniform(-0.03,0.03)       # cell centres stay regular
    v=random.choice([4,5]) if r==0 or (r==1 and random.random()<0.4) else random.randrange(4)
    _j=(random.uniform(-.02,.02),random.uniform(-.02,.02));z=0.0;put('slab_%d'%v,x,y,z,int(random.random()*4)*1.5708,board_cell=[r,c],receive_shadow=False,tilt=[0*random.uniform(-2.2,2.2),0*random.uniform(-2.2,2.2)]);SL.append((r,c,x,y,z))   # r5c: tidy grid
for r in range(8):                                             # weed tufts in the seams (cell corners)
  for c in range(8):
    if random.random()<0.62 and False:put('weed',(c-3.5)+random.uniform(-.06,.06),(3.5-r)+random.uniform(-.06,.06),0.05,random.random()*6.28,random.uniform(0.9,1.4),receive_shadow=False)
# rim rocks: far fewer, non-slab colours (cool grey / pale sand-white), so the shelf outline reads at a glance
for i in range(22):
  a=i/22*6.283+random.uniform(-.06,.06);rr=4.1+0.4*abs(noise.noise(Vector((a*2,1,1))));x=math.cos(a)*rr*1.02;y=math.sin(a)*rr
  x=max(-4.35,min(4.35,x)) if abs(y)<3.6 else x;y=max(-4.3,min(4.35,y)) if abs(x)<3.6 else y
  s_=random.uniform(0.28,0.5)
  if y<-3.4 and abs(x)<0.9:continue   # arrival gap (E)
  if y<-3.6 and 1.2<abs(x)<5.0:continue   # front edge belongs to the two clusters
  random.randrange(6);random.random()   # r5c: rim rocks removed (rounded tray rim instead)
# beacon (current = row 2 col 4) + previews
BR,BC=2,4;bx,by=(BC-3)*1.0,(3-BR)*1.0
for i in range(16):
  t=i/16*4;side=int(t);f=t-side;q=[(-.5+f,.5),(.5,.5-f),(.5-f,-.5),(-.5,-.5+f)][side]
  put('seaglass',bx+q[0]*1.0,by+q[1]*1.0,0.07,random.random()*6,1.0,anim='beacon',k=i)
put('beacon_line',bx,by,0,anim='beacon_line')
for k,(r,c) in enumerate([]):put('anemone',(c-3)+0.38,(3-r)+0.38,SLAB_TOP-0.025,0,1.0+0.2*(k==0),anim='anemone',k=k)
# pieces + contact discs
KINDS=list(PC);random.seed(41);LAY=[[None]*7 for _ in range(7)]
for r in range(7):
  for c in range(7):
    opts=[k for k in KINDS if not (c>=2 and LAY[r][c-1]==k==LAY[r][c-2]) and not (r>=2 and LAY[r-1][c]==k==LAY[r-2][c])];LAY[r][c]=random.choice(opts)
for (r,c,x,y,z) in SL:
  zz=z+SLAB_TOP-0.05      # sits on the shell bed in the dry hollow
  _dy=0.2 if LAY[r][c]=='scallop' else 0.0   # r5e2: scallop shadow under the leaning shell body
  put('contact',x+0.05,y-0.04+_dy,zz+0.004,0,1.2,piece=True,receive_shadow=False);put('piece_'+LAY[r][c],x,y+0.03,zz,random.uniform(-.15,.15),1.24*FSC[LAY[r][c]],piece=True,cell=[r,c])   # r5c: island fill ratio (~0.75 cell), sits slightly high like the sprites
# props / animals
put('arrival_steps',0,0,0);put('board_rim',0,0,0,receive_shadow=True)
for (dx_,dy_) in STEP_DRIFT:put('drift',dx_,dy_,ground_z(dx_,dy_)-0.005,(dx_*3.1+dy_)%6.28,0.55)   # r4d: sand drift against the step base
FL=['reuse_grass_a','reuse_grass_b','reuse_grass_a','reuse_flowers']
_TV=[];_TP=[]
for _t in MESH['terrain']['tris']:_b=len(_TV);_TV+=list(_t);_TP.append((_b,_b+1,_b+2))
_TB=BVHTree.FromPolygons(_TV,_TP,epsilon=0.0)
def gzt(x,y):   # height of the actual (triangulated) terrain mesh, not the analytic ground_z -> no float/sink on coarse cells
  h=_TB.ray_cast(Vector((x,y,30)),Vector((0,0,-1)),80);return h[0].z if h[0] is not None else ground_z(x,y)
def flora(x,y,s=1.0):put(random.choice(FL),x,y,gzt(x,y)-0.04,random.random()*6.28,s*random.uniform(0.85,1.15),reuse=True)
def blob(x,y,s):put('blob',x,y,gzt(x,y)+0.012,0,s*0.6,receive_shadow=False)
# gull rocks (her LEFT, >=2.0 m off her line): faceted stratified cluster instead of one blob
for (x,y,sc,rz,k) in [(-2.5,-11.0,0.85,0.8,0),(-3.1,-10.5,0.6,2.1,1),(-2.2,-11.7,0.5,4.0,2)]:put('boulder_%d'%k,x,y,ground_z(x,y)-0.2*sc,rz,sc)
put('gull',-2.5,-11.0,ground_z(-2.5,-11.0)+0.52,2.6,1.0,anim='gull_perch')
# r3: land wraps the board — low faceted cliffs / outcrops with grass caps + dune grass banks, left and right
random.seed(901)
for side in (-1,1):
  for i,(y,sc) in enumerate([(-6.5,1.5),(-4.2,1.9),(-1.8,2.2),(0.8,1.8),(3.0,1.4)]):
    x=side*(5.45+0.35*math.sin(i*1.7))+random.uniform(-.3,.3);zz=ground_z(x,y)-0.25*sc
    _r=(random.random(),random.uniform(-.15,.15),random.random())
    pass
    put('boulder_%d'%((i+(side>0))%3),x,y,zz,_r[0]*6.28,sc,cast_shadow=True)
    put('grasscap',x+_r[1],y,zz+0.5*sc*0.62,_r[2]*6.28,sc*0.42)
    for g in range(2):
      gx=x+side*random.uniform(0.6,1.5);gy=y+random.uniform(-0.7,0.7);flora(gx,gy)
# r4: props regrouped into 3 clusters with a lead piece + supports, clean sand between, island-scale flora (reuse)
FL=['reuse_grass_a','reuse_grass_b','reuse_grass_a','reuse_flowers']
def flora(x,y,s=1.0):put(random.choice(FL),x,y,gzt(x,y)-0.04,random.random()*6.28,s*random.uniform(0.85,1.15),reuse=True)
def blob(x,y,s):put('blob',x,y,gzt(x,y)+0.012,0,s*0.6,receive_shadow=False)
random.seed(404)
# A  fisher's corner (bottom-left, sits ON the board's bottom edge -> foreground overlap): lead = upturned dinghy
def gp(n,x,y,rz=0,sc=1.0,dz=0.0,**kw):put(n,x,y,gzt(x,y)+dz,rz,sc,**kw)
gp('dinghy',-8.4,-6.6,0.75,1.0,dz=-0.06,cast_shadow=True);blob(-8.4,-6.6,1.25)   # r4d: no clean in-frame spot -> moved fully out of frame (left dunes); net poles + crab trap lead the fisher's corner   # r4c: lengthwise toward camera, fully in frame
gp('net_poles',-4.2,-5.5,1.3,1.0,cast_shadow=True);gp('net',-4.2,-5.5,1.3,1.0,cast_shadow=True);blob(-4.45,-6.38,0.18);blob(-3.96,-4.62,0.18)
gp('crabtrap',-1.6,-4.70,0.35,1.0,cast_shadow=True);gp('crabtrap_mesh',-1.6,-4.70,0.35,1.0);blob(-1.6,-4.70,0.45)
gp('rope_coil',-2.35,-5.6,0,1.0);blob(-2.35,-5.6,0.3)
for (x,y,sc,k) in [(-4.75,-3.90,0.55,4),(-5.15,-3.30,0.36,1),(-1.55,-4.00,0.3,0)]:put('rock_%d'%k,x,y,ground_z(x,y)-0.22*sc,random.random()*6.28,sc,cast_shadow=True);blob(x,y,sc*0.95)
for (x,y) in [(-4.3,-4.50),(-2.3,-3.80),(-4.1,-3.30),(-1.3,-5.15),(-3.55,-4.95)]:flora(x,y)
# B  tide pool (bottom-right): lead = rock pool with anemones; supports = 2 starfish, pale rocks, shells, driftwood
gp('sidepool',2.95,-4.40,0.4,0.72)
for a_ in range(3):put('anemone',2.95+0.32*math.cos(a_*2.1),-4.40+0.22*math.sin(a_*2.1),ground_z(2.95,-4.40)+0.01,0,0.9,anim='anemone',k=a_)
for (x,y,sc,k) in [(4.15,-4.00,0.62,2),(1.85,-4.10,0.4,4),(3.6,-5.15,0.3,0)]:put('rock_%d'%k,x,y,ground_z(x,y)-0.22*sc,random.random()*6.28,sc,cast_shadow=True);blob(x,y,sc*0.95)
for (x,y,rz) in [(2.35,-4.95,0.4),(3.6,-3.75,1.9)]:put('starfish_deco',x,y,ground_z(x,y)+0.005,rz,1.0)
gp('shells_scatter',3.05,-5.25,0.7,0.8);gp('driftwood',4.2,-5.3,1.57,1.0);blob(4.2,-5.3,0.4)
for (x,y) in [(4.75,-4.55),(1.6,-4.85),(4.45,-3.50),(2.5,-3.70)]:flora(x,y)
# B2 bottom corners: boulder + grass masses overlapping the frame edge (all >=1.5 m off her line)
for (x,y,sc,k) in [(-3.95,-7.45,1.15,0),(-2.15,-7.4,0.8,2),(-4.5,-7.7,1.1,1),(-1.75,-8.6,0.6,1),(3.4,-6.5,1.2,1),(2.15,-7.5,0.78,0),(4.4,-7.6,1.1,2),(1.8,-8.7,0.6,2)]:
  put('boulder_%d'%k,x,y,ground_z(x,y)-0.25*sc,random.random()*6.28,sc,cast_shadow=True)
for (x,y) in [(-2.05,-6.45),(-1.45,-7.0),(-3.1,-8.2),(-4.6,-6.2),(-2.6,-8.6),(-1.3,-7.9),(2.6,-6.2),(1.45,-7.0),(3.1,-8.3),(4.6,-6.1),(2.6,-8.6),(1.36,-7.9),(-5.2,-7.0),(5.2,-6.9),(-3.8,-7.4),(3.7,-7.3)]:flora(x,y,1.3)   # r5h: (1.3,-7.9) -> (1.36,-7.9): reuse_grass_b 0.59 m tall is a solid; >=1.02 m from the S7 walk line x=0
# C  gull rocks at the arrival (her LEFT): dune grass + flowers around the stratified cluster
for (x,y) in [(-3.4,-11.6),(-2.0,-10.3),(-3.5,-10.0),(-1.95,-11.5)]:flora(x,y)
for (x,y,sc) in [(-2.5,-11.0,0.85),(-3.1,-10.5,0.6),(-2.2,-11.7,0.5)]:blob(x,y,sc*0.9)
put('shells_scatter',2.6,-11.2,ground_z(2.6,-11.2),0.3,0.8)
for (x,y,rz) in [(2.4,-12.4,0.4),(3.4,-10.6,1.3),(-2.6,-12.6,2.2),(3.9,-12.0,0.9),(-3.9,-11.9,1.7)]:gp('shells_scatter',x,y,rz,0.7)   # r5b: small stones break up the foreground

put('ebb_bell',4.55,-3.15,0.0,0.3,1.0,anim='bell')
put('hermit',-5.4,1.5,ground_z(-5.4,1.5),0.5,1.0,anim='hermit')
put('crab',-4.9,-2.3,ground_z(-4.9,-2.3),0.7,1.0,anim='crab')
put('gull',3.9,4.25,0.36,-0.6,1.0,anim='gull_perch')
put('gull',-3.0,12.0,4.5,0.9,1.0,anim='gull_fly',k=0);put('gull',2.5,14.0,5.5,1.2,0.9,anim='gull_fly',k=1)
put('bottle',-3.5,SHORE+6.0,-0.02,0.4,1.0,anim='bottle')
put('beacon_post',HL[0]+0.2,HL[1]+0.3,HTOP,0.6,1.0,cast_shadow=True);put('beacon_lamp',HL[0]+0.2,HL[1]+0.3,HTOP,0.6,1.0,anim='lamp')
HUTS=[(8.4,2.5,-0.8)]   # r5e2: runtime (7.3,-0.6): on the arrival view's centre line, outside the game frustum for dist 18-24 on all 3 aspects   # r5e: fully outside the game frame (roof peeked at 8.3)   # r5e: ONE hero hut for the arrival view, outside the game frame (game-view corners cleared)
_HUTS_R5D=[(-3.1,-6.7,0.5),(3.1,-6.7,-0.45)]   # r5d: further into the game view   # r5c accents: bottom corners of the game view; the right one also sits in the arrival view
L[:]=[d for d in L if not (d['mesh'].startswith(('reuse_grass','reuse_flowers','blob','boulder_','reuse_rock','shells_scatter','drift')) and any(math.hypot(d['p'][0]-hx_,d['p'][1]-hy_)<1.6 for hx_,hy_,_ in HUTS))]
# r5e: clean arrival foreground — drop the big left rock group (+ its perched gull, flowers, shells) left of the steps
L[:]=[d for d in L if not (d['mesh'].startswith(('reuse_rock','reuse_flowers','shells_scatter','gull','reuse_grass')) and d['p'][0]<-1.5 and -13.0<d['p'][1]<-9.4 and d.get('anim')!='gull_fly')]
_GR=random.Random(77)
for (x,y,sc) in [(-4.3,-6.9,1.15),(4.35,-6.7,1.1),(-2.2,-8.3,0.9),(2.2,-8.4,0.9),(-3.0,-9.9,1.0),(2.9,-10.6,0.85),(-4.6,-4.6,0.7),(4.7,-4.4,0.7)]:
  _r=_GR.random()*6.28
  if any(math.hypot(x-hx_,y-hy_)<1.9 for hx_,hy_,_ in HUTS) or (x<-1.5 and -13<y<-9.4):continue   # r5e: no patch under the hut (sand-mound caveat) / clean arrival fg
  put('grasspatch',x,y,gzt(x,y)-0.01,_r,sc,receive_shadow=True)
for (hx_,hy_,hr) in HUTS:
  gp('fisher_hut',hx_,hy_,hr,1.5,dz=-0.05,cast_shadow=True);blob(hx_,hy_,1.9)   # r5e: hero scale
  put('reuse_bush',hx_+1.0,hy_-0.75,gzt(hx_+1.0,hy_-0.75),1,0.7,reuse=True)   # r5e: one bush tucked behind-right
  gp('beacon_post',hx_-1.35,hy_+0.35,0.6,0.85,cast_shadow=True);gp('beacon_lamp',hx_-1.35,hy_+0.35,0.6,0.85,anim='lamp')   # r5e: hero = orange-roof blue hut + beacon
put('buoy',-1.6,SHORE+3.2,-0.08,0,1.4,anim='bell');put('buoy',2.4,SHORE+5.0,-0.08,0,1.4,anim='bell')
put('fisher_hut',HL[0]-0.9,HL[1]-0.6,HTOP-0.33,0.4,0.75,cast_shadow=True)   # r5c accent on the headland (bg_v3)
put('reuse_palm_tall',-6.4,SHORE-1.4,ground_z(-6.4,SHORE-1.4),0.4,1.0,reuse=True,cast_shadow=True)
put('reuse_palm_lean',6.6,SHORE-0.8,ground_z(6.6,SHORE-0.8),2.6,1.0,reuse=True,cast_shadow=True)
put('reuse_palm_tall',-8.5,-3.5,ground_z(-8.5,-3.5),1.2,0.85,reuse=True,cast_shadow=True)
put('reuse_bush',6.2,1.8,ground_z(6.2,1.8),0,1.0,reuse=True);put('reuse_bush',-6.3,-0.8,ground_z(-6.3,-0.8),1,0.9,reuse=True)
for k,(x,y,z,sc) in enumerate([(-30,150,1,0.9),(22,165,3,1.1),(60,145,0,0.8),(-78,160,2,1.0),(100,170,1,0.9)]):put('reuse_cloud',x,y,z,k*0.9,sc,reuse=True,anim='cloud',k=k)
# r5: procedural rock/boulder instances -> island rocks scaled down 20 %; boulders take the warm sand tint
for d in L:
  m_=d['mesh']
  if m_.startswith('rock_'):d['mesh']='reuse_rock_%d'%(int(m_[5:])%3);d['s']=round(d['s']*0.8,4);d['reuse']=True
  elif m_.startswith('boulder_'):d['mesh']='reuse_rock_s%d'%int(m_[8:]);d['s']=round(d['s']*0.8,4);d['reuse']=True
for _n in [n for n in MESH if n.startswith(('rock_','boulder_'))]:MESH.pop(_n)
# r5e: final clean-up of the arrival foreground (rock group + its contact blobs left of the steps, placed late)
L[:]=[d for d in L if not (d['mesh'].startswith(('reuse_rock','blob','reuse_flowers','shells_scatter')) and d['p'][0]<-1.5 and -13.0<d['p'][1]<-9.4)]
# r5e: tidy, intentional game-view foreground — two low island grass + flower clusters at the bottom corners (no crates/baskets)
for sg in (-1,1):
  for (x,y,m,sc) in [(3.3,-7.0,'reuse_grass_a',2.4),(2.45,-7.45,'reuse_grass_b',2.1),(4.1,-7.35,'reuse_grass_b',2.5),(2.9,-7.2,'reuse_flowers',1.6),(3.8,-6.8,'reuse_flowers',1.4),(3.5,-7.6,'reuse_grass_a',2.2),(4.4,-6.7,'reuse_grass_a',2.0)]:
    put(m,sg*x,y,gzt(sg*x,y),0.7*sg,sc,reuse=True)
# r5f: small arrival-foreground sand props (instances of existing island-style meshes: 0 new triangles), all at runtime z>=10.6 (outside every game framing)
for (m,x,y,rz,sc) in [('shells_scatter',-1.5,-11.4,0.3,0.8),('starfish_deco',-1.15,-12.05,1.1,1.0),('reuse_flowers',-2.05,-11.9,0.4,0.95),('drift',-1.75,-12.5,0.2,0.5),('reuse_rock_0',-2.25,-11.05,0.7,0.22),('shells_scatter',1.7,-11.6,1.9,0.6)]:
  put(m,x,y,gzt(x,y)+(0.0 if m!='drift' else -0.01),rz,sc,reuse=m.startswith('reuse_'))
SMOOTH=lambda n:n.startswith(('slab_','reuse_rock','piece_','headland','terrain','board_rim','fisher_hut'))
# r5: pastel lift for pieces (render tone mapping saturates; island pieces read soft)
pass   # r5b: pastel lift removed
# ---------- export: engine JSON (Y-up: x, z, -y) ----------
def conv(v):return [round(v.x,4),round(v.z,4),round(-v.y,4)]
out={}
for n,m in MESH.items():
  P=[];C=[];Nn=[];acc={}
  key=lambda p:(round(p.x,3),round(p.y,3),round(p.z,3))
  if SMOOTH(n):
    for t in m['tris']:
      nr=(t[1]-t[0]).cross(t[2]-t[0])
      for p in t:acc[key(p)]=acc.get(key(p),Vector((0,0,0)))+nr
  for t,cs in zip(m['tris'],m['cols']):
    nrm=(t[1]-t[0]).cross(t[2]-t[0])
    if nrm.length<1e-10:continue
    nrm.normalize()
    for p,c in zip(t,cs):
      vn=acc[key(p)].normalized() if SMOOTH(n) and acc[key(p)].length>1e-9 else nrm
      if SMOOTH(n) and vn.dot(nrm)<0.5:vn=nrm
      P+=conv(p);Nn+=conv(vn);cc=[max(0,min(255,int(round(x*255)))) for x in c[:3]];C+=cc+[int(m['alpha']*(c[3] if len(c)>3 else 1.0)*255)]
  out[n]=dict(positions=P,normals=Nn,colors=C,alpha=m['alpha'],emit=m['emit'],unlit=m['unlit'],reuse=m['reuse'],tris=len(P)//9)
json.dump(out,open(OUT+'/coast_meshes.json','w'))
PLACEMENT=dict(parent='island scene_root (frame of combined_anchors_m.json / combined_visual_m.glb)',position=[-0.6,-0.845,21.5],yaw_deg=180,scale=1,
  anchors_local=dict(ramp_start=[0,0.845,13.1],S0=[0,0.6,12.1],S1=[0,0,10.9],E=[0,0,4.9],stop=[0,0,5.15],board_centre=[0,0,0]),
  island_walk=dict(start='exit_point',via=['exit_path_06..17',[-0.7,0,7.4]],ramp_start_world=[-0.6,0,8.4]))
# r5i: runtime layout trimmed: positions 1 mm, rz 1e-4 rad (0.006 deg), scale 4 significant digits, other floats 4 dp; minified
def _rnd(v,k=None):
  if isinstance(v,dict):return {kk:_rnd(vv,kk) for kk,vv in v.items()}
  if isinstance(v,(list,tuple)):return [_rnd(x,k) for x in v]
  if isinstance(v,float):
    if k=='s':return float('%.4g'%v)
    r=round(v,4 if k=='rz' else 3 if k in('p','placement','anchors_local','position','shore','headland') else 4)
    return 0.0 if r==0 else r
  return v
_LAYF=_rnd(dict(layout=[dict(d,p=[d['p'][0],d['p'][2],-d['p'][1]]) for d in L],shore=SHORE,headland=[HL[0],-HL[1]],placement=PLACEMENT))
# r5j (GGbot): two outputs. coast_layout_full.json = every instance incl. piece_* (web preview, sprite export, aabb/walk/geom tools; committed as
# tools/coast-scene/data/coast_layout_full.json); coast_layout.json = runtime region_coast copy WITHOUT any piece:true entry (49 piece_* + 49 contact shadows; the 2D board draws its own shadows).
json.dump(_LAYF,open(OUT+'/coast_layout_full.json','w'),separators=(',',':'),ensure_ascii=False)
json.dump(dict(_LAYF,layout=[d for d in _LAYF['layout'] if not d.get('piece') and not d['mesh'].startswith('piece_')]),open(OUT+'/coast_layout.json','w'),separators=(',',':'),ensure_ascii=False)
stats={n:out[n]['tris'] for n in out};stats['_new_unique']=sum(v for n,v in stats.items() if not out[n]['reuse']);stats['_reuse']=sum(v for n,v in stats.items() if n in out and out[n]['reuse'])
json.dump(stats,open(OUT+'/stats.json','w'),indent=1);print('STATS',json.dumps(stats))
# ---------- export: glb per group for the Creator bundle (new meshes only) ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
groups={'coast_board':[n for n in out if n.startswith(('board_rim','slab_','reef_base','weed','contact','seaglass','beacon_line','anemone','tide_sheet'))],
 'coast_pieces':[n for n in out if n.startswith('piece_')],
 'coast_terrain':['terrain','arrival_steps','headland','beacon_post','beacon_lamp','drift','foam','foam_inner','sidepool'],
 'coast_props':['grasspatch','fisher_hut','buoy','blob','grasscap','net_poles','net','dinghy','crabtrap','crabtrap_mesh','rope_coil','shells_scatter','footprints','starfish_deco','driftwood','ebb_bell','hermit','crab','gull','bottle']}
for g,names in groups.items():
  for o in list(bpy.data.objects):bpy.data.objects.remove(o)
  for n in names:
    m=MESH[n];me=bpy.data.meshes.new(n);verts=[];faces=[]
    for t in m['tris']:b=len(verts);verts+=[tuple(p) for p in t];faces.append((b,b+1,b+2))
    me.from_pydata(verts,[],faces);ca=me.color_attributes.new('Col','BYTE_COLOR','CORNER')
    i=0
    for cs in m['cols']:
      for c in cs:ca.data[i].color=(c[0]**2.2,c[1]**2.2,c[2]**2.2,m['alpha']*(c[3] if len(c)>3 else 1.0));i+=1
    o=bpy.data.objects.new(n,me);bpy.context.scene.collection.objects.link(o)
  kw=dict(filepath=OUT+'/glb/%s.glb'%g,export_format='GLB',use_selection=False,export_normals=True,export_apply=True)
  for extra in ({'export_vertex_color':'ACTIVE'},{'export_colors':True},{}):
    try:bpy.ops.export_scene.gltf(**kw,**extra);break
    except TypeError:continue
print('DONE')
