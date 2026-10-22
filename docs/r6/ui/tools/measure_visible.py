# r6-fix v2：按玩家实际能看到的背景区域验收棋盘预览（750×1624），避开托盘、HUD、道具栏。
# 输出：棋盘/背景平均饱和度（HSV S）、亮度、显著性（谱残差法，棋盘/背景，口径同 ui-audit 2026-10-22 metrics.py）、
#       各可见区域中位色与饱和度：草地、树林、左侧房顶（红色像素）、左缘水面。
# 合格线（ui-audit 2026-10-22）：背景饱和度 ≤ 棋盘饱和度；显著性 ≥ 10；白天草地约 135/160/95；房顶饱和度 < 40%；夜间湖色 B ≥ G > R。
# v2.2：加合格判定（ui-audit 2026-10-22/ui-b16-fixes-9d4fcaa8 的 A/B 目标），任一不合格退出码 1。文件名含 night 按夜间判定，或加 --night / --day 强制。
#   白天：背景 S 22–25% 且 ≤ 棋盘 S；草地中位色 135/160/95 每通道 ±12；左缘水面 G−R>10 且 B−R>10；显著性 ≥10；亮度差(盘−背景) ≥20；房顶 S <40%
#   夜间：背景 S ≤ 棋盘 S；背景亮度 85–95；左缘水面 B−G ≥8 且 B≥G>R；显著性 ≥10；房顶 S <40%
#   房顶取样 = 左缘 x<52 (y440–860) + 托盘上方 x52–140 (y440–505)，两块合并（v2 漏了后者）。
# python3 measure_visible.py [--night|--day] IMG.png [...]
import sys,numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter,gaussian_filter
BOARD=(52,505,697,1150)                     # x0,y0,x1,y1 托盘（与验收脚本一致）
REG={'grass':(40,1160,710,1340),'trees':(0,330,750,430),'roof_left':[(0,440,52,860),(52,440,140,505)],'water_left':(0,680,44,780)}
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
    for k,box in REG.items():
        boxes=box if isinstance(box,list) else [box]
        px=np.concatenate([a[y0:y1,x0:x1].reshape(-1,3) for x0,y0,x1,y1 in boxes]);hs=np.concatenate([hsv[y0:y1,x0:x1].reshape(-1,3) for x0,y0,x1,y1 in boxes])
        if k=='roof_left':
            h=hs[:,0]*360/255;sel=((h<40)|(h>330))&(hs[:,1]>40)&(hs[:,2]>60)
            if sel.sum()<20: sel=np.ones(len(px),bool)
            px,hs=px[sel],hs[sel]
        c=np.median(px,0);out[k]=(c,hs[:,1].mean()/2.55);print('  %-10s 中位色 %3d/%3d/%3d  饱和度 %.1f%%  (n=%d)%s'%(k,*c,hs[:,1].mean()/2.55,len(px),'  B≥G>R' if c[2]>=c[1]>c[0] else ''))
    return out
def judge(o,night):
    S=o['board_S%'];bS=o['bg_S%'];g,_=o['grass'];w,_=o['water_left'];_,rs=o['roof_left'];chk=[]
    chk.append(('背景饱和度 ≤ 棋盘',bS<=S,'%.1f ≤ %.1f'%(bS,S)))
    chk.append(('显著性 ≥10',o['saliency']>=10,'%.2f'%o['saliency']))
    chk.append(('房顶饱和度 <40%',rs<40,'%.1f%%'%rs))
    if night:
        chk.append(('背景亮度 85–95',85<=o['bg_L']<=95,'%.1f'%o['bg_L']))
        chk.append(('水面 B−G ≥8 且 B≥G>R',w[2]-w[1]>=8 and w[2]>=w[1]>w[0],'%d/%d/%d'%tuple(w)))
    else:
        chk.append(('背景饱和度 22–25%',22<=bS<=25,'%.1f'%bS))
        chk.append(('草地 135/160/95 ±12',all(abs(g[i]-t)<=12 for i,t in enumerate((135,160,95))),'%d/%d/%d'%tuple(g)))
        chk.append(('水面 G−R>10 且 B−R>10',w[1]-w[0]>10 and w[2]-w[0]>10,'%d/%d/%d'%tuple(w)))
        chk.append(('亮度差 ≥20',o['board_L']-o['bg_L']>=20,'%.1f'%(o['board_L']-o['bg_L'])))
    for n,okk,v in chk: print('  %s %s  (%s)'%('PASS' if okk else 'FAIL',n,v))
    return all(c[1] for c in chk)
force=None;files=[]
for a in sys.argv[1:]:
    if a in('--night','--day'): force=a=='--night'
    else: files.append(a)
bad=0
for p in files:
    o=run(p);night=force if force is not None else ('night' in p.split('/')[-1])
    if not judge(o,night): bad+=1
print('合格 %d/%d'%(len(files)-bad,len(files)));sys.exit(1 if bad else 0)
