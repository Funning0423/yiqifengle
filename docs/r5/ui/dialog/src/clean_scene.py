"""真机截图去掉旧版过场字幕胶囊「正在回屋…」（WorldIntegrationBoot 旧 transitionText，当前分支已删）。
源：evidence-mac/evidence/near/native/11-return-7s.jpg（真机，586×1266 = 390×844 pt × 1.503）。
天空在水平方向几乎一致：color(x,y) = 行均值(y) + (该列在胶囊上方的颜色 − 行均值(上方))；行均值取胶囊左右两侧露出来的天空。
帽顶（暖黄）像素保留。"""
from PIL import Image
SRC = '/workspace/yiqifengle/evidence-mac/evidence/near/native/11-return-7s.jpg'
im = Image.open(SRC).convert('RGB'); px = im.load()
Y0, Y1, X0, X1, REF = 168, 219, 44, 542, 164
side = [x for x in list(range(4, 40)) + list(range(548, 582))]
def rowmean(y): return [sum(px[x, y][i] for x in side) / len(side) for i in range(3)]
mref = rowmean(REF); rows = {y: rowmean(y) for y in range(Y0, Y1 + 1)}
for x in range(X0, X1):
    off = [px[x, REF][i] - mref[i] for i in range(3)]
    for y in range(Y0, Y1 + 1):
        c = px[x, y]
        if y >= 204 and c[0] > 150 and c[0] - c[2] > 45: continue   # 草帽（暖黄，蓝分量明显低）
        px[x, y] = tuple(max(0, min(255, round(rows[y][i] + off[i]))) for i in range(3))
for x in range(X0, X1):   # 残留的浅色字边（不在帽子上）
    off = [px[x, REF][i] - mref[i] for i in range(3)]
    for y in range(Y0, Y1 + 1):
        c = px[x, y]
        if sum(c) > 400 and not (c[0] > 150 and c[0] - c[2] > 45 and y >= 206):
            px[x, y] = tuple(max(0, min(255, round(rows[y][i] + off[i]))) for i in range(3))
im.save('scene_390_clean.png')
