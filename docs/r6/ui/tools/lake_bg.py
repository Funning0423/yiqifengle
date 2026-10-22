# r6-fix v2：湖畔棋盘背景（离线预览 / 后备图）。
# 底图取引擎机位 graded 参考（水、岸、天空的实际配色），然后按「背景要往后退」处理，不加任何元素：
#   白天：HSV 饱和度 ×0.40，明度 ×0.90，叠 16% 暖白雾 #faf6ec；左侧红房顶局部再降饱和（≤0.36）并压暗 8%；36px 模糊（v2.1：L13 显著性 9.77→10.27）。
#   夜间：底图（房顶同样处理、36px 模糊）逐通道乘偏蓝夜色 (0.42,0.52,0.68)+(20,24,36)，再饱和度 ×0.5（这一步明度不变；v2.1 抬亮暗部 (28,32,46)，L13 夜间显著性 9.73→10.34）；湖色保持 B ≥ G > R。
# 验收看玩家可见区域（tools/measure_visible.py），不再用引擎 10 点（那 10 点里 9 个在托盘下面，且目标就是源图本身）。
# python3 lake_bg.py [REF_PNG] [OUTDIR]
import sys,os,numpy as np
from PIL import Image,ImageFilter
REF=sys.argv[1] if len(sys.argv)>1 else os.environ.get('LAKE_REF','/workspace/wechat-game/art/regions/lakeside/ENGINE_COLOR_REFERENCE/engine_cam_r5h3/ref_390x844_graded.png')
OUT=sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slices')
W,H=750,1624
BLUR=20                      # px @750；v2 起不受引擎 10 点约束，大模糊把背景细节压掉（显著性主要来自树林、房顶的边缘）
DAY_SAT,DAY_VAL,FOG,FOG_RGB=0.33,0.88,0.06,(250,246,236)   # 明度 ×0.90 而不是 ×1.08：×1.08 时草地 169/189/133，离验收目标 135/160/95 更远   # v2.4：DAY_SAT 0.38→0.33（托盘框改实际位置后，y1092–1150 的草地计入背景，背景饱和度 25.4 超线；只降饱和不提亮）
ROOF_BOX=(0,440,140,860); ROOF_SMAX,ROOF_DARK=0.36,0.92      # 左侧红房顶所在区域（750 宽 px），约 y230–450pt
NIGHT=(0.42,0.52,0.68); NIGHT_LIFT=(14,18,30); NIGHT_SAT=0.6   # 夜间整体比 cd5545d 提亮到旧版夜间的亮度水平（背景 L≈99），否则显著性只有 8.8
def hsv_scale(im,sat=1.0,val=1.0):
    h,s,v=[np.asarray(c).astype(float) for c in im.convert('HSV').split()]
    s=np.clip(s*sat,0,255); v=np.clip(v*val,0,255)
    return Image.merge('HSV',[Image.fromarray(x.astype(np.uint8)) for x in (h,s,v)]).convert('RGB')
def keep_value_desat(im,k):
    # 饱和度 ×k，明度（HSV V）不变
    return hsv_scale(im,k,1.0)
def roof_fix(im):
    hsv=np.asarray(im.convert('HSV')).astype(float); h,s,v=hsv[...,0]*360/255,hsv[...,1]/255,hsv[...,2]
    x0,y0,x1,y1=ROOF_BOX; m=np.zeros(h.shape,bool); m[y0:y1,x0:x1]=True
    red=m&((h<40)|(h>330))&(s>ROOF_SMAX)
    s=np.where(red,ROOF_SMAX,s); v=np.where(red,v*ROOF_DARK,v)
    out=np.stack([hsv[...,0],s*255,v],-1).clip(0,255).astype(np.uint8)
    return Image.fromarray(out,'HSV').convert('RGB')
def base():
    return Image.open(REF).convert('RGB').resize((W,H),Image.LANCZOS)
LAKE_BAND=(600,860,60); LAKE_RGB=(92,140,150); LAKE_K=0.40   # v2.2：湖面带（750 宽 px 的 y0,y1,羽化）向湖青色混 40%，让左缘露出的水面读作蓝绿而不是灰橄榄
def lake_tint(d,k):
    a=np.asarray(d).astype(float); y=np.arange(H)[:,None]; y0,y1,f=LAKE_BAND
    m=np.clip(np.minimum(y-y0,y1-y)/f,0,1)*k; a=a*(1-m[...,None])+np.array(LAKE_RGB)*m[...,None]
    return Image.fromarray(a.clip(0,255).astype(np.uint8))
import os as _os
DAY_CONTRAST=0.92   # v2.3：0.85→0.92（暗部别抬灰）（围绕全图均值），压低背景显著性
SOFT_K,SOFT_BLUR=0.35,32   # v2.3：远景大模糊混入 0.35、半径 32，只作用在 y<420（v2.2 0.7/48 全屏，远景过糊）
SOFT_Y,SOFT_F=420,40
TREE_BOX,TREE_SAT=(0,0,750,505),0.55   # v2.4：远景饱和度 0.6→0.55
TREE_CONTRAST=0.75   # v2.3：远景（y<505）明暗对比压缩系数，补显著性；显著性按灰度算，降饱和补不了
for _k in ('DAY_SAT','DAY_VAL','FOG','BLUR','LAKE_K','NIGHT_SAT','SOFT_K','DAY_CONTRAST','TREE_SAT','TREE_CONTRAST'):
    if _os.environ.get('LB_'+_k): globals()[_k]=float(_os.environ['LB_'+_k])
BLUR=int(BLUR)
GRASS_Y,GRASS_F,GRASS_MUL=1080,80,(1.0,1.03,0.95)   # v2.2：前景草地回暖（B 压低），目标约 135/160/95
def grass_warm(d):
    a=np.asarray(d).astype(float); y=np.arange(H)[:,None]; m=np.clip((y-GRASS_Y)/GRASS_F,0,1)[...,None]
    a=a*(1+(np.array(GRASS_MUL)-1)*m); return Image.fromarray(a.clip(0,255).astype(np.uint8))
def day(b):
    d=hsv_scale(b,DAY_SAT,DAY_VAL); d=roof_fix(d); d=lake_tint(d,LAKE_K); d=grass_warm(d); d=tree_desat(d,TREE_SAT)
    d=Image.blend(d,Image.new('RGB',(W,H),FOG_RGB),FOG)
    d=soft(d); a=np.asarray(d).astype(float); mu=a.reshape(-1,3).mean(0)
    return Image.fromarray((mu+DAY_CONTRAST*(a-mu)).clip(0,255).astype(np.uint8))   # v2.2：背景整体对比压到 DAY_CONTRAST
def soft(d):
    a=np.asarray(d.filter(ImageFilter.GaussianBlur(BLUR))).astype(float)
    b=np.asarray(d.filter(ImageFilter.GaussianBlur(SOFT_BLUR))).astype(float)
    y=np.arange(H)[:,None]; w=(np.clip((SOFT_Y-y)/SOFT_F,0,1)*SOFT_K)[...,None]   # 只在 y<420 混入大模糊，380–420 羽化
    return Image.fromarray((a*(1-w)+b*w).clip(0,255).astype(np.uint8))
def tree_desat(d,k):
    if k>=1 and TREE_CONTRAST>=1: return d
    x0,y0,x1,y1=TREE_BOX; top=d.crop(TREE_BOX); t=hsv_scale(top,k,1.0)
    if TREE_CONTRAST<1: ta=np.asarray(t).astype(float); mu=ta.reshape(-1,3).mean(0); t=Image.fromarray((mu+TREE_CONTRAST*(ta-mu)).clip(0,255).astype(np.uint8))   # 远景明暗对比压缩（不是模糊）
    m=Image.linear_gradient('L').resize((x1-x0,y1-y0)).point(lambda v:255 if v<200 else int((255-v)*255/55)); out=d.copy(); out.paste(t,(x0,y0),m); return out
NIGHT_LAKE_RGB,NIGHT_LAKE_K,NIGHT_CONTRAST=(40,66,100),0.45,0.70   # v2.2 夜间：湖面带混深蓝青（B 比 G 高 8 以上），对比压到 0.70
for _k in ('NIGHT_LAKE_K','NIGHT_CONTRAST'):
    if _os.environ.get('LB_'+_k): globals()[_k]=float(_os.environ['LB_'+_k])
def night(b):
    b=roof_fix(b); r,g,bl=b.split()
    n=Image.merge('RGB',[c.point(lambda v,k=k,l=l:min(255,int(v*k+l))) for c,k,l in zip((r,g,bl),NIGHT,NIGHT_LIFT)])
    n=keep_value_desat(n,NIGHT_SAT); n=tree_desat(n,NIGHT_TREE_SAT)
    a=np.asarray(n).astype(float); y=np.arange(H)[:,None]; y0,y1,f=LAKE_BAND
    m=(np.clip(np.minimum(y-y0,y1-y)/f,0,1)*NIGHT_LAKE_K)[...,None]; a=a*(1-m)+np.array(NIGHT_LAKE_RGB)*m
    n=soft(Image.fromarray(a.clip(0,255).astype(np.uint8))); a=np.asarray(n).astype(float); mu=a.reshape(-1,3).mean(0)
    a=mu+NIGHT_CONTRAST*(a-mu); t=(1-(1-NIGHT_TOP)*np.clip((NIGHT_TOP_Y-y)/60,0,1))[...,None]   # v2.3：夜间上半屏（y<500，440–500 羽化）亮度 ×0.85
    return Image.fromarray((a*t).clip(0,255).astype(np.uint8))
NIGHT_TOP,NIGHT_TOP_Y=0.85,500
NIGHT_TREE_SAT=float(_os.environ.get('LB_NIGHT_TREE_SAT','0.55'))   # v2.4：0.6→0.55
if __name__=='__main__':
    b=base()
    for im,name in ((day(b),'bg_lakeside_board.jpg'),(night(b),'bg_lakeside_board_night.jpg')):
        p=os.path.join(OUT,name); im.save(p,quality=70,optimize=True,progressive=True,subsampling=2); print(name,os.path.getsize(p))
