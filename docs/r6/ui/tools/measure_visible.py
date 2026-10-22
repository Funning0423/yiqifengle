# r6-fix v2：按玩家实际能看到的背景区域验收棋盘预览（750×1624），避开托盘、HUD、道具栏。
# 输出：棋盘/背景平均饱和度（HSV S）、亮度、显著性（谱残差法，棋盘/背景，口径同 ui-audit 2026-10-22 metrics.py）、
#       各可见区域中位色与饱和度：草地、树林、左侧房顶（红色像素）、左缘水面。
# 合格线（ui-audit 2026-10-22）：背景饱和度 ≤ 棋盘饱和度；显著性 ≥ 10；白天草地约 135/160/95；房顶饱和度 < 40%；夜间湖色 B ≥ G > R。
# v2.2：加合格判定（ui-audit 2026-10-22/ui-b16-fixes-9d4fcaa8 的 A/B 目标），任一不合格退出码 1。文件名含 night 按夜间判定，或加 --night / --day 强制。
#   v2.3 草地改为 HSV：色相 75–95°、饱和度 27–33%、明度 55–68；夜间加上半屏(y<500 整行)亮度 95–100；离线不到 1 记 WARN。
#   白天：背景 S 22–25% 且 ≤ 棋盘 S；左缘水面 G−R>10 且 B−R>10；显著性 ≥10；亮度差(盘−背景) ≥20；房顶 S <40%
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
    top=np.zeros(a.shape[:2],bool);top[0:500]=1   # 上半屏 = y<500 整行（与验收口径一致，含 HUD）
    out={'top_L':lum[top].mean(),'board_S%':hsv[m][:,1].mean()/2.55,'bg_S%':hsv[bgm][:,1].mean()/2.55,'board_L':lum[m].mean(),'bg_L':lum[bgm].mean(),'saliency':S[m].mean()/S[bgm].mean()}
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
import colorsys
def judge(o,night):
    # 每项 (名称, 实测值, 下限, 上限)；合格且离任一条线不到 1 个单位 → WARN（v2.3）
    S=o['board_S%'];bS=o['bg_S%'];g,gs=o['grass'];w,_=o['water_left'];_,rs=o['roof_left']
    h,_,v=colorsys.rgb_to_hsv(*(np.array(g)/255.0));gh,gv=h*360,v*100
    inf=float('inf');chk=[('背景饱和度 − 棋盘 ≤0',bS-S,-inf,0),('显著性 ≥10',o['saliency'],10,inf),('房顶饱和度 <40%',rs,-inf,40)]
    if night:
        chk+=[('背景亮度 85–95',o['bg_L'],85,95),('上半屏亮度 95–100',o['top_L'],95,100),('水面 B−G ≥8',w[2]-w[1],8,inf),('水面 G−R >0',w[1]-w[0],1e-9,inf)]
    else:
        chk+=[('背景饱和度 22–25%',bS,22,25),('草地色相 75–95°',gh,75,95),('草地饱和度 27–33%',gs,27,33),('草地明度 55–68',gv,55,68),
              ('水面 G−R >10',w[1]-w[0],10+1e-9,inf),('水面 B−R >10',w[2]-w[0],10+1e-9,inf),('亮度差 ≥20',o['board_L']-o['bg_L'],20,inf)]
    allok=True
    for n,val,lo,hi in chk:
        ok=lo<=val<=hi; m=min(val-lo,hi-val); allok&=ok
        print('  %s %s  (%.2f%s)'%('FAIL' if not ok else 'WARN' if m<1 else 'PASS',n,val,'' if not ok else '，余量 %.2f'%m))
    return allok
force=None;files=[]
for a in sys.argv[1:]:
    if a in('--night','--day'): force=a=='--night'
    else: files.append(a)
bad=0
for p in files:
    o=run(p);night=force if force is not None else ('night' in p.split('/')[-1])
    if not judge(o,night): bad+=1
print('合格 %d/%d'%(len(files)-bad,len(files)));sys.exit(1 if bad else 0)
