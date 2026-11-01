# 湖畔切图 + pngquant（同 b-board/src/slices.py 参数）→ out/slices/ + sizes.json；背景两张 JPG q70 渐进 4:2:0（boardpost.background 处理后）
import sys,os,math,json,subprocess
sys.path.insert(0,'/workspace/yiqifengle/work/棋盘UI美术bot/art-src/board-ui/b-board/src'); from boardpost import background as bg_post
from PIL import Image
RAW='/workspace/r6/board/raw'; SL='/workspace/r6/out/slices'; os.makedirs(SL,exist_ok=True); rows=[]
def L(n): return Image.open(os.path.join(RAW,n+'.png')).convert('RGBA')
def save(im,name,group,note=''):
    p=os.path.join(SL,name+'.png'); im.save(p)
    subprocess.run(['pngquant','--force','--skip-if-larger','--quality','70-92','--speed','1','--strip','--output',p,p],check=False)
    rows.append(dict(file=name+'.png',group=group,w=im.width,h=im.height,bytes=os.path.getsize(p),note=note))
for k in ('full','hit','clear'): save(L('obstacle_lily_'+k),'obstacle_lily_'+k,'障碍','160²，与格子同比例、同中心；显示时 ×1.06')
for k in 'ab': save(L('tile_%s_lake'%k),'tile_%s_lake'%k,'格子底座','160²')
tr=L('tray_lake'); f=82/(1080/8.30); tr=tr.resize((round(tr.width*f),round(tr.height*f/math.sin(math.radians(72)))),Image.LANCZOS); save(tr,'tray_frame_lake','托盘','同 tray_frame：750 设计宽 1:1')
for src,name,note in (('/workspace/r6/work/bg_lakeside_board.jpg','bg_lakeside_board.jpg','白天；运行时湖畔棋盘背景是实时 3D，这张只做离线预览/后备'),('/workspace/r6/work/bg_lakeside_board_night.jpg','bg_lakeside_board_night.jpg','夜间，同上')):
    p=os.path.join(SL,name); bg_post(src).save(p,quality=70,optimize=True,progressive=True,subsampling=2)
    rows.append(dict(file=name,group='背景(后备)',w=750,h=1624,bytes=os.path.getsize(p),note=note))
json.dump(rows,open(os.path.join(SL,'sizes.json'),'w'),ensure_ascii=False,indent=1)
for r in rows: print(r['file'],r['w'],r['h'],r['bytes'])
print('total',sum(r['bytes'] for r in rows),'atlas',sum(r['bytes'] for r in rows if not r['group'].startswith('背景')))
