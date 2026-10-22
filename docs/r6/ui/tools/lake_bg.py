# r6-fix：湖畔棋盘背景从引擎机位的实际场景配色生成（水 / 岸 / 天空都取自 ENGINE_COLOR_REFERENCE/engine_cam_r5h3 的 graded 参考），
# 不再走 boardpost.background 的「强模糊 + 降饱和 + 32% 白雾」（那一步把湖水从 83/128/128 洗成 150/170/163，是 sample.py FAIL 的主因）。
# 只做轻模糊让背景退后，不加任何元素。夜间按 REFERENCE.md 规则（湖心读作暗蓝青，B ≥ G > R）由白天逐通道压暗得到。
# python3 lake_bg.py [REF_PNG] [OUTDIR]
import sys,os
from PIL import Image,ImageFilter
REF=sys.argv[1] if len(sys.argv)>1 else os.environ.get('LAKE_REF','/workspace/wechat-game/art/regions/lakeside/ENGINE_COLOR_REFERENCE/engine_cam_r5h3/ref_390x844_graded.png')
OUT=sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','slices')
W,H=750,1624
BLUR=3                       # px @750；更大的模糊会让桥栏 sample 点（8px 框）超出 ±12（实测 4 → −24）
NIGHT=(0.30,0.40,0.56)       # 夜间逐通道乘色：与 UI 夜间乘色 #b8bfd6 同向（偏蓝），整体更暗
NIGHT_LIFT=(6,10,22)         # 暗部抬一点蓝，避免死黑
def day():
    return Image.open(REF).convert('RGB').resize((W,H),Image.LANCZOS).filter(ImageFilter.GaussianBlur(BLUR))
def night(d):
    r,g,b=d.split()
    ch=[c.point(lambda v,k=k,l=l:min(255,int(v*k+l))) for c,k,l in zip((r,g,b),NIGHT,NIGHT_LIFT)]
    return Image.merge('RGB',ch)
if __name__=='__main__':
    d=day(); n=night(d)
    for im,name in ((d,'bg_lakeside_board.jpg'),(n,'bg_lakeside_board_night.jpg')):
        p=os.path.join(OUT,name); im.save(p,quality=70,optimize=True,progressive=True,subsampling=2); print(name,os.path.getsize(p))
