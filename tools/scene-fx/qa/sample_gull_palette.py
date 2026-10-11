# QA only (not shipped): blender -b --factory-startup -P tools/scene-fx/qa/sample_gull_palette.py (GLB path is absolute; edit for your checkout)
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/work/场景特效bot/creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
for name in ('env_palette_256','env_palette_emissive_256'):
  im=bpy.data.images[name];w,h=im.size;px=im.pixels[:]
  for u,v in [(0.406,0.094),(0.594,0.031),(0.531,0.594)]:
    x=int(u*w);y=int(v*h);i=(y*w+x)*4;print('PX',name,u,v,[round(c*255) for c in px[i:i+4]])
m=bpy.data.materials['M_env_palette'];b=m.node_tree.nodes['Principled BSDF']
for k in ('Base Color','Emission Color','Emission Strength','Roughness','Metallic'):
  i=b.inputs[k];print('IN',k,i.is_linked, tuple(i.default_value) if hasattr(i.default_value,'__len__') else i.default_value)
