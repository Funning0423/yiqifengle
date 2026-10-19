# 定稿图里的 3D 宝箱：按游戏里 ResultChest3D 的 RenderTexture 机位重渲 result_chest_preview.glb（同一模型，内嵌调色板只供预览），
# 让图上的开盖高度和游戏一致（LID_REACH 0.47）。不进包，只给定稿图用。
# 机位（ResultChest3D.ts CHEST_CAMERA）：pitch 36°、azimuth 38°、fov 36°（竖直）、距离 5.6、看向 y 0.68；Cocos (x,y,z) = Blender (x, z, −y)。
# blender -b --factory-startup -P docs/r5/ui/final/src/render_chest_rt.py -- docs/r5/ui/final/raw
import bpy, math, sys, os
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../..'))
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'art-src/board-ui/c-popups/glb/result_chest_preview.glb'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.render.image_settings.color_mode = 'RGBA'; sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = sc.render.resolution_y = 640
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.62, 0.80, 0.95, 1); bg.inputs['Strength'].default_value = 0.22
def sun(name, energy, ang, vec, col=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.angle = math.radians(ang); d.color = col
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
sun('key', 3.5, 8, (0.55, 0.6, -0.75), (1.0, 0.97, 0.92)); sun('top', 0.8, 26, (0.08, 0.18, -1)); sun('rim', 1.1, 12, (-0.45, -0.75, -0.5), (0.88, 0.94, 1.0))
p, a, d, ty = math.radians(36), math.radians(38), 5.6, 0.68
X, Y, Z = d * math.cos(p) * math.sin(a), ty + d * math.sin(p), d * math.cos(p) * math.cos(a)   # Cocos
cd = bpy.data.cameras.new('cam'); cd.lens_unit = 'FOV'; cd.sensor_fit = 'VERTICAL'; cd.angle = math.radians(36)
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (X, -Z, Y); look = Vector((0, 0, ty)); cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
il = bpy.data.lights.new('inner', 'POINT'); il.energy = 14; il.shadow_soft_size = 0.25; il.color = (1.0, 0.82, 0.52)
ino = bpy.data.objects.new('inner', il); sc.collection.objects.link(ino); ino.location = (0, 0, 0.62)
os.makedirs(OUT, exist_ok=True)
for name, frame in (('chest_rt_closed', 0), ('chest_rt_open', 15)):
    sc.frame_set(frame); ino.hide_render = frame == 0
    sc.render.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True)
print('DONE chest rt')
