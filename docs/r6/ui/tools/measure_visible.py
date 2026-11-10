# r6-fix v2：按玩家实际能看到的背景区域验收棋盘预览（750×1624），避开托盘、HUD、道具栏。
# 输出：棋盘/背景平均饱和度（HSV S）、亮度、显著性（谱残差法，棋盘/背景，口径同 ui-audit 2026-10-22 metrics.py）、
#       各可见区域中位色与饱和度：草地、树林、左侧房顶（红色像素）、左缘水面。
# 合格线（ui-audit 2026-10-22）：背景饱和度 ≤ 棋盘饱和度；显著性 ≥ 10；白天草地约 135/160/95；房顶饱和度 < 40%；夜间湖色 B ≥ G > R。
# python3 measure_visible.py IMG.png [...]
import sys,numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter,gaussian_filter
BOARD=(52,505,697,1150)                     # x0,y0,x1,y1 托盘（与验收脚本一致）
REG={'grass':(40,1160,710,1340),'trees':(0,330,750,430),'roof_left':(0,440,52,860),'water_left':(0,680,44,780)}
def sal(g):
    F=np.fft.fft2(g);L=np.log(np.abs(F)+1e-9);P=np.angle(F);R=L-uniform_filter(L,3)
    return gaussian_filter(np.abs(np.fft.ifft2(np.exp(R+1j*P)))**2,3)
def run(p):
    im=Image.open(p).convert('RGB');a=np.asarray(im).astype(float);hsv=np.asarray(im.convert('HSV')).astype(float)
    m=np.zeros(a.shape[:2],bool);x0,y0,x1,y1=BOARD;m[y0:y1,x0:x1]=1
    bgm=~m;bgm[0:380]=0;bgm[1350:1520]=0
    lum=a@[.2126,.7152,.0722]
    sm=np.asarray(im.resize((188,406)).convert('L')).astype(float)
    S=sal(sm);S=np.array(Image.fromarray(S.astype(np.float32)).resize((750,1624)));S=S/S.sum()
    out={'board_S%':hsv[m][:,1].mean()/2.55,'bg_S%':hsv[bgm][:,1].mean()/2.55,'board_L':lum[m].mean(),'bg_L':lum[bgm].mean(),'saliency':S[m].mean()/S[bgm].mean()}
    print('%s\n  饱和度 棋盘 %.1f%%  背景 %.1f%%   亮度 棋盘 %.1f 背景 %.1f   显著性(盘/背景) %.2f'%(p.split('/')[-1],out['board_S%'],out['bg_S%'],out['board_L'],out['bg_L'],out['saliency']))
    for k,(x0,y0,x1,y1) in REG.items():
        px=a[y0:y1,x0:x1].reshape(-1,3);hs=hsv[y0:y1,x0:x1].reshape(-1,3)
        if k=='roof_left':
            h=hs[:,0]*360/255;sel=((h<40)|(h>330))&(hs[:,1]>40)&(hs[:,2]>60)
            if sel.sum()<20: sel=np.ones(len(px),bool)
            px,hs=px[sel],hs[sel]
        c=np.median(px,0);print('  %-10s 中位色 %3d/%3d/%3d  饱和度 %.1f%%  (n=%d)%s'%(k,*c,hs[:,1].mean()/2.55,len(px),'  B≥G>R' if c[2]>=c[1]>c[0] else ''))
    return out
for p in sys.argv[1:]: run(p)
