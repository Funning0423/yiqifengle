# QA only (not shipped): blender -b --factory-startup -P tools/scene-fx/qa/render_island_top.py (GLB path is absolute; edit for your checkout)
import bpy,math,mathutils
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/yiqifengle/work/场景特效bot/creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
for o in bpy.data.objects:
    if any(o.name.startswith(h) for h in ('env_sky','env_cloud','env_sea','col_','env_lighthouse_beam')): o.hide_render=True
sc=bpy.context.scene
cam=bpy.data.cameras.new('c');cam.type='ORTHO';cam.ortho_scale=26
co=bpy.data.objects.new('c',cam);sc.collection.objects.link(co);sc.camera=co
co.location=(1.5,-1.0,40);co.rotation_euler=(0,0,0)
sun=bpy.data.lights.new('s','SUN');sun.energy=3;so=bpy.data.objects.new('s',sun);sc.collection.objects.link(so)
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.2,.3,.5,1)
sc.render.engine='CYCLES';sc.cycles.samples=8;sc.render.resolution_x=sc.render.resolution_y=1040
sc.render.filepath='/tmp/fxbot/top.png';bpy.ops.render.render(write_still=True)
