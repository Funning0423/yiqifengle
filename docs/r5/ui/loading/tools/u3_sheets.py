# 前后对比图 + 裙子/圆凳接触特写拼图
from PIL import Image, ImageDraw, ImageFont
import os
F=lambda s,b=False: ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-%s.ttc'%('Bold' if b else 'Regular'),s,index=2)
OUT='/workspace/u3/out'; W='/workspace/u3/work'; BP='/workspace/yiqifengle/previews/棋盘UI美术bot/u3-loading/blocked_penetration'
OLD='/workspace/u3/src/creator-build-project/build-templates/wechatgame/startup-art/first_screen_composite.jpg'
GLB='previews/角色建模bot/r5-sit-drape/chr_b_r5g2_sitdrape_cand6_sithold_sleevetex.glb'
SHA='7604ebc2b4eec23406beef49d495ae452174b72cb549debf2790762e1fdf23a9'
CAP=[f'新版角色：{GLB}',f'sha256 {SHA}',
     '场景：bc81575f（room_no_original_chair.glb + reading_chair.glb ×1.2 yaw −2，seatedRoot (0.43273, 0, −4.20761) yaw −2，sit_hold f0）']
def fit(p,w,h):
    im=Image.open(p).convert('RGB'); s=min(w/im.width,h/im.height); return im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
# ---- compare
cw,ch=375,812; pad=24; top=70
cols=[(OLD,'① 现行线上 first_screen_composite.jpg','58,207 B · 旧 int/v1 椅子+旧姿势'),
      (BP+'/A_home_camera.jpg','② 上一轮被拦下的版本（穿模）','生产姿势 + 圆凳：DRESS 503 / BOW 40 个三角相交'),
      (OUT+'/first_screen_composite.jpg','③ 新版 first_screen_composite.jpg','%s B · cand6 sit_hold，0 相交'%format(os.path.getsize(OUT+'/first_screen_composite.jpg'),','))]
zw=375; zrow=[(BP+'/B_home_dir_zoom.jpg','② 穿模：裙子/蝴蝶结没入凳面（Workbench 探测图）'),
              (W+'/ev_c6/B_home_dir_zoom.png','③ 同机位 cand6：裙子搭在凳面上（Workbench）'),
              (W+'/cu/c1_home_dir.png','③ 同方向 EEVEE 成片光照特写')]
Hh=top+ch+60+zw+60+len(CAP)*34+30
im=Image.new('RGB',(pad+3*(cw+pad),Hh),(250,246,236)); d=ImageDraw.Draw(im)
d.text((pad,18),'U3 加载页底图：前后对比（旧穿模版 → 新版）',font=F(30,True),fill=(63,94,99))
for k,(p,a,b) in enumerate(cols):
    x=pad+k*(cw+pad); t=fit(p,cw,ch); im.paste(t,(x+(cw-t.width)//2,top))
    d.text((x,top+ch+6),a,font=F(18,True),fill=(99,63,33)); d.text((x,top+ch+30),b,font=F(16),fill=(80,80,80))
y=top+ch+60
for k,(p,a) in enumerate(zrow):
    x=pad+k*(cw+pad); t=fit(p,cw,zw); im.paste(t,(x+(cw-t.width)//2,y)); d.text((x,y+zw+6),a,font=F(16),fill=(99,63,33))
y+=zw+50
for i,c in enumerate(CAP): d.text((pad,y+i*34),c,font=F(18),fill=(40,40,40))
im.save(OUT+'/compare_before_after.jpg',quality=88,optimize=True,progressive=True)
# ---- close-ups
E=[('c1_home_dir','EEVEE ① 主机位方向：裙子坐在凳面、前沿自然垂下'),('c2_front_low','EEVEE ② 低位正面：凳面与裙底贴合，无没入'),
   ('c3_back','EEVEE ③ 背面：蝴蝶结垂带从凳沿外侧垂下'),('c5_under','EEVEE ④ 凳面下方仰视：凳面下无布料穿出')]
# 与 blocked_penetration 同一套 7 个角度（A–H 去掉 D：D 机位在墙里）。u3_closeups.py 里 E_back/F_front 两个文件名与实际朝向对调，这里按画面内容命名，字母与 blocked_penetration 一致
P=[('A_home_camera','A 游戏主机位','A_home_camera'),('B_home_dir_zoom','B 主机位方向放大','B_home_dir_zoom'),('C_side_left','C 侧面','C_side_left'),('F_front','E 背面/蝴蝶结','E_back_bow'),('E_back','F 正面/膝','F_front_knees'),('G_side_stool_hidden','G 隐藏凳子看裙底','G_side_stool_hidden'),('H_below_seat_up','H 凳面下仰视','H_below_seat_up')]
s1=450; s2=320
ww=pad+4*(s1+pad); hh=70+s1+60+ (s2+50)*2+len(CAP)*34+40
im=Image.new('RGB',(ww,hh),(250,246,236)); d=ImageDraw.Draw(im)
d.text((pad,18),'裙子 / 圆凳接触特写（上：EEVEE 成片光照；下：7 个探测放大角度，Workbench）',font=F(28,True),fill=(63,94,99))
for k,(f,c) in enumerate(E):
    x=pad+k*(s1+pad); im.paste(fit(f'{W}/cu/{f}.png',s1,s1),(x,70)); d.text((x,70+s1+6),c,font=F(16),fill=(99,63,33))
    Image.open(f'{W}/cu/{f}.png').convert('RGB').save(f'{OUT}/closeups/{f}.jpg',quality=88)
y0=70+s1+60; per=(ww-pad)//(s2+pad)
for k,(f,c,n) in enumerate(P):
    r,cix=divmod(k,per); x=pad+cix*(s2+pad); y=y0+r*(s2+50)
    im.paste(fit(f'{W}/ev_c6/{f}.png',s2,s2),(x,y)); d.text((x,y+s2+4),c,font=F(16),fill=(99,63,33))
    Image.open(f'{W}/ev_c6/{f}.png').convert('RGB').save(f'{OUT}/closeups/probe_{n}.jpg',quality=88)
y=y0+2*(s2+50)
for i,c in enumerate(CAP): d.text((pad,y+i*34),c,font=F(18),fill=(40,40,40))
im.save(OUT+'/closeup_dress_stool_contact.jpg',quality=88,optimize=True,progressive=True)
