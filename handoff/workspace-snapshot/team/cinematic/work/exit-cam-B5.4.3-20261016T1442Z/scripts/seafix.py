# Preview sea = game sea inputs: M_env_sea (bundles/region_island/combined_visual_m.glb): COLOR_0 vertex colour x Sea_CalmWavelets_64 albedo,
# roughness .22, specular .7. Cocos' sky reflection on that glossy standard material is not reproduced by EEVEE, so the shaded
# result is calibrated to the measured game sea colour (Funning's screenshot, sRGB ~(48,157,180)): linear tint (0.33,0.82,1.10)
# on COLOR_0 (mean sRGB (85,171,171)) feeding an emission shader. Shared by render52.py and pose_still.py.
import bpy
TEX='/tmp/b52/sea_tex.png';TINT=(0.95,1.6,1.75,1)  # /0.87 for the 240/255 wavelet albedo
def apply():
  img=bpy.data.images.load(TEX,check_existing=True)
  for o in bpy.data.objects:
    if o.type!='MESH' or not o.name.startswith('env_sea_surface'):continue
    ca=o.data.color_attributes;an=ca[0].name if len(ca) else 'Color'
    for s in o.material_slots:
      m=s.material
      if not m or not m.name.startswith('M_env_sea') or 'foam' in m.name:continue
      m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
      out=nt.nodes.new('ShaderNodeOutputMaterial');em=nt.nodes.new('ShaderNodeEmission');at=nt.nodes.new('ShaderNodeVertexColor');at.layer_name=an
      tx=nt.nodes.new('ShaderNodeTexImage');tx.image=img;tx.interpolation='Closest';uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map=o.data.uv_layers[0].name if o.data.uv_layers else ''
      m1=nt.nodes.new('ShaderNodeMix');m1.data_type='RGBA';m1.blend_type='MULTIPLY';m1.inputs[0].default_value=1
      m2=nt.nodes.new('ShaderNodeMix');m2.data_type='RGBA';m2.blend_type='MULTIPLY';m2.inputs[0].default_value=1;m2.inputs[7].default_value=TINT
      L=nt.links;L.new(uv.outputs[0],tx.inputs[0]);L.new(at.outputs[0],m1.inputs[6]);L.new(tx.outputs[0],m1.inputs[7]);L.new(m1.outputs[2],m2.inputs[6]);L.new(m2.outputs[2],em.inputs[0]);L.new(em.outputs[0],out.inputs[0])
      print('SEAFIX',o.name,m.name,an)
apply()
