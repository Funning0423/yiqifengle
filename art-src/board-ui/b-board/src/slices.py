# Export runtime slices + pngquant, write sizes.json.  python3 slices.py <raw_dir> <bg_raw> <outdir>
import sys,os,math,json,subprocess
sys.path.insert(0,os.path.dirname(__file__)); from boardpost import focus_grade, background as bg_post
from PIL import Image, ImageFilter, ImageEnhance
RAW,BGRAW,OUT=sys.argv[1:4]; SL=os.path.join(OUT,'slices'); os.makedirs(SL,exist_ok=True)
def L(n): return Image.open(os.path.join(RAW,n+'.png')).convert('RGBA')
rows=[]
def save(im,name,group,note=''):
    p=os.path.join(SL,name+'.png'); im.save(p)
    subprocess.run(['pngquant','--force','--skip-if-larger','--quality','70-92','--speed','1','--strip','--output',p,p],check=False)
    rows.append(dict(file=name+'.png',group=group,w=im.width,h=im.height,bytes=os.path.getsize(p),note=note))
for k in ['strawberry','leaf','blueberry','flower','acorn','shell']: save(focus_grade(L('piece_'+k)),'piece_'+k,'棋子','192², 171 px/格单位；焦点调色')
for k in ['line_h','line_v','bomb']: save(focus_grade(L('special_'+k)),'special_'+k,'特殊块','308², 与棋子同比例、同中心')
for k in ['moss','roots','shell_2','shell_1']: save(L('obstacle_'+k),'obstacle_'+k,'障碍','160², 与格子同比例、同中心')
for k in 'ab': save(L('tile_'+k),'tile_'+k,'格子底座','160²')
tr=L('tray'); f=82/(1080/8.30); tr=tr.resize((round(tr.width*f),round(tr.height*f/math.sin(math.radians(72)))),Image.LANCZOS)
save(tr,'tray_frame','托盘','750 设计宽下 1:1；格距 82px')
for n in ['icon_moves']:
    im=L(n); im=im.crop(im.getbbox()); save(im,n,'托盘/HUD')
p=L('hud_pause'); p=p.crop(p.getbbox()); save(p,'hud_pause','HUD')
pl=L('hud_levelplate'); pl=pl.crop(pl.getbbox()); pl=pl.resize((411,round(pl.height*411/pl.width)),Image.LANCZOS); save(pl,'hud_levelplate','HUD','可九宫格拉伸')
for n in ['tool_starlight','tool_windbell','tool_tidebottle']: save(focus_grade(L(n)),n,'道具','192²；无货用 Sprite.grayscale；焦点调色')
# background
soft=bg_post(BGRAW)
bp=os.path.join(SL,'bg_island_board.jpg'); soft.save(bp,quality=70,optimize=True,progressive=True,subsampling=2)
rows.append(dict(file='bg_island_board.jpg',group='背景',w=750,h=1624,bytes=os.path.getsize(bp),note='v2 更虚更淡；JPG q70 渐进'))
json.dump(rows,open(os.path.join(OUT,'slices','sizes.json'),'w'),ensure_ascii=False,indent=1)
tot={}
for r in rows: tot[r['group']]=tot.get(r['group'],0)+r['bytes']
print(json.dumps(tot,ensure_ascii=False),'total_excl_candidate',sum(r['bytes'] for r in rows if r['group']!='棋子·候选'))
for r in rows: print(r['file'],r['w'],r['h'],r['bytes'])
