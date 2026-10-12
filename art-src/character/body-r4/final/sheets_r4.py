# body-r4 review sheets (run after render_r4.sh): python3 sheets_r4.py  -> ../share/*.jpg (<195 KB each)
# Only V12 + our own renders; no film stills.
import os, json
from PIL import Image, ImageDraw, ImageFont
HERE=os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',20); FB=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',24)
V=Image.open('../../reference/character-ankle-balanced-v12.jpg').convert('RGB')
VB={'front':(120,20,520,1010),'side':(560,20,960,1010),'back':(1020,20,1420,1010)}
VH={'front':(225,40,415,230),'side':(665,40,855,230),'back':(1125,40,1315,230)}
VU={'front':(120,130,520,560),'side':(560,130,960,560),'back':(1020,130,1420,560)}
VS={'front':(90,170,330,520),'side':(620,170,860,520)}
VHd={'front':(100,470,190,600),'side':(745,465,820,575)}
VL={'front':(230,690,430,1010),'side':(680,690,880,1010)}
def v12(b): return V.crop(b)
SH='../share'; os.makedirs(SH,exist_ok=True)
def fit(im,w,h,bg=(214,218,226)):
    im=Image.open(im).convert('RGB') if isinstance(im,str) else im
    k=min(w/im.width,h/im.height); im=im.resize((max(1,int(im.width*k)),max(1,int(im.height*k))),Image.LANCZOS)
    c=Image.new('RGB',(w,h),bg); c.paste(im,((w-im.width)//2,(h-im.height)//2)); return c
def save(S,name):
    out=os.path.join(SH,name); q=88; sc=1.0
    while True:
        t=S if sc==1 else S.resize((int(S.width*sc),int(S.height*sc)),Image.LANCZOS)
        t.save(out,quality=q,optimize=True)
        if os.path.getsize(out)<195000: break
        if q>68: q-=6
        else: sc*=0.88
    print(out,t.size,os.path.getsize(out)//1024,'KB')
def sheet(title,cols,rows,cw,ch,name,lw=110):
    W=lw+cw*len(cols); H=48+32+ch*len(rows); S=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(S)
    d.text((12,10),title,fill=(20,20,20),font=FB)
    for i,c in enumerate(cols): d.text((lw+i*cw+8,50),c,fill=(60,60,60),font=F)
    for r,(lab,ims) in enumerate(rows):
        y=80+r*ch; d.multiline_text((10,y+ch//2-24),lab,fill=(30,30,30),font=F,spacing=4)
        for i,im in enumerate(ims):
            if im is None or (isinstance(im,str) and not os.path.exists(im)): continue
            S.paste(fit(im,cw-6,ch-6),(lw+i*cw+3,y+3))
    save(S,name)
N='raw/new'; E='raw/e60'
sheet('全身对比 V12 / 本轮 body-r4 / 改前（运行时 e60）',['正面','侧面','3/4','背面'],
 [('V12',[v12(VB['front']),v12(VB['side']),None,v12(VB['back'])]),
  ('本轮\nbody-r4',[f'{N}/F_front.png',f'{N}/F_side.png',f'{N}/F_q34.png',f'{N}/F_back.png']),
  ('改前\ne60',[f'{E}/F_front.png',f'{E}/F_side.png',f'{E}/F_q34.png',f'{E}/F_back.png'])],300,520,'r4_01_fullbody_vs_V12.jpg')
sheet('头部：V12 / 本轮（混元 retopo）',['正面','3/4','侧面','背面','游戏相机 30°'],
 [('V12',[v12(VH['front']),None,v12(VH['side']),v12(VH['back']),None]),
  ('本轮',[f'{N}/h_front.png',f'{N}/h_q34.png',f'{N}/h_side.png',f'{N}/h_back.png',f'{N}/h_game.png']),
  ('线框',[f'{N}/h_front_wire.png',None,f'{N}/h_side_wire.png',None,None])],300,300,'r4_02_head_vs_V12.jpg')
sheet('眼睛眨眼（_tag_eyes UV 偏移）',['睁开 (0,0)','半闭 (0,+0.5)','闭合 (+0.5,0)'],
 [('脸部',[f'raw/blink_open/f_face.png',f'raw/blink_half/f_face.png',f'raw/blink_closed/f_face.png']),
  ('3/4',[f'raw/blink_open/h_q34.png',f'raw/blink_half/h_q34.png',f'raw/blink_closed/h_q34.png'])],330,330,'r4_03_blink.jpg',lw=70)
sheet('游戏相机俯角 30°：本轮 / 改前',['正面','3/4','背后'],
 [('本轮',[f'{N}/G_game_front.png',f'{N}/G_game_q34.png',f'{N}/G_game_back.png']),
  ('改前 e60',[f'{E}/G_game_front.png',f'{E}/G_game_q34.png',f'{E}/G_game_back.png'])],330,380,'r4_04_game_camera.jpg',lw=100)
sheet('上身、袖、腰带：V12 / 本轮 / 改前',['V12','本轮','改前 e60'],
 [('上身正面',[v12(VU['front']),f'{N}/U_front.png',f'{E}/U_front.png']),('上身侧面',[v12(VU['side']),f'{N}/U_side.png',f'{E}/U_side.png']),
  ('背面 蝴蝶结',[v12(VU['back']),f'{N}/U_back.png',f'{E}/U_back.png']),('肩线（隐藏围裙）',[v12(VS['front']),f'{N}/S_shoulder.png',f'{E}/S_shoulder.png']),
  ('袖 外侧',[v12(VS['side']),f'{N}/S_sleeve_out.png',f'{E}/S_sleeve_out.png'])],300,300,'r4_05_upper_sleeve_belt.jpg',lw=130)
sheet('手和靴：V12 / 本轮 / 改前',['V12','本轮','改前 e60'],
 [('手 正面',[v12(VHd['front']),f'{N}/H_front.png',f'{E}/H_front.png']),('手 外侧',[v12(VHd['side']),f'{N}/H_out.png',f'{E}/H_out.png']),
  ('小腿+靴 正面',[v12(VL['front']),f'{N}/L_front.png',f'{E}/L_front.png']),('靴 侧面',[v12(VL['side']),f'{N}/L_side.png',f'{E}/L_side.png']),
  ('靴 3/4',[None,f'{N}/L_shoe.png',f'{E}/L_shoe.png'])],280,280,'r4_06_hands_boots.jpg',lw=130)
sheet('线框（本轮）',['正面','侧面'],[('',[f'{N}/W_front.png',f'{N}/W_side.png'])],420,750,'r4_07_wire.jpg',lw=10)
# key action frames: every clip, first / middle / last frame
rows=[l.split() for l in open('raw/act/list.txt')]+[['walk_loop_v2','0','8','17']]
per=3; cols=3*per; cw,ch=170,290; lw=8
H=48+len(range(0,len(rows),per))*(ch+26); S=Image.new('RGB',(lw+cw*cols,H),'white'); d=ImageDraw.Draw(S)
d.text((12,10),'关键动作帧（每个片段 首/中/末帧，3/4 视角）',fill=(20,20,20),font=FB)
for gi,i in enumerate(range(0,len(rows),per)):
    y=48+gi*(ch+26)
    for j,r in enumerate(rows[i:i+per]):
        c=r[0]; d.text((lw+j*per*cw+6,y),c,fill=(40,40,40),font=F)
        for k,f in enumerate(r[1:4]):
            p=f'raw/act/{c}/{f}/A.png'
            if os.path.exists(p): S.paste(fit(p,cw-4,ch-4),(lw+(j*per+k)*cw+2,y+24))
save(S,'r4_08_key_action_frames.jpg')
