import os, json
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',22); FB=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',26)
V=Image.open(os.environ.get('V12_REF') or os.path.join(os.path.join(os.path.dirname(os.path.abspath(__file__)),'../..'),'reference/character-ankle-balanced-v12.jpg')).convert('RGB')
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

R='raw'; OD='../previews'; os.makedirs(OD,exist_ok=True)
_fr=os.environ.get('FILM_REF',''); FR=Image.open(_fr).convert('RGB') if _fr and os.path.exists(_fr) else None
k=FR.width/577 if FR else 1
def ref(b): return FR.crop(tuple(int(x*k) for x in b)) if FR else None
RF={'full':(140,420,340,745),'upper':(150,430,330,600),'sleeve':(150,470,310,570),'hand':(140,495,215,545),'legs':(225,640,310,740)}
VU={'front':(120,130,520,560),'side':(560,130,960,560)}
VS={'front':(90,170,330,520),'side':(620,170,860,520)}
VHd={'front':(100,470,190,600),'side':(745,465,820,575)}
VL={'front':(230,690,430,1010),'side':(680,690,880,1010)}
C=['e60 原版','body-r2（本轮）','V12','参考图（草坡画画）']
N=lambda t:t
sheet('上身对比：e60 / 本轮 / V12 / 参考图',C,
 [('正面',[f'{R}/e60/U_front.png',f'{R}/new/U_front.png',v12(VU['front']),ref(RF['upper'])]),
  ('侧面',[f'{R}/e60/U_side.png',f'{R}/new/U_side.png',v12(VU['side']),ref(RF['upper'])]),
  ('3/4',[f'{R}/e60/U_q34.png',f'{R}/new/U_q34.png',v12(VU['front']),ref(RF['upper'])])],400,400,f'{OD}/01_upper_body_e60_r2_V12_ref.png',lw=90)
sheet('肩和袖特写：e60 / 本轮 / V12 / 参考图（围裙隐藏）',C,
 [('肩·正面',[f'{R}/e60/S_shoulder_front.png',f'{R}/new/S_shoulder_front.png',v12(VS['front']),ref(RF['sleeve'])]),
  ('肩·3/4',[f'{R}/e60/S_shoulder_q34.png',f'{R}/new/S_shoulder_q34.png',v12(VS['front']),ref(RF['sleeve'])]),
  ('袖·外侧',[f'{R}/e60/S_sleeve_out.png',f'{R}/new/S_sleeve_out.png',v12(VS['side']),ref(RF['sleeve'])]),
  ('肘·后侧',[f'{R}/e60/S_elbow_back.png',f'{R}/new/S_elbow_back.png',v12(VS['side']),ref(RF['sleeve'])]),
  ('克夫',[f'{R}/e60/S_cuff.png',f'{R}/new/S_cuff.png',v12(VHd['front']),ref(RF['hand'])])],360,360,f'{OD}/02_shoulder_sleeve_e60_r2_V12_ref.png',lw=90)
sheet('手部特写：e60 / 本轮 / V12 / 参考图',C,
 [('外侧',[f'{R}/e60/H_out.png',f'{R}/new/H_out.png',v12(VHd['side']),ref(RF['hand'])]),
  ('正面',[f'{R}/e60/H_front.png',f'{R}/new/H_front.png',v12(VHd['front']),ref(RF['hand'])]),
  ('内侧',[f'{R}/e60/H_in.png',f'{R}/new/H_in.png',v12(VHd['side']),ref(RF['hand'])])],360,360,f'{OD}/03_hands_e60_r2_V12_ref.png',lw=90)
sheet('走路 v2 摆臂极限帧：e60 / 本轮（V12、参考图只有静态，放在最后一行作对照）',['e60 正面','本轮 正面','e60 侧面','本轮 侧面'],
 [(f'帧 {f}',[f'{R}/walk_old/f{f}/P_front.png',f'{R}/walk_new/f{f}/P_front.png',f'{R}/walk_old/f{f}/P_side.png',f'{R}/walk_new/f{f}/P_side.png']) for f in (1,10,24)]+
 [('参照',[v12(VB['front']),v12(VB['side']),ref(RF['full']),None])],340,410,f'{OD}/04_walk_v2_arm_extremes_e60_r2.png',lw=90)
sheet('全身对比：e60 / 本轮 / V12 / 参考图',C,
 [('正面',[f'{R}/e60/B_front.png',f'{R}/new/B_front.png',v12(VB['front']),ref(RF['full'])]),
  ('侧面',[f'{R}/e60/B_side.png',f'{R}/new/B_side.png',v12(VB['side']),ref(RF['full'])])],360,580,f'{OD}/05_fullbody_e60_r2_V12_ref.png',lw=90)
sheet('小腿和鞋特写：e60 / 本轮 / V12 / 参考图',C,
 [('正面',[f'{R}/e60/L_front.png',f'{R}/new/L_front.png',v12(VL['front']),ref(RF['legs'])]),
  ('侧面',[f'{R}/e60/L_side.png',f'{R}/new/L_side.png',v12(VL['side']),ref(RF['legs'])]),
  ('鞋',[f'{R}/e60/L_shoe.png',f'{R}/new/L_shoe.png',v12(VL['side']),ref(RF['legs'])]),
  ('走路 帧6',[f'{R}/walk_old/f6/P_leg_side.png',f'{R}/walk_new/f6/P_leg_side.png',None,None]),
  ('坐 sit_hold',[f'{R}/sit_old/P_sit_side.png',f'{R}/sit_new/P_sit_side.png',None,None])],340,340,f'{OD}/06_calf_shoes_e60_r2_V12_ref.png',lw=110)
