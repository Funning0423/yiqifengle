"""U2 定稿切图后处理：Blender 原图（raw/*_raw.png，3 px/pt）→ 调平面色 → 投影 → 裁切 → pngquant。
平面色：气泡/尾巴 = #FFF7E4（奶油），名字胶囊外圈 = #FFF8E8，胶囊底 = 纯白（代码按角色色乘色），箭头 = #E7903F（阶段一色板 orange）。
输出 assets/*.png + assets/slices.json（尺寸、九宫格内边距、锚点，单位 px@3x 和 pt）。"""
import os, json, subprocess
from PIL import Image, ImageFilter, ImageChops
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); RAW = os.path.join(ROOT, 'raw'); OUT = os.path.join(ROOT, 'assets')
PX = 3
os.makedirs(OUT, exist_ok=True)
def load(n): return Image.open(os.path.join(RAW, n + '_raw.png')).convert('RGBA')
def recolor(im, target, gray=False):
    w, h = im.size; face = im.getpixel((w // 2, h // 2))
    r, g, b, a = im.split()
    if gray:
        l = Image.merge('RGB', (r, g, b)).convert('L'); k = 255 / max(1, l.getpixel((w // 2, h // 2)))
        l = l.point(lambda v: min(255, round(v * k))); return Image.merge('RGBA', (l, l, l, a))
    ch = [c.point(lambda v, f=t / max(1, fc): min(255, round(v * f))) for c, t, fc in zip((r, g, b), target, face[:3])]
    return Image.merge('RGBA', (*ch, a))
def drop(im, off_pt, blur_pt, alpha, mask_rows=None, col=(90, 60, 30)):
    a = im.split()[3]
    if mask_rows is not None:
        m = Image.new('L', im.size, 0); m.paste(255, (0, 0, im.width, mask_rows)); a = ImageChops.multiply(a, m)
    sh = Image.new('L', im.size, 0); sh.paste(a, (0, round(off_pt * PX))); sh = sh.filter(ImageFilter.GaussianBlur(blur_pt * PX / 2)).point(lambda v: round(v * alpha))
    base = Image.new('RGBA', im.size, col + (0,)); base.putalpha(sh); base.alpha_composite(im); return base
def save(im, name):
    p = os.path.join(OUT, name + '.png'); im.save(p)
    subprocess.run(['pngquant', '--force', '--skip-if-larger', '--quality', '80-98', '--speed', '1', '--strip', '--output', p, p], check=False)
    return os.path.getsize(p)
CREAM = (255, 247, 228); RIM = (255, 248, 232); ORANGE = (0xE7, 0x90, 0x3F)
meta = {}
# 气泡 9 宫格：画布 132×132 pt，可见 108×108（四周 12 pt 投影边），圆角 30
b = drop(recolor(load('bubble_9s'), CREAM), 3, 6, 0.22)
meta['dialog_bubble_9s'] = dict(px=b.size, bytes=save(b, 'dialog_bubble_9s'), insets_px=[144, 144, 144, 144], insets_pt=[48, 48, 48, 48],
    shadow_margin_pt=12, visible_radius_pt=30, note='节点尺寸 = 可见气泡 + 四周各 12 pt；insetLeft/Top/Right/Bottom = 144 px（=48 pt：12 投影 + 30 圆角 + 6 余量）')
# 尾巴：底边盖进气泡 5 pt（平面色和气泡相同，不露接缝）
t = drop(recolor(load('tail_up'), CREAM), 1.5, 3, 0.18, mask_rows=63).crop((9, 18, 93, 78))
meta['dialog_tail_up'] = dict(px=t.size, bytes=save(t, 'dialog_tail_up'), anchor=[0.5, 0.25], note='锚点 = 底边中点（离图下沿 5 pt）；放在气泡可见上沿上；尖朝上，高出上沿 12 pt，底宽 22 pt')
t = recolor(load('tail_left'), CREAM).crop((18, 9, 78, 93))
meta['dialog_tail_left'] = dict(px=t.size, bytes=save(t, 'dialog_tail_left'), anchor=[0.75, 0.5], note='锚点 = 底边中点（离图右沿 5 pt）；放在气泡可见左沿上；尖朝左，伸出 12 pt')
t = recolor(load('tail_right'), CREAM).crop((24, 9, 84, 93))
meta['dialog_tail_right'] = dict(px=t.size, bytes=save(t, 'dialog_tail_right'), anchor=[0.25, 0.5], note='锚点 = 底边中点（离图左沿 5 pt）；放在气泡可见右沿上；尖朝右，伸出 12 pt')
# 名字胶囊：外圈（奶油，带投影）+ 白底（代码乘角色色），两张同心
r = drop(recolor(load('name_pill_rim_3s'), RIM), 1.5, 2.5, 0.28).crop((6, 18, 150, 138))
meta['dialog_name_rim_3s'] = dict(px=r.size, bytes=save(r, 'dialog_name_rim_3s'), insets_px=[60, 0, 60, 0], insets_pt=[20, 0, 20, 0],
    note='节点 = (胶囊外宽 Wt + 8, 40) pt；可见外圈 Wt×32，四周 4 pt 投影边；左右三宫格')
f = recolor(load('name_pill_fill_3s'), None, gray=True).crop((18, 30, 138, 126))
meta['dialog_name_fill_3s'] = dict(px=f.size, bytes=save(f, 'dialog_name_fill_3s'), insets_px=[48, 0, 48, 0], insets_pt=[16, 0, 16, 0],
    note='节点 = (Wt, 32) pt；可见白底 (Wt−4)×28（四周 2 pt 透明边）；Sprite.color = 角色色（夜间再乘 K_UI）')
a = drop(recolor(load('next_arrow'), ORANGE), 1, 1.5, 0.25).crop((9, 15, 63, 57))
meta['dialog_next_arrow'] = dict(px=a.size, bytes=save(a, 'dialog_next_arrow'), anchor=[0.5, 0.5], note='18×14 pt 节点，可见三角 14×10；上下轻跳见 IMPLEMENT §8')
for k, v in meta.items(): v['pt'] = [round(v['px'][0] / PX, 2), round(v['px'][1] / PX, 2)]
json.dump(meta, open(os.path.join(OUT, 'slices.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: (v['px'], v['bytes']) for k, v in meta.items()}, ensure_ascii=False))
