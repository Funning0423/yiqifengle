# r5 U2 定稿 · 对话框切图（海风气泡）。Blender 4.5 headless，沿用 U1 build_reddot.py / 阶段一 c-popups 的做法：
#   palette_helpers.py 建模函数 + env_palette_256.png 色块（气泡 plaster #f8f2e2，胶囊底 white #fbf8ec，箭头 orange #e7903f），
#   焦点件灯光：sun 3.5（画面左上）+ sky 0.22 + 头顶柔光 0.8/26° + 冷色轮廓光 1.1，Cycles 64 采样 + 降噪，透明底，顶视正交。
#   1 Blender 单位 = 1 pt，出图 3 px/pt（和 popup 切图 ART_PX=3 一致）。投影、调色、九宫格内边距在 post_slices.py 里做。
# blender -b --factory-startup -P docs/r5/ui/dialog/final/src/build_dialog_slices.py -- docs/r5/ui/dialog/final/raw
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix
OUT = sys.argv[sys.argv.index('--') + 1]
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../..'))
exec(open(os.path.join(ROOT, 'art-src/board-ui/c-popups/src/palette_helpers.py')).read())
PX = 3
def slab(pts, t):
    """XY 平面轮廓沿 +Z 挤出成厚 t 的板（顶面朝相机）。"""
    bm = bmesh.new(); lo = [bm.verts.new((x, y, 0)) for x, y in pts]; hi = [bm.verts.new((x, y, t)) for x, y in pts]
    bm.faces.new(lo[::-1]); bm.faces.new(hi); n = len(pts)
    for i in range(n): j = (i + 1) % n; bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); return bm
def rr(w, h, r, seg=12):
    p = []
    for cx, cy, a0 in ((w/2-r, h/2-r, 0), (-w/2+r, h/2-r, 90), (-w/2+r, -h/2+r, 180), (w/2-r, -h/2+r, 270)):
        for k in range(seg + 1): a = math.radians(a0 + 90 * k / seg); p.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return p
def rtri(w, h, rt=2.6, base_y=0.0, down=False, strip=0.0, sw=0.0):
    """圆尖三角：底边在 base_y（宽 w），尖朝 +y（down=True 朝 -y）。strip>0 时底下多一条宽 sw 的平板（裁图后只留平的面）。"""
    tip = (0, base_y + h); L = (-w/2, base_y); R = (w/2, base_y)
    # 尖角倒圆：在两条斜边上离尖 rt*1.6 处切开，中间用圆弧
    import math as m
    ang = m.atan2(h, w/2); d = rt * 1.8
    def lerp(a, b, t): return (a[0] + (b[0]-a[0]) * t, a[1] + (b[1]-a[1]) * t)
    ln = ((w/2) ** 2 + h ** 2) ** .5; t = d / ln
    pR = lerp(tip, R, t); pL = lerp(tip, L, t); arc = []
    for k in range(9):
        s = k / 8; q = ((1-s)**2 * pR[0] + 2*(1-s)*s*tip[0] + s*s*pL[0], (1-s)**2 * pR[1] + 2*(1-s)*s*tip[1] + s*s*pL[1]); arc.append(q)
    if strip > 0: pts = [(-sw/2, base_y - strip), (sw/2, base_y - strip), (sw/2, base_y), R] + arc + [L, (-sw/2, base_y)]
    else: pts = [L, R] + arc
    if down: pts = [(x, -y) for x, y in pts][::-1]
    return pts
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = -1.0  # 防止奶油面过曝，post 再把平面拉回目标色
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.62, 0.80, 0.95, 1); bg.inputs['Strength'].default_value = 0.22
def sun(name, energy, ang, vec, col=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.angle = math.radians(ang); d.color = col
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler(); return o
sun('key', 3.5, 8, (0.55, -0.6, -0.75), (1.0, 0.97, 0.92)); sun('top', 0.8, 26, (0.08, -0.18, -1)); sun('rim', 1.1, 12, (-0.45, 0.75, -0.5), (0.88, 0.94, 1.0))
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.sensor_fit = 'HORIZONTAL'; cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, 0, 50); cam.rotation_euler = (0, 0, 0)
def shot(name, obj, wpt, hpt, cx=0.0, cy=0.0):
    for o in sc.collection.objects: pass
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = (o != obj)
    cd.ortho_scale = max(wpt, hpt); cam.location = (cx, cy, 50)
    sc.render.resolution_x = round(wpt * PX); sc.render.resolution_y = round(hpt * PX)
    sc.render.filepath = os.path.join(OUT, name + '_raw.png'); bpy.ops.render.render(write_still=True); print('DONE', name)
def mk(name, pts, t, sw, bevel, seg=3, rot=0):
    bm = slab(pts, t)
    if rot: xform(bm, rot=[('Z', rot)])
    o = finish(bm, name, sw, bevel, seg, 30); return o
os.makedirs(OUT, exist_ok=True)
ONLY = os.environ.get('ONLY', '')   # ONLY=tail：只重渲尾巴（2026-10-18 尾巴放大修正）
if ONLY in ('', 'bubble'):
    # 1) 气泡：可见 108×108 pt，圆角 30，厚 6，倒角 3（3 段）；画布四周各留 12 pt 给投影 → 132×132 pt = 396 px
    b = mk('bubble', rr(108, 108, 30, 16), 6, 'plaster', 3.0, 4); shot('bubble_9s', b, 132, 132)
if ONLY in ('', 'tail'):
    # 2) 小尾巴（修正版）：底宽 30、高 15（390 常规档原大；紧凑档代码缩到 0.867 = 26×13）、尖角小圆 1.6；
    #    倒角 2（比气泡的 3 小，尾巴小，倒角大了尖会被磨成小鼓包）；底下带一条宽 80 的平板（裁图后只留 5 pt 平面盖在气泡上）
    for nm, rot in (('tail_up', 0), ('tail_left', 90), ('tail_right', -90)):
        o = mk(nm, rtri(30, 15, rt=1.6, strip=10, sw=80), 6, 'plaster', 2.0, 4, rot)
        if rot == 0: shot(nm, o, 44, 44, 0, 5)
        else: shot(nm, o, 44, 44, -5 if rot == 90 else 5, 0)
if ONLY in ('', 'pill'):
    # 3) 名字胶囊：外圈（奶油）40×32 r16；里面白底 36×28 r14（代码按角色色乘色）。各留 6 pt 投影边
    o = mk('pill_rim', rr(40, 32, 16, 12), 4, 'plaster', 1.6, 3); shot('name_pill_rim_3s', o, 52, 52)
    o = mk('pill_fill', rr(36, 28, 14, 12), 4.5, 'white', 1.4, 3); shot('name_pill_fill_3s', o, 52, 52)
# 4) 翻页提示：圆角朝下三角 14×10，橘色，厚 4
if ONLY in ('', 'arrow'):
    o = mk('next_arrow', rtri(14, 10, rt=2.2, down=True), 4, 'orange', 1.2, 3); xform  # noqa
    o.location = (0, 5, 0); shot('next_arrow', o, 24, 24, 0, 0)
