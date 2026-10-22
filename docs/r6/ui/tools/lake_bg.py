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
BLUR=36                      # px @750；v2 起不受引擎 10 点约束，大模糊把背景细节压掉（显著性主要来自树林、房顶的边缘）
DAY_SAT,DAY_VAL,FOG,FOG_RGB=0.40,0.90,0.16,(250,246,236)   # 明度 ×0.90 而不是 ×1.08：×1.08 时草地 169/189/133，离验收目标 135/160/95 更远
ROOF_BOX=(0,440,140,860); ROOF_SMAX,ROOF_DARK=0.36,0.92      # 左侧红房顶所在区域（750 宽 px），约 y230–450pt
NIGHT=(0.42,0.52,0.68); NIGHT_LIFT=(28,32,46); NIGHT_SAT=0.5   # 夜间整体比 cd5545d 提亮到旧版夜间的亮度水平（背景 L≈99），否则显著性只有 8.8
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
def day(b):
    d=hsv_scale(b,DAY_SAT,DAY_VAL); d=roof_fix(d)
    d=Image.blend(d,Image.new('RGB',(W,H),FOG_RGB),FOG)
    return d.filter(ImageFilter.GaussianBlur(BLUR))
def night(b):
    b=roof_fix(b).filter(ImageFilter.GaussianBlur(BLUR)); r,g,bl=b.split()
    n=Image.merge('RGB',[c.point(lambda v,k=k,l=l:min(255,int(v*k+l))) for c,k,l in zip((r,g,bl),NIGHT,NIGHT_LIFT)])
    return keep_value_desat(n,NIGHT_SAT)
if __name__=='__main__':
    b=base()
    for im,name in ((day(b),'bg_lakeside_board.jpg'),(night(b),'bg_lakeside_board_night.jpg')):
        p=os.path.join(OUT,name); im.save(p,quality=70,optimize=True,progressive=True,subsampling=2); print(name,os.path.getsize(p))
