"""full8 plan E assets: far_meadow_impostor.glb (<=800 tris) + sea_reef_cluster.glb (<=300 tris), vertex colours (COLOR_0).
blender -b --factory-startup -P build_assets.py -- <repo> <outdir>
Coordinates: authored in meadow-local game space (x, y up, z), y shifted so local y=0 is the sea line (SAIL_SEA_Y −0.91 = meadow root −1.35 + 0.44).
Runtime places the impostor at SEA_STANDIN (pos, ×0.7, yaw 180) — same yaw as the real meadow root, so the windmill faces the dock."""
import bpy,bmesh,sys,os,math,json,random
from mathutils import Vector
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:];REPO,OUT=a[0],a[1];os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
SEA=0.44   # meadow-local y of the sea line
def B(x,y,z):return Vector((x,-z,y))           # game local -> blender
bpy.ops.import_scene.gltf(filepath=REPO+'/creator-build-project/assets/bundles/region_meadow/env_meadow.glb')
obj={o.name.split('.')[0]:o for o in bpy.data.objects if o.type=='MESH'}
dg=bpy.context.evaluated_depsgraph_get()
def bvh(name):
  o=obj[name];bm=bmesh.new();bm.from_object(o.evaluated_get(dg),dg);bm.transform(o.matrix_world);t=BVHTree.FromBMesh(bm);return t,bm
terr,_=bvh('meadow_terrain')
def h(x,z):
  hit=terr.ray_cast(B(x,200,z),Vector((0,0,-1)))
  return hit[0].z if hit[0] else -10
# ---------- aerial perspective (baked): sky-horizon blue, saturated, haze stronger near the sea line
HAZE=Vector((0.40,0.66,0.94))   # clear horizon blue (TransitBackdrop sky, no grey)
SUN=Vector((0.45,0.80,0.40)).normalized()  # light from the south-east-ish, above (blender space)
def aerial(base,zc,nrm,k=0.50):
  f=k+0.16*max(0,1-(zc-SEA)/10)       # lower = hazier
  lit=0.88+0.22*max(0,nrm.dot(SUN))
  c=Vector(base)*lit
  return tuple(c.lerp(HAZE,min(0.8,f)))+(1,)
def finish(bm,name,colfn):
  me=bpy.data.meshes.new(name);bm.to_mesh(me);bm.free()
  ca=me.color_attributes.new('Col','BYTE_COLOR','CORNER')
  for p in me.polygons:
    zc=sum(me.vertices[v].co.z for v in p.vertices)/len(p.vertices)
    c=colfn(p,zc,me)
    for li in p.loop_indices:ca.data[li].color=c
  me.color_attributes.active_color=ca
  o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);return o
# ================= IMPOSTOR =================
bm=bmesh.new()
# terrain: 19x17 grid over the part of the island above the sea, under-sea corners pulled to a skirt just below the water
NX,NZ=29,27;X0,X1,Z0,Z1=-64,64,-74,46
grid={}
for i in range(NX):
  for j in range(NZ):
    x=X0+(X1-X0)*i/(NX-1);z=Z0+(Z1-Z0)*j/(NZ-1);y=h(x,z)
    grid[i,j]=(x,z,y)
verts={}
def V(i,j):
  if (i,j) not in verts:
    x,z,y=grid[i,j];y=max(y,SEA-0.9) if y>SEA-0.2 else SEA-0.9
    verts[i,j]=bm.verts.new(B(x,y,z))
  return verts[i,j]
for i in range(NX-1):
  for j in range(NZ-1):
    ys=[grid[i+di,j+dj][2] for di in (0,1) for dj in (0,1)]
    if max(ys)<SEA+0.15:continue
    bm.faces.new((V(i,j),V(i,j+1),V(i+1,j+1),V(i+1,j)))
bmesh.ops.triangulate(bm,faces=bm.faces[:])
# decimate the terrain only (keep silhouette): collapse in a temp mesh
tm=bpy.data.meshes.new('t');bm.to_mesh(tm);bm.free();to=bpy.data.objects.new('t',tm);bpy.context.scene.collection.objects.link(to)
terr_tris0=len(tm.polygons);md=to.modifiers.new('d','DECIMATE');md.ratio=min(1,500/terr_tris0);md.use_collapse_triangulate=True
bpy.context.view_layer.objects.active=to;bpy.ops.object.modifier_apply(modifier='d')
bm=bmesh.new();bm.from_mesh(to.data);bpy.data.objects.remove(to)
for f in bm.faces:f.material_index=0
# tree clumps from meadow_trees_merged (8 m cells, biggest clumps), each a 6-sided crown (12 tris)
_,tb=bvh('meadow_trees_merged');cells={}
for v in tb.verts:
  gx,gz=round(v.co.x/9),round(-v.co.y/9);c=cells.setdefault((gx,gz),[0,Vector((0,0,0)),-99,99]);c[0]+=1;c[1]+=v.co;c[2]=max(c[2],v.co.z);c[3]=min(c[3],v.co.z)
clumps=sorted(cells.values(),key=lambda c:-c[0])[:18]
def crown(cx,cy,base,top,r,n=6):
  ring=[bm.verts.new((cx+r*math.cos(k*2*math.pi/n+0.3),cy+r*math.sin(k*2*math.pi/n+0.3),base+(top-base)*0.38)) for k in range(n)]
  t=bm.verts.new((cx,cy,top));b=bm.verts.new((cx,cy,base))
  for k in range(n):
    f1=bm.faces.new((ring[k],ring[(k+1)%n],t));f1.material_index=1
    f2=bm.faces.new((ring[(k+1)%n],ring[k],b));f2.material_index=1
for c in clumps:
  ctr=c[1]/c[0];gy=h(ctr.x,-ctr.y)
  if gy<SEA:continue
  top=max(c[2],gy+5);crown(ctr.x,ctr.y,gy-0.3,top,max(2.6,(top-gy)*0.42))
# windmill: tower from windmill_static_merged verts above the base, sails disc from windmill_sails
_,wb=bvh('windmill_static_merged');up=[v.co for v in wb.verts if v.co.z>12]
wc=sum(up,Vector())/len(up);wtop=max(v.co.z for v in wb.verts);wbase=min(v.co.z for v in wb.verts)
_,sb=bvh('windmill_sails');sc=sum((v.co for v in sb.verts),Vector())/len(sb.verts);sr=max((v.co-sc).length for v in sb.verts)
nv0=len(bm.verts)
n=8;R0,R1,capY=2.5,1.55,wtop-2.4
def ring(r,z,cx=wc.x,cy=wc.y):return [bm.verts.new((cx+r*math.cos(k*2*math.pi/n+math.pi/8),cy+r*math.sin(k*2*math.pi/n+math.pi/8),z)) for k in range(n)]
r0,r1=ring(R0,wbase-0.4),ring(R1,capY)
for k in range(n):f=bm.faces.new((r0[k],r0[(k+1)%n],r1[(k+1)%n],r1[k]));f.material_index=2
cap=ring(R1+0.45,capY);tip=bm.verts.new((wc.x,wc.y,wtop+0.3))
for k in range(n):
  f=bm.faces.new((cap[k],cap[(k+1)%n],tip));f.material_index=3
  f=bm.faces.new((cap[(k+1)%n],cap[k],r1[k]));f.material_index=3   # cap underside closes onto the tower top
# sails: 4 blades, X shape, tapered, slightly thick (front/back), facing the dock (+game z = -blender y)
hub=Vector((sc.x,min(sc.y,wc.y-R1-0.6),sc.z))
for k in range(4):
  ang=math.radians(45+90*k);d=Vector((math.cos(ang),0,math.sin(ang)));p=Vector((-d.z,0,d.x))
  a0,a1=hub+d*0.9,hub+d*sr*1.05;w0,w1=0.55,1.25
  q=[bm.verts.new(a0+p*w0*0.3),bm.verts.new(a0-p*w0*0.3+p*0),bm.verts.new(a1-p*w1*0.15),bm.verts.new(a1+p*w1)]
  f=bm.faces.new(q);f.material_index=4
hv=[bm.verts.new(hub+Vector((0.7*math.cos(k*math.pi/3),0,0.7*math.sin(k*math.pi/3)))) for k in range(6)];hc=bm.verts.new(hub+Vector((0,-0.5,0)))
for k in range(6):f=bm.faces.new((hv[k],hv[(k+1)%6],hc));f.material_index=3
# 运镜bot gate: windmill >=12 px tall / >=10 px blade span on every screen at the dock -> silhouette x1.2 about its base
WM=1.2;bm.verts.ensure_lookup_table()
for v in bm.verts[nv0:]:v.co=Vector((wc.x+(v.co.x-wc.x)*WM,wc.y+(v.co.y-wc.y)*WM,wbase+(v.co.z-wbase)*WM))
bmesh.ops.triangulate(bm,faces=bm.faces[:])
bmesh.ops.recalc_face_normals(bm,faces=[f for f in bm.faces if f.material_index in (1,2,3)])
bm.transform(__import__('mathutils').Matrix.Translation((0,0,-SEA)))   # local y=0 = sea line
GRASS,CLIFF,TREE,WALL,ROOF,SAIL=(0.34,0.70,0.16),(0.66,0.50,0.30),(0.10,0.42,0.16),(0.96,0.93,0.86),(0.70,0.24,0.16),(0.98,0.95,0.88)
def imp_col(p,zc,me):
  m=p.material_index;nz=p.normal.z
  if m==0:base=GRASS if nz>0.55 else CLIFF
  else:base=(None,TREE,WALL,ROOF,SAIL)[m]
  k={0:0.34,1:0.34,2:0.22,3:0.24,4:0.18}[m]   # windmill keeps more contrast so it reads at 480 m
  return aerial(base,zc+SEA,p.normal,k)
imp=finish(bm,'far_meadow_impostor',imp_col)
json.dump([{'tag':['terrain','tree','tower','cap','sail'][p.material_index],'v':[[imp.data.vertices[i].co.x,imp.data.vertices[i].co.z,-imp.data.vertices[i].co.y] for i in p.vertices]} for p in imp.data.polygons],open(OUT+'/impostor_tris.json','w'))
# ================= REEF =================
random.seed(19);bm=bmesh.new()
def column(cx,cy,r,top,n=6,rings=(0.35,)):
  levels=[-1.6]+[top*f for f in rings]+[top]
  rs=[[bm.verts.new((cx+r*(1+0.08*((k*7+li)%3-1))*math.cos(k*2*math.pi/n+0.2),cy+r*(1+0.08*((k*5+li)%3-1))*math.sin(k*2*math.pi/n+0.2),z)) for k in range(n)] for li,z in enumerate(levels)]
  for a_,b_ in zip(rs,rs[1:]):
    for k in range(n):bm.faces.new((a_[k],a_[(k+1)%n],b_[(k+1)%n],b_[k]))
  topv=rs[-1];c=bm.verts.new((cx+r*0.15,cy,top+r*0.22))
  for k in range(n):bm.faces.new((topv[k],topv[(k+1)%n],c))
# basalt stack: 5 columns + a tilted slab + 2 boulders
for cx,cy,r,top in [(0,0,1.15,3.9),(1.7,0.5,0.95,2.6),(-1.5,0.8,0.9,2.1),(0.6,-1.6,0.85,1.6),(-0.4,1.9,0.7,1.1)]:column(cx,cy,r,top,rings=(0.12,0.55))
slab=bmesh.ops.create_cube(bm,size=1)['verts']
for v in slab:v.co=Vector((v.co.x*3.0,v.co.y*1.3,v.co.z*0.7));v.co.rotate(__import__('mathutils').Euler((0.18,-0.22,0.5)));v.co+=Vector((2.6,-1.4,0.05))
for cx,cy,s in [(-2.4,-1.0,0.75),(3.3,1.6,0.6)]:
  bl=bmesh.ops.create_icosphere(bm,subdivisions=1,radius=s)['verts']
  for v in bl:v.co=Vector((v.co.x*1.2,v.co.y,v.co.z*0.75))+Vector((cx,cy,0.1))
# foam collar: annulus hugging the stack at the water line (+5 cm; the sea is a flat plane)
NF=16;inner=[];outer=[]
for k in range(NF):
  t=k*2*math.pi/NF;ri=2.1+0.5*math.sin(3*t+1);ro=ri+0.55+0.25*math.sin(5*t)
  inner.append(bm.verts.new((ri*math.cos(t)*1.25+0.4,ri*math.sin(t),0.05)));outer.append(bm.verts.new((ro*math.cos(t)*1.25+0.4,ro*math.sin(t),0.05)))
foam=[bm.faces.new((inner[k],outer[k],outer[(k+1)%NF],inner[(k+1)%NF])) for k in range(NF)]
for f in foam:f.material_index=1
bmesh.ops.triangulate(bm,faces=bm.faces[:])
bmesh.ops.recalc_face_normals(bm,faces=[f for f in bm.faces if f.material_index==0])
for f in bm.faces:
  if f.material_index==1 and f.normal.z<0:f.normal_flip()
def reef_col(p,zc,me):
  if p.material_index==1:return (0.93,0.97,0.98,1)
  nz=p.normal.z
  if zc<-0.05:return (0.10,0.20,0.20,1)            # wet base under the line (algae teal)
  if zc<0.32 and abs(nz)<0.6:return (0.84,0.80,0.66,1)  # barnacle / salt line (vertical faces only)
  if nz>0.6:return (0.30,0.62,0.18,1)              # moss / grass caps
  return (0.36,0.22,0.17,1) if int(zc/0.45)%2 else (0.58,0.40,0.26,1)  # strata: red-brown basalt / ochre tuff
reef=finish(bm,'sea_reef_cluster',reef_col)
# ---------- material: white base x COLOR_0, rough, no spec (Creator turns USE_VERTEX_COLOR on for COLOR_0 primitives)
def vc_mat(name):
  m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];ca=m.node_tree.nodes.new('ShaderNodeVertexColor');ca.layer_name='Col'
  m.node_tree.links.new(ca.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=1;p.inputs['Metallic'].default_value=0;p.inputs['Specular IOR Level'].default_value=0;return m
for o,mn in ((imp,'M_far_impostor_vc'),(reef,'M_sea_reef_vc')):
  o.data.materials.clear();o.data.materials.append(vc_mat(mn))
  for p in o.data.polygons:p.material_index=0
  o.data.shade_flat() if hasattr(o.data,'shade_flat') else None
stats={}
for o,f in ((imp,'far_meadow_impostor.glb'),(reef,'sea_reef_cluster.glb')):
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  kw=dict(filepath=OUT+'/'+f,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=8,export_draco_color_quantization=8,use_selection=True,export_format='GLB',export_yup=True,export_apply=True,export_texcoords=False,export_normals=True,export_materials='EXPORT')
  try:bpy.ops.export_scene.gltf(export_vertex_color='ACTIVE',**kw)
  except TypeError:bpy.ops.export_scene.gltf(export_colors=True,**kw)
  mn=[min(v.co[i] for v in o.data.vertices) for i in range(3)];mx=[max(v.co[i] for v in o.data.vertices) for i in range(3)]
  stats[f]={'tris':len(o.data.polygons),'bytes':os.path.getsize(OUT+'/'+f),'game_min':[mn[0],mn[2],-mx[1]],'game_max':[mx[0],mx[2],-mn[1]]}
stats['windmill']={'tower_game':[wc.x,-wc.y],'base_y':wbase-SEA,'top_y':wbase+(wtop+0.3-wbase)*WM-SEA,'sail_hub_y':wbase+(hub.z-wbase)*WM-SEA,'sail_r':sr*1.05*WM,'windmill_scale':WM,'terrain_tris_before_decimate':terr_tris0}
json.dump(stats,open(OUT+'/assets_stats.json','w'),indent=1);print('STATS',json.dumps(stats),flush=True)
