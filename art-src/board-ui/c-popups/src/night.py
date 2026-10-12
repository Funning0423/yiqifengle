# 夜间乘色预览（propNightWeight = 1，不另渲一套）。python3 night.py <outdir>
# 系数全部取自 creator-build-project/assets/scripts/world-r2/IslandPropsLayout.ts（见 ui_kit.py）：
#   UI / 棋盘道具 Sprite × K_UI = tag.nightFill / tag.fill = #9a8f7f / #f8f2e2 = (0.621, 0.591, 0.562)
#   背景（海 / 天）    × K_SEA = seaNight.tint #7f9fb3 = (0.498, 0.624, 0.702)
#   深色字 → tag.nightText #2b1b0c
import os, sys, subprocess, warnings
warnings.filterwarnings('ignore')
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import numpy as np
from scipy import ndimage
from PIL import Image, ImageFilter, ImageDraw
OUT=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'..')); ND=os.path.join(OUT,'night'); os.makedirs(ND,exist_ok=True)
import ui_kit as K
INP=os.path.join(HERE,'inputs')
final=Image.open(os.path.join(INP,'board_final_tools.png')).convert('RGB')
if os.environ.get('SKIP_BOARD')!='1':   # PM：棋子 v3 / 叶子 A/B 未定，先不重跑棋盘合成 → 默认沿用现有 night/board_night.png
    bg=Image.open(os.path.join(INP,'bg_island_board.jpg')).convert('RGB').resize(final.size,Image.LANCZOS)
    f=np.asarray(final).astype(float); b=np.asarray(bg).astype(float)
    # board/HUD layer = pixels that differ from the background slice; holes filled, edges feathered 1.5 px
    m=np.abs(f-b).max(2)>18
    m=ndimage.binary_closing(m,iterations=3); m=ndimage.binary_fill_holes(m); m=ndimage.binary_opening(m,iterations=1)
    a=np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.GaussianBlur(4))).astype(float)[...,None]/255
    # keep system-UI mock (status bar / capsule / home bar) out of the tint: it is drawn again on top
    # v3.1: tint the final image itself (keeps the tray's soft shadow on the sea), mixing the two coefficients by the board mask
    night=f*(np.array(K.K_SEA)*(1-a)+np.array(K.K_UI)*a)
    im=Image.fromarray(np.clip(night,0,255).astype('uint8')).convert('RGBA'); K.sysui(im)
    im.convert('RGB').save(os.path.join(ND,'board_night.png'),optimize=True)
    day_night=Image.new('RGB',(1520,1664),(246,240,226)); 
    from PIL import ImageDraw
    d=ImageDraw.Draw(day_night)
    day_night.paste(final,(0,40)); day_night.paste(im.convert('RGB'),(770,40))
    d.text((10,6),'白天（(b) v3.1 board_final_tools.png）',font=K.font(26),fill=(70,52,34)); d.text((780,6),'夜间：Sprite × #9f978f（tag 夜间系数），背景 × #7f9fb3（seaNight.tint）',font=K.font(22),fill=(70,52,34))
    day_night.save(os.path.join(ND,'board_day_vs_night.jpg'),quality=88)
# popup at night: rebuild the UI with NIGHT=1 (sprites × K_UI, text = nightText) over the night board
env=dict(os.environ,NIGHT='1',BOARD_IMG=os.path.join(ND,'board_night.png'),ISLAND_IMG='/tmp/cpop_island_night.png')
isl=Image.open('/workspace/yiqifengle/previews/pm-audit/C0_island_T9_props_reference.png').convert('RGBA'); isl=K.mul(isl,K.K_SEA); isl.save('/tmp/cpop_island_night.png')
code=f"""
import sys; sys.argv=['compose.py',{ND!r}]; sys.path.insert(0,{HERE!r})
import compose as C
C.OUT={ND!r}
C.pause(); C.reward(); C.result(True)
"""
subprocess.run([sys.executable,'-c',code],env=env,check=True,cwd=HERE)
for n in ('pause','reward_claim','result_win'): os.replace(os.path.join(ND,n+'.png'),os.path.join(ND,n+'_night.png'))
# side-by-side day / night popup
for n in ('pause','reward_claim','result_win'):
    dn=Image.new('RGB',(1520,1664),(246,240,226)); d=ImageDraw.Draw(dn)
    dn.paste(Image.open(os.path.join(OUT,n+'.png')).convert('RGB'),(0,40)); dn.paste(Image.open(os.path.join(ND,n+'_night.png')).convert('RGB'),(770,40))
    d.text((10,6),'白天',font=K.font(26),fill=(70,52,34)); d.text((780,6),'夜间（propNightWeight=1 乘色；宝箱/星星只乘一半）',font=K.font(26),fill=(70,52,34))
    dn.save(os.path.join(ND,n+'_day_vs_night.jpg'),quality=88)
# contrast report (night)
def lum(c):
    c=[x/255 for x in c]; c=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]; return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(x,y): a,b=lum(x),lum(y); return (max(a,b)+0.05)/(min(a,b)+0.05)
paper_day=(226,222,194); prim_day=(53,113,114)
paper_n=tuple(int(v*k) for v,k in zip(paper_day,K.K_UI)); prim_n=tuple(int(v*k) for v,k in zip(prim_day,K.K_UI))
rep={'K_UI':[round(k,3) for k in K.K_UI],'K_HALF(宝箱/星星)':[round(k,3) for k in K.K_HALF],'K_SEA':[round(k,3) for k in K.K_SEA],
 'day: 深棕字/纸':round(cr((99,63,33),paper_day),2),'day: 白字/主按钮':round(cr((251,248,236),prim_day),2),
 'night: nightText #2b1b0c/纸':round(cr((43,27,12),paper_n),2),'night: 采用字 (30,19,8)/纸':round(cr((30,19,8),paper_n),2),'night: 次要字 (34,23,11)/纸':round(cr((34,23,11),paper_n),2),'night: 青字 (6,30,34)/纸':round(cr((6,30,34),paper_n),2),'day: 次要字/纸':round(cr((118,86,55),paper_day),2),'day: 青字 (38,98,104)/纸':round(cr((38,98,104),paper_day),2),'night: 字(232,226,212)/主按钮':round(cr((232,226,212),prim_n),2),
 'night: 若字也乘色·深棕/纸':round(cr(tuple(int(v*k) for v,k in zip((99,63,33),K.K_UI)),paper_n),2),
 'night: 若字也乘色·白字/主按钮':round(cr(tuple(int(v*k) for v,k in zip((251,248,236),K.K_UI)),prim_n),2)}
import json; json.dump(rep,open(os.path.join(ND,'contrast.json'),'w'),ensure_ascii=False,indent=1); print(rep)
