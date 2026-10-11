"""Blender 4.3 geometry QA, using the exact exported TS mesh/normal/color data.
This is NOT a Cocos or WeChat screenshot. The shader reproduces the fixed local key/fill.
"""
import bpy,json,math,sys,os
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
samples=json.load(open(root+'/evidence/dimensional-buttons/geometry.json'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=False
scene.render.resolution_x=1800;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.film_transparent=False;scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
mat=bpy.data.materials.new('Exact_fixed_key_fill_in_linear_space');mat.use_nodes=True
n=mat.node_tree.nodes;n.clear();link=mat.node_tree.links.new
out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');link(em.outputs[0],out.inputs['Surface'])
geom=n.new('ShaderNodeNewGeometry');color=n.new('ShaderNodeVertexColor');color.layer_name='WarmColor'
def mathnode(op,a,b=None):
 t=n.new('ShaderNodeMath');t.operation=op
 if hasattr(a,'bl_idname'):link(a,t.inputs[0])
 else:t.inputs[0].default_value=a
 if b is not None:
  if hasattr(b,'bl_idname'):link(b,t.inputs[1])
  else:t.inputs[1].default_value=b
 return t.outputs[0]
def dot(vec):
 t=n.new('ShaderNodeVectorMath');t.operation='DOT_PRODUCT';link(geom.outputs['Normal'],t.inputs[0]);t.inputs[1].default_value=Vector(vec).normalized();return t.outputs['Value']
key=Vector((-.55,.72,.75)).normalized()
diff=mathnode('ADD',.43,mathnode('MULTIPLY',.75,mathnode('MAXIMUM',dot(key),0)))
diff=mathnode('ADD',diff,mathnode('MULTIPLY',.09,mathnode('MAXIMUM',dot((.7,-.2,.45)),0)))
spec=mathnode('MULTIPLY',.075,mathnode('POWER',mathnode('MAXIMUM',dot(key+Vector((0,0,1))),0),28))
mul=n.new('ShaderNodeVectorMath');mul.operation='SCALE';link(color.outputs['Color'],mul.inputs[0]);link(diff,mul.inputs['Scale'])
sp=n.new('ShaderNodeVectorMath');sp.operation='SCALE';sp.inputs[0].default_value=(1,.89,.70);link(spec,sp.inputs['Scale'])
add=n.new('ShaderNodeVectorMath');add.operation='ADD';link(mul.outputs['Vector'],add.inputs[0]);link(sp.outputs['Vector'],add.inputs[1]);link(add.outputs['Vector'],em.inputs['Color'])
# Two wide pairs plus 2 smaller pairs, geometry always at 1:1 coordinate ratio.
selected=[0,1,2,3,12,13,14,15,8,9,10,11]
for q,i in enumerate(selected):
 g=samples[i];p=list(zip(*[iter(g['positions'])]*3));normals=list(zip(*[iter(g['normals'])]*3));faces=list(zip(*[iter(g['indices'])]*3))
 mesh=bpy.data.meshes.new('Exact_TS_geometry');mesh.from_pydata(p,[],faces);mesh.update()
 for poly in mesh.polygons:poly.use_smooth=True
 mesh.normals_split_custom_set_from_vertices(normals)
 colors=mesh.color_attributes.new(name='WarmColor',type='FLOAT_COLOR',domain='POINT')
 for idx,col in enumerate(zip(*[iter(g['colors'])]*4)):colors.data[idx].color=col
 obj=bpy.data.objects.new(f'{g["w"]}x{g["h"]}_{"ivory" if g["ivory"] else "green"}_{"pressed" if g["pressed"] else "rest"}',mesh);scene.collection.objects.link(obj);obj.data.materials.append(mat)
 if q<4:obj.location=((q%2)*290-145,100-(q//2)*90,0)
 elif q<8:obj.location=((q-4)*125-187.5,-100,0)
 else:obj.location=((q-8)*125-187.5,-190,0)
camdata=bpy.data.cameras.new('Geometry_review_camera');cam=bpy.data.objects.new('Geometry_review_camera',camdata);scene.collection.objects.link(cam);cam.location=(0,-35,1000);cam.rotation_euler=(0,0,0);camdata.clip_end=3000;camdata.type='ORTHO';camdata.ortho_scale=640;scene.camera=cam

# These annotations are part of the QA sheet, not shipped UI or a device screenshot.
def flatmat(name,rgba):
 m=bpy.data.materials.new(name);m.use_nodes=True;ns=m.node_tree.nodes;ns.clear();e=ns.new('ShaderNodeEmission');e.inputs[0].default_value=rgba;o=ns.new('ShaderNodeOutputMaterial');m.node_tree.links.new(e.outputs[0],o.inputs['Surface']);return m
paper=flatmat('Warm_review_paper',(.79,.75,.66,1));ink=flatmat('Review_annotations',(.055,.105,.075,1))
bpy.ops.mesh.primitive_plane_add(size=2000,location=(0,0,-100));bpy.context.object.data.materials.append(paper)
def label(text,x,y,size=7):
 curve=bpy.data.curves.new(text,'FONT');curve.body=text;curve.size=size;curve.align_x='CENTER';obj=bpy.data.objects.new(text,curve);scene.collection.objects.link(obj);obj.location=(x,y,60);obj.data.materials.append(ink)
label('Warm ceramic / timber: actual bevelled 3D geometry',0,157,11)
label('Blender geometry + fixed normal-lighting review. NOT a Cocos or WeChat screenshot.',0,142,5.7)
for x,title in [(-145,'REST / raised cap'),(145,'PRESSED / cap travels 2 UI px')]:label(title,x,125,7)
label('240 x 46 / forest green',0,62,6);label('240 x 46 / warm ivory',0,-28,6)
for x,title in [(-187.5,'green / rest'),(-62.5,'green / pressed'),(62.5,'ivory / rest'),(187.5,'ivory / pressed')]:label(title,x,-65,5.5)
label('46 x 46 icon surfaces. Existing UI glyphs remain separate and crisp.',0,-137,6)
label('76 x 30 compact surfaces. Root hit rectangles are unchanged.',0,-225,6)
scene.render.filepath=root+'/evidence/dimensional-buttons/exact-mesh-review.png';bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=root+'/evidence/dimensional-buttons/exact-geometry-review.blend')
