# v6: meadow_clouds_near rebuilt as puffy low-poly clouds (overlapping clipped low-poly ellipsoid puffs, flat bottom), colour = height gradient sampled from sky-texture clouds. Input = v5 glb.
import bpy,sys,bmesh,math,random,json
from mathutils import Vector,Matrix
src,dst=sys.argv[-2],sys.argv[-1]; random.seed(616)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
o=bpy.data.objects['meadow_clouds_near']; me=o.data
# original cluster bounds (from 5c54f7a sphere clusters; v5 slabs keep same footprint) -> take from current mesh by x sign
import os
boxes=[(Vector(a),Vector(b)) for a,b in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'cloud_boxes_orig.json')))]  # mesh-local bounds of the two original sphere clusters (5c54f7a)
def s2l(x): x/=255; return ((x+0.055)/1.055)**2.4
TOP=[s2l(c) for c in (246,249,248)]          # sky-texture cloud highlight (median of bright cloud pixels)
SHD=[s2l(c) for c in (127,153,169)]          # sky-texture cloud shadow (median of grey-blue cloud pixels)
BOT=[a*0.8+b*0.2 for a,b in zip(SHD,TOP)]  # slight grey-blue at the flat bottom
bm=bmesh.new(); col=bm.loops.layers.color.new('Color')
def puff(c,rx,ry,rz,z0,seg=8,rings=5):
    tmp=bmesh.new(); bmesh.ops.create_uvsphere(tmp,u_segments=seg,v_segments=rings,radius=1.0)
    rot=random.uniform(0,math.pi)
    for v in tmp.verts:
        p=Matrix.Rotation(rot,3,'Z')@v.co
        p=Vector((c.x+p.x*rx*random.uniform(.94,1.06),c.y+p.y*ry,c.z+p.z*rz*random.uniform(.95,1.05)))
        if p.z<z0: p.z=z0          # flat bottom
        v.co=p
    m={v:bm.verts.new(v.co) for v in tmp.verts}
    for f in tmp.faces:
        try: bm.faces.new([m[v] for v in f.verts])
        except ValueError: pass
    tmp.free()
for mn,mx in boxes:
    W=(mx.x-mn.x)*0.95; H=(mx.z-mn.z); cx=(mn.x+mx.x)/2; cy=(mn.y+mx.y)/2; z0=mn.z+H*0.15; D=(mx.y-mn.y)*0.5
    # arch: (x offset frac, radius frac of W, height of centre frac of H)
    layout=[(-0.32,0.17,0.24),(-0.10,0.24,0.40),(0.15,0.22,0.36),(0.36,0.15,0.22)]
    for fx,fr,fz in layout:
        r=W*fr*random.uniform(.93,1.07)
        puff(Vector((cx+fx*W,cy+random.uniform(-.1,.1)*D,z0+fz*H)),r,min(r,D)*0.8,r*0.98,z0,seg=10,rings=5)
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=0.01)
zs=[v.co.z for v in bm.verts]; zl,zh=min(zs),max(zs)
for f in bm.faces:
    for l in f.loops:
        t=(l.vert.co.z-zl)/(zh-zl); t=min(1,max(0,(t-0.05)/0.4)); t=t*t*(3-2*t)
        l[col]=(*[b+(a-b)*t for a,b in zip(TOP,BOT)],1.0)
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
for a in list(me.color_attributes): me.color_attributes.remove(a)
bm.to_mesh(me); bm.free(); me.update()
rep={'verts':len(me.vertices),'faces':len(me.polygons),'top_lin':TOP,'bottom_lin':BOT}
print("REPORT",json.dumps(rep)); json.dump(rep,open(dst+'.build_report.json','w'))
bpy.ops.object.select_all(action='DESELECT'); o.parent=None; o.matrix_world=Matrix.Identity(4); o.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_materials='PLACEHOLDER',export_vertex_color='ACTIVE')
