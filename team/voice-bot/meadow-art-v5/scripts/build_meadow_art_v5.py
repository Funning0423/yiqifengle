# v5: rebuild sphere-cluster clouds of meadow_clouds_near as flat, irregular-edged low-poly cloud slabs (unlit, vertex colour). Input = v4 glb.
import bpy,sys,bmesh,math,random,json
from mathutils import Vector
src,dst=sys.argv[-2],sys.argv[-1]; random.seed(515)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
o=bpy.data.objects['meadow_clouds_near']; me=o.data; ca=me.color_attributes[0]
cols=[tuple(c.color) for c in ca.data]; lum=sorted(sum(c[:3])/3 for c in cols)
print("COLRANGE",lum[0],lum[len(lum)//2],lum[-1], cols[0])
top=max(cols,key=lambda c:sum(c[:3])); srt=sorted(cols,key=lambda c:sum(c[:3])); bot=srt[len(srt)//5]
bm=bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
# loose parts -> clusters by x sign (0-4 right, 5-9 left as inspected)
seen=set(); parts=[]
for v in bm.verts:
    if v in seen: continue
    st=[v]; comp=[]; seen.add(v)
    while st:
        x=st.pop(); comp.append(x)
        for e in x.link_edges:
            y=e.other_vert(x)
            if y not in seen: seen.add(y); st.append(y)
    parts.append(comp)
clusters={}
for c in parts:
    cen=sum((v.co for v in c),Vector())/len(c); clusters.setdefault(cen.x>0,[]).append(c)
boxes=[]
for k,cl in clusters.items():
    vs=[v for c in cl for v in c]
    mn=Vector([min(v.co[i] for v in vs) for i in range(3)]); mx=Vector([max(v.co[i] for v in vs) for i in range(3)]); boxes.append((mn,mx))
bmesh.ops.delete(bm,geom=list(bm.verts),context='VERTS')
cl_layer=bm.loops.layers.color.get(ca.name) or bm.loops.layers.color.new(ca.name)
def lerp(a,b,t): return tuple(a[i]+(b[i]-a[i])*t for i in range(4))
def cloud(mn,mx):
    W=(mx.x-mn.x)*0.95; H=(mx.z-mn.z)*0.8; cx=(mn.x+mx.x)/2; cy=(mn.y+mx.y)/2; z0=mn.z+(mx.z-mn.z)*0.12
    # outline (x,z) in local 2D: flat-ish bottom + 4-5 uneven puffs on top, low-poly (5-7 segs per puff)
    pts=[]; n=random.choice([4,5]); xs=sorted(random.uniform(-.38,.38) for _ in range(n))
    pts.append((-0.5,0.0))
    for i,px in enumerate(xs):
        r=random.uniform(.16,.26)*(1.25 if 0<i<n-1 else 1); hz=random.uniform(.32,.55)
        for a in range(6+1):
            t=math.pi*(1-a/6); pts.append((px+r*math.cos(t)*1.0, hz+r*math.sin(t)*1.9*random.uniform(.92,1.05)))
    pts.append((0.5,0.0))
    for a in range(1,6): pts.append((0.5-a/6, -0.03*random.uniform(.5,1.5)))   # slightly irregular bottom
    pts=[(cx+W*x, z0+H*z) for x,z in pts]
    # keep outer hull-ish order (sort upper part by x) -> use convex-free fan from centroid
    zc=z0+H*0.18
    D=(mx.y-mn.y)*0.35
    for side,yy in ((0,cy-D/2),(1,cy+D/2)):
        cen=bm.verts.new((cx,yy,zc)); ring=[bm.verts.new((x,yy,z)) for x,z in pts]
        for i in range(len(ring)):
            f=bm.faces.new([cen,ring[i],ring[(i+1)%len(ring)]] if side==0 else [cen,ring[(i+1)%len(ring)],ring[i]])
            for l in f.loops:
                t=max(0,min(1,(l.vert.co.z-z0)/(H*0.7)))
                l[cl_layer]=lerp(bot,top,t**0.7)
        if side==0: front=ring
        else: back=ring
    for i in range(len(front)):
        f=bm.faces.new([front[i],back[i],back[(i+1)%len(back)],front[(i+1)%len(front)]])
        for l in f.loops:
            t=max(0,min(1,(l.vert.co.z-z0)/(H*0.7))); l[cl_layer]=lerp(bot,top,t**0.7)
for mn,mx in boxes: cloud(mn,mx)
bm.to_mesh(me); bm.free(); me.update()
rep={'cloud_clusters_rebuilt':len(boxes),'verts':len(me.vertices),'bot_col':bot,'top_col':top}
print("REPORT",json.dumps(rep)); json.dump(rep,open(dst+'.build_report.json','w'))
bpy.ops.object.select_all(action='DESELECT'); o.parent=None; o.matrix_world=o.matrix_world; o.select_set(True)
import mathutils; o.matrix_world=mathutils.Matrix.Identity(4)
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_materials='PLACEHOLDER',export_vertex_color='ACTIVE' if bpy.app.version>=(4,2) else 'MATERIAL')
