import bpy,math
from pathlib import Path
OUT=Path(__file__).resolve().parents[2]/'output/character-continuity';OUT.mkdir(parents=True,exist_ok=True)
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
mat=bpy.data.materials.new('ReferenceStoolWood');mat.diffuse_color=(.38,.25,.15,1);mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=mat.diffuse_color;p.inputs['Roughness'].default_value=.86
parts=[]
def tube(name,a,b,r1,r2):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat)
 be=o.modifiers.new('SoftEdges','BEVEL');be.width=.003;be.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=be.name)
 for f in o.data.polygons:f.use_smooth=True
 parts.append(o);return o
# Dimensions from the original scan: .30m round seat, .41m high, four splayed legs and .13m rungs.
tube('RoundSeat',(0,.087,.374),(0,.087,.412),.150,.150)
legs=[]
for x in [-1,1]:
 for y in [-1,1]:
  bottom=Vector((x*.142,.087+y*.123,.008));top=Vector((x*.105,.087+y*.093,.390));tube('SplayedLeg',bottom,top,.020,.024);legs.append((x,y,bottom,top))
pts={(x,y):a+(b-a)*(.135-.008)/(.390-.008) for x,y,a,b in legs}
for y in [-1,1]:tube('SideRung',pts[-1,y],pts[1,y],.010,.010)
for x in [-1,1]:tube('CrossRung',pts[x,-1],pts[x,1],.010,.010)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();parts[0].name='StationaryReferenceRoundStool'
bpy.ops.export_scene.gltf(filepath=str(OUT/'stool-clean.glb'),use_selection=True,export_yup=True,export_animations=False)
