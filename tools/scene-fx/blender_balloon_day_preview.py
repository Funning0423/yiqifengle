# QA only. blender -b --factory-startup -P blender_balloon_day_preview.py -- transport_balloon.glb out.png lit|unlit
# Offline proxy of the 04 cruise envelope: camera on the shadow side of the sun (as after the seam).
# lit = glTF standard material under one sun (b11: applyVehicleNight restores the shared lit mat by day).
# unlit = builtin-unlit x albedo x linear 1.12 (v25fix TransportVehicle day path, ported here). Not the Cocos renderer.
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index('--') + 1:]; GLB, OUT, MODE = a
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
objs = [o for o in sc.objects if o.type == 'MESH']
for o in objs:
    if 'flame' in o.name: o.hide_render = True
if MODE == 'unlit':
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        nt = m.node_tree; b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None); out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if not b or not out: continue
        src = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else None
        em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.12
        if src: nt.links.new(src, em.inputs['Color'])
        else: em.inputs['Color'].default_value = b.inputs['Base Color'].default_value
        nt.links.new(em.outputs[0], out.inputs['Surface'])
lo = mathutils.Vector((1e9,) * 3); hi = -lo
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c); lo = mathutils.Vector(map(min, lo, w)); hi = mathutils.Vector(map(max, hi, w))
ctr = (lo + hi) / 2; size = (hi - lo).length
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.angle = math.radians(40); cam.location = ctr + mathutils.Vector((0, -1.25 * size, 0.15 * size))
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 3.0; sun.rotation_euler = (math.radians(55), 0, math.radians(180))   # sun behind the balloon
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.45, 0.62, 0.85, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.5
sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 390, 520; sc.view_settings.view_transform = 'Standard'
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)
