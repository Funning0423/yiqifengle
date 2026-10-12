import os, json
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',22); FB=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',26)
V=Image.open(os.environ.get('V12_REF') or os.path.join(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'),'reference/character-ankle-balanced-v12.jpg')).convert('RGB')
VH={'front':(225,40,415,230),'side':(665,40,855,230),'back':(1125,40,1315,230)}
VB={'front':(120,20,520,1010),'side':(560,20,960,1010),'back':(1020,20,1420,1010)}
VF={'front':(262,92,378,208),'side':(700,92,816,208)}
def fit(im,w,h,bg=(214,218,226)):
    k=min(w/im.width,h/im.height); im=im.resize((int(im.width*k),int(im.height*k)),Image.LANCZOS); c=Image.new('RGB',(w,h),bg); c.paste(im,((w-im.width)//2,(h-im.height)//2)); return c
def sheet(title,cols,rows,cw,ch,out,lw=150):
    # DROPREF: no FILM_REF -> drop the empty '参考图' column
    _k=[i for i,c in enumerate(cols) if not (c.startswith('参考图') and all(len(r[1])<=i or r[1][i] is None for r in rows))]
    cols=[cols[i] for i in _k]; rows=[(l,[ims[i] for i in _k if i<len(ims)]) for l,ims in rows]
    W=lw+cw*len(cols); H=50+34+ch*len(rows); S=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(S)
    d.text((12,10),title,fill=(20,20,20),font=FB)
    for i,c in enumerate(cols): d.text((lw+i*cw+8,52),c,fill=(60,60,60),font=F)
    for r,(lab,ims) in enumerate(rows):
        y=84+r*ch; d.multiline_text((10,y+ch//2-24),lab,fill=(30,30,30),font=F,spacing=4)
        for i,im in enumerate(ims):
            if im is None: continue
            S.paste(fit(im if isinstance(im,Image.Image) else Image.open(im).convert('RGB'),cw-6,ch-6),(lw+i*cw+3,y+3))
    S.save(out)
    # share jpg <200KB
    sh=os.path.join(os.path.dirname(os.path.dirname(out)),'share'); os.makedirs(sh,exist_ok=True)
    base=os.path.join(sh,os.path.basename(out).replace('.png','.jpg')); im=S.convert('RGB'); q=85; sc=1.0
    while True:
        t=im if sc==1 else im.resize((int(im.width*sc),int(im.height*sc)),Image.LANCZOS)
        t.save(base,quality=q,optimize=True)
        if os.path.getsize(base)<195000: break
        if q>65: q-=8
        else: sc*=0.85
    print(out,S.size,'share',os.path.getsize(base)//1024,'KB')
def v12(box): return V.crop(box)
def lab(text,im):
    im=Image.open(im).convert('RGB') if isinstance(im,str) else im
    d=ImageDraw.Draw(im); d.text((8,6),text,fill=(30,30,30),font=F); return im
R='raw'
HD='../head-r2/previews'; BD='../body-r1/previews'
os.makedirs(HD,exist_ok=True); os.makedirs(BD,exist_ok=True)
NA='（V12 无此角度，\n放正面作参考）'
# ---- head
sheet('头部 R2 对比：V12 / e60 原版 / R1 / R2（正面·侧面·背面）',['正面','侧面（她的左侧）','背面'],
  [('V12',[v12(VH['front']),v12(VH['side']),v12(VH['back'])]),('e60 原版',[f'{R}/e60/H_{k}.png' for k in('front','side','back')]),
   ('头部 R1',[f'{R}/r1/H_{k}.png' for k in('front','side','back')]),('头部 R2\n（本轮）',[f'{R}/new/H_{k}.png' for k in('front','side','back')])],
  400,400,f'{HD}/01_head_V12_e60_R1_R2_front_side_back.png')
sheet('头部 R2 对比：3/4 与俯 30° 游戏机位',['3/4（35°）','俯 30° 游戏机位'],
  [('V12'+NA,[v12(VH['front']),v12(VH['front'])]),('e60 原版',[f'{R}/e60/H_q34.png',f'{R}/e60/H_game.png']),('头部 R1',[f'{R}/r1/H_q34.png',f'{R}/r1/H_game.png']),('头部 R2',[f'{R}/new/H_q34.png',f'{R}/new/H_game.png'])],
  400,400,f'{HD}/02_head_q34_gamecam30_V12_R1_R2.png',lw=190)
sheet('脸部特写：V12 / R1 / R2',['正面','3/4','侧面'],
  [('V12',[v12(VF['front']),None,v12(VF['side'])]),('头部 R1',[f'{R}/r1/F_{k}.png' for k in('front','q34','side')]),('头部 R2',[f'{R}/new/F_{k}.png' for k in('front','q34','side')])],
  400,400,f'{HD}/03_face_closeup_V12_R1_R2.png')
sheet('眨眼三帧（同一网格，只改眼片 UV 偏移）',['睁眼 open (0,0)','半闭 half (0,+0.5)','闭眼 closed (+0.5,0)'],
  [('R2',[f'{R}/blink/{k}.png' for k in('open','half','closed')])],400,400,f'{HD}/04_blink_3_frames.png')
sheet('头部 R2 线框',['正面线框','侧面线框'],[('R2',[f'{R}/new/F_wire.png',f'{R}/new/F_wire_side.png'])],450,450,f'{HD}/05_head_wireframe.png')
fa=Image.open('../head-r2/tex/face_atlas_preview.png').convert('RGB').resize((600,600))
hd=Image.open('../head-r2/tex/T_G2_HEAD.jpg').convert('RGB').resize((600,600))
sheet('贴图：T_G2_FACE（脸 + 眨眼格 + 衣服色块）/ T_G2_HEAD（帽子 + 头发渐变）',['T_G2_FACE 1024','T_G2_HEAD 512'],[('',[fa,hd])],620,620,f'{HD}/06_textures.png',lw=10)
# ---- body
sheet('全身对比：V12 / e60 原版 / 本轮（头 R2 + 上身 R1）',['正面','侧面','背面'],
  [('V12',[v12(VB['front']),v12(VB['side']),v12(VB['back'])]),('e60 原版',[f'{R}/e60/B_{k}.png' for k in('front','side','back')]),('本轮',[f'{R}/new/B_{k}.png' for k in('front','side','back')])],
  380,600,f'{BD}/01_fullbody_V12_e60_new_front_side_back.png')
sheet('全身：3/4 与俯 30° 游戏机位',['3/4','俯 30°'],
  [('V12'+NA,[v12(VB['front']),v12(VB['front'])]),('e60 原版',[f'{R}/e60/B_q34.png',f'{R}/e60/B_game.png']),('本轮',[f'{R}/new/B_q34.png',f'{R}/new/B_game.png'])],
  380,600,f'{BD}/02_fullbody_q34_gamecam30.png',lw=190)
sheet('上身：e60 原版 / 本轮（领口、衣身、肩线、泡泡袖）',['正面','正面（隐藏围裙）','侧面','背面','3/4 线框（隐藏围裙）'],
  [('e60 原版',[f'{R}/e60/U_{k}.png' for k in('front','front_noapron','side','back','wire')]),('本轮',[f'{R}/new/U_{k}.png' for k in('front','front_noapron','side','back','wire')])],
  360,360,f'{BD}/03_upper_body_e60_vs_new.png')
sheet('肩 / 袖特写（隐藏围裙）',['肩 正面','肩 3/4','肩 后','腋下','肘内侧','袖口克夫'],
  [('e60 原版',[f'{R}/e60/S_{k}.png' for k in('shoulder_front','shoulder_q34','shoulder_back','armpit','elbow_in','cuff')]),('本轮',[f'{R}/new/S_{k}.png' for k in('shoulder_front','shoulder_q34','shoulder_back','armpit','elbow_in','cuff')])],
  320,320,f'{BD}/04_shoulder_sleeve_closeups.png')
sheet('手（放松微握）',['外侧（手背）','正面','内侧（手心）'],
  [('e60 原版',[f'{R}/e60/S_hand_{k}.png' for k in('out','front','in')]),('本轮',[f'{R}/new/S_hand_{k}.png' for k in('out','front','in')])],
  360,360,f'{BD}/05_hands.png')
for v in ('front','side','q34'):
    rows=[]
    for f,t in ((1,'f1 左手最前'),(10,'f10 右袖离围裙最近'),(14,'f14 左手最后'),(24,'f24 左袖离围裙最近')):
        rows.append((t,[f'{R}/walk_old/f{f}/{v}.png',f'{R}/walk_new/f{f}/{v}.png']))
    pass
cols=[]; ims=[]
rows=[]
for f,t in ((1,'f1\n左手最前'),(10,'f10\n右袖最近围裙'),(14,'f14\n左手最后'),(24,'f24\n左袖最近围裙')):
    rows.append((t,[f'{R}/walk_old/f{f}/front.png',f'{R}/walk_new/f{f}/front.png',f'{R}/walk_old/f{f}/side.png',f'{R}/walk_new/f{f}/side.png']))
sheet('走路 v2 摆臂极限帧：e60 原版 vs 本轮',['正面 原版','正面 本轮','侧面 原版','侧面 本轮'],rows,330,400,f'{BD}/06_walk_v2_extreme_frames_old_vs_new.png')
