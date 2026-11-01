"""Blender (5.2, background) : parts_<model>.json -> <model>.glb, Draco, +Y up, one palette material without texture
(rebound at runtime to the region's shared palette, same as region_island/ui-props). Run with nohup:
  blender -b --factory-startup -P blender_export.py -- /tmp/b19dock/parts_island_dock.json out.glb"""
import bpy,json,sys
argv=sys.argv[sys.argv.index('--')+1:];src,dst=argv[0],argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
J=json.load(open(src));mats={}
def mat(name):
    if name not in mats:
        m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Roughness'].default_value=0.9;b.inputs['Metallic'].default_value=0.0
        m.use_backface_culling=False;mats[name]=m
    return mats[name]
objs={}
for name,n in J['nodes'].items():
    if 'V' in n:
        me=bpy.data.meshes.new(name);V=[(x,-z,y) for x,y,z in n['V']];me.from_pydata(V,[],n['F']);me.update()
        uv=me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:u,v=n['UV'][me.loops[li].vertex_index];uv.data[li].uv=(u,1-v)
        for p in me.polygons:p.use_smooth=False
        me.materials.append(mat(n['material']));o=bpy.data.objects.new(name,me)
    else:o=bpy.data.objects.new(name,None)
    bpy.context.scene.collection.objects.link(o);objs[name]=o
for name,n in J['nodes'].items():
    if n.get('parent') and n['parent'] in objs:objs[name].parent=objs[n['parent']]
bpy.context.scene.name=J['model'] if J['model']!='sky_mooring' else 'sky_mooring_props'
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',use_selection=False,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,
    export_materials='EXPORT',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=14,
    export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_extras=False,export_cameras=False,export_lights=False,export_animations=False)
print('EXPORTED',dst)
