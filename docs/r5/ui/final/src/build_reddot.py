# r5 U1 定稿 · 红点（唯一新做的 3D 切图）。Blender 4.5 headless，沿用阶段一 (c) build_popups.py 的做法：
#   palette_helpers.py 建模函数 + env_palette_256.png 色块（奶油圈 plaster (206,4) #f8f2e2），
#   红色用棋子专用的 M_piece_strawberry（#ce342e，阶段一草莓的唯一例外色，HANDOFF §2.4），
#   焦点件灯光：sun 3.5（左上前方）+ sky 0.22 + 头顶柔光 0.8/26° + 冷色轮廓光 1.1，Cycles 64 采样 + 降噪，透明底。
# blender -b --factory-startup -P docs/r5/ui/final/src/build_reddot.py -- docs/r5/ui/final/raw
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix
OUT = sys.argv[sys.argv.index('--') + 1]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../..'))
exec(open(os.path.join(ROOT, 'art-src/board-ui/c-popups/src/palette_helpers.py')).read())
def straw(rough=0.36, spec=0.7):
    m = bpy.data.materials.new('M_piece_strawberry'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    b.inputs['Base Color'].default_value = (*[lin(int('ce342e'[i:i+2], 16) / 255) for i in (0, 2, 4)], 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Specular IOR Level'].default_value = spec
    return m
MS = straw()
R_OUT, RING = 0.5, 2 / 12  # 12 pt 圆点，2 pt 奶油圈
r_in = R_OUT - 2 * R_OUT * RING
P = []
# 奶油圈：圆盘 + 倒角（顶视正交，所以是正圆）
P.append(finish(xform(cyl(R_OUT, R_OUT, 0.12, 48), (0, 0, 0.06)), 'ring', 'plaster', 0.035, 3, 30))
# 红珠：压扁的球冠，坐在圈里
bm = uvs(r_in, 48, 24); xform(bm, (0, 0, 0.10), scale=(1, 1, 0.55))
P.append(finish(bm, 'bead', 'red', 0.0, mat=MS))
ob = join(P, 'reddot', 40)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.62, 0.80, 0.95, 1); bg.inputs['Strength'].default_value = 0.22
def sun(name, energy, ang, vec, col=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.angle = math.radians(ang); d.color = col
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler(); return o
# 顶视机位：把阶段一“左上前方”的光换到画面左上（y 取反），与 UI 投影（右下）一致
sun('key', 3.5, 8, (0.55, -0.6, -0.75), (1.0, 0.97, 0.92)); sun('top', 0.8, 26, (0.08, -0.18, -1)); sun('rim', 1.1, 12, (-0.45, 0.75, -0.5), (0.88, 0.94, 1.0))
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = 1.12; cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, 0, 20); cam.rotation_euler = (0, 0, 0)
sc.render.resolution_x = sc.render.resolution_y = 192
os.makedirs(OUT, exist_ok=True); sc.render.filepath = os.path.join(OUT, 'reddot_raw.png'); bpy.ops.render.render(write_still=True)
print('DONE reddot')
