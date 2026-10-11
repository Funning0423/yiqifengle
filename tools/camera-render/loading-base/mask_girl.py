import bpy
# girl-only mask: character meshes white emission, room black holdout
wm=bpy.data.materials.new('W'); wm.use_nodes=True; nt=wm.node_tree; nt.nodes.clear()
e=nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value=(1,1,1,1); o=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],o.inputs[0])
km=bpy.data.materials.new('K'); km.use_nodes=True; nt=km.node_tree; nt.nodes.clear()
e=nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value=(0,0,0,1); o=nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0],o.inputs[0])
for ob in bpy.data.objects:
  if ob.type=='MESH':
    mat = wm if ob in chobjs else km
    for s in ob.material_slots: s.material=mat
for l in [o for o in bpy.data.objects if o.type=='LIGHT']: l.hide_render=True
bpy.context.scene.world.node_tree.nodes['Background'].inputs[1].default_value=0
bpy.context.scene.view_settings.view_transform='Standard'
cd.dof.use_dof=False
