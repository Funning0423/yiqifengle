# pieces sheet + compare image.  python3 sheets.py <outdir>
import sys,os,math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT=sys.argv[1]; SL=os.path.join(OUT,'slices')
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; FR='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
def font(px,b=True): return ImageFont.truetype(FB if b else FR,int(px),index=2)
def S(n): return Image.open(os.path.join(SL,n+'.png')).convert('RGBA')
def sc(im,f): return im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
def pc(d,im,x,y): d.alpha_composite(im,(round(x-im.width/2),round(y-im.height/2)))
BROWN=(99,63,33); BG=(244,236,218)
# ---------- pieces sheet ----------
cell=210; cols=6
names=[('piece_strawberry','草莓 type0'),('piece_leaf','青叶 type1'),('piece_blueberry','蓝莓 type2'),('piece_flower','小白花 type3'),('piece_acorn','橡果 type4'),('piece_shell','扇贝 type5')]
spec=[('special_line_h','横排：横向风丝带','piece_strawberry'),('special_line_v','竖排：竖向风丝带','piece_blueberry'),('special_bomb','炸弹：纸风车(慢转)','piece_flower')]
obs=[('obstacle_moss','苔藓垫(在棋子下)','piece_acorn'),('obstacle_roots','树根(压在棋子上)','piece_leaf'),('obstacle_shell_2','贝壳盖 2 层',None),('obstacle_shell_1','贝壳盖 1 层(裂)',None)]
Wd=cols*cell+40; Hd=90+cell+60+cell+60+cell+60+80+90+130
img=Image.new('RGBA',(Wd,Hd),BG+(255,)); d=ImageDraw.Draw(img)
d.text((20,20),'(b) 棋子 / 特殊块 / 障碍 单张切图（Blender 低多边形，M_env_palette 同材质同光）',font=font(28),fill=BROWN)
f_piece=0.97; f_tile=1.0*(1.16/1.12)*0.97*192/160  # tile frame (1.16u/160px) -> same px/unit as piece (1.12u/192px)
f_spec=0.97*(192/1.12)/(308/1.80)
tileA=S('tile_a'); tileA=sc(tileA,(192/1.12)/(160/1.16)*0.97)
def put_cell(x,y,piece=None,special=None,ob=None,under=None):
    pc(img,tileA,x,y)
    if under: pc(img,sc(S(under),(192/1.12)/(160/1.16)*0.97),x,y-2)
    if special=='special_bomb': pc(img,sc(S(special),f_spec*1.05),x,y-4)
    if piece:
        p=sc(S(piece),f_piece*(0.8 if special=='special_bomb' else 1.05)); pc(img,p,x,y-6)
    if special in('special_line_h','special_line_v'): pc(img,sc(S(special),f_spec),x,y-6)
    if ob: pc(img,sc(S(ob),(192/1.12)/(160/1.16)*0.97),x,y-6)
y0=90
for i,(n,lab) in enumerate(names):
    x=40+cell*i+cell//2-20; put_cell(x,y0+cell//2-10,n); w=d.textlength(lab,font=font(22)); d.text((x-w/2,y0+cell-22),lab,font=font(22),fill=BROWN)
y1=y0+cell+60; d.text((20,y1-44),'特殊块（叠在棋子上，颜色不改变棋子身份）',font=font(24),fill=BROWN)
for i,(n,lab,p) in enumerate(spec):
    x=40+cell*i+cell//2-20; put_cell(x,y1+cell//2-10,p,n); w=d.textlength(lab,font=font(20)); d.text((x-w/2,y1+cell-22),lab,font=font(20),fill=BROWN)
for i,(n,lab,p) in enumerate(spec):
    x=40+cell*(i+3)+cell//2-20; im=S(n); bgc=Image.new('RGBA',im.size,(70,110,120,255)); bgc.alpha_composite(im); pc(img,sc(bgc,0.58),x,y1+cell//2-10)
    lab2='切图本体'; w=d.textlength(lab2,font=font(18,False)); d.text((x-w/2,y1+cell-22),lab2,font=font(18,False),fill=(110,90,60))
y2=y1+cell+60; d.text((20,y2-44),'障碍（整格可见，不再是角上 3px 小点）',font=font(24),fill=BROWN)
for i,(n,lab,p) in enumerate(obs):
    x=40+cell*i+cell//2-20
    if n=='obstacle_moss': put_cell(x,y2+cell//2-10,p,under=n)
    elif n=='obstacle_roots': put_cell(x,y2+cell//2-10,p,ob=n)
    else: put_cell(x,y2+cell//2-10,None,ob=n)
    w=d.textlength(lab,font=font(20)); d.text((x-w/2,y2+cell-22),lab,font=font(20),fill=BROWN)
x=40+cell*4+cell//2-20; pc(img,sc(S('tile_a'),1.0),x,y2+cell//2-10); pc(img,sc(S('tile_b'),1.0),x+cell,y2+cell//2-10)
d.text((x-60,y2+cell-22),'格子底座 A / B（交替）',font=font(20),fill=BROWN)
# actual size row (50pt ≈ 96px at 750 design → we show at 1x of 390pt = 50px)
y3=y2+cell+60; d.text((20,y3-44),'实际显示尺寸检查：格距 42.6pt；下面按 1x（≈43px/格）和色盲模拟（绿色盲 deuteranopia）',font=font(24),fill=BROWN)
row=Image.new('RGBA',(cell*6,80),BG+(255,)); 
small=[]
for i,(n,lab) in enumerate(names):
    t=sc(S('tile_a'),43/ (160/1.16)*1.0); p=sc(S(n),43/(192/1.12)*1.05)
    c=Image.new('RGBA',(60,60),(0,0,0,0)); pc(c,t,30,30); pc(c,p,30,27); small.append(c)
for i,c in enumerate(small): row.alpha_composite(c,(20+i*70,10))
for i,(n,lab,pp) in enumerate(spec):
    t=sc(S('tile_a'),43/(160/1.16)); p=sc(S(pp),43/(192/1.12)*(0.8 if n=='special_bomb' else 1.05)); sp=sc(S(n),43/(308/1.80))
    c=Image.new('RGBA',(60,60),(0,0,0,0)); pc(c,t,30,30)
    if n=='special_bomb': pc(c,sp,30,28)
    pc(c,p,30,27)
    if n!='special_bomb': pc(c,sp,30,27)
    row.alpha_composite(c,(470+i*70,10))
for i,(n,lab,p) in enumerate(obs):
    t=sc(S('tile_a'),43/(160/1.16)); o=sc(S(n),43/(160/1.16)); c=Image.new('RGBA',(60,60),(0,0,0,0)); pc(c,t,30,30)
    if n=='obstacle_moss': pc(c,o,30,29); pc(c,sc(S(p),43/(192/1.12)*1.05),30,27)
    elif n=='obstacle_roots': pc(c,sc(S(p),43/(192/1.12)*1.05),30,27); pc(c,o,30,27)
    else: pc(c,o,30,27)
    row.alpha_composite(c,(700+i*70,10))
img.alpha_composite(row,(20,y3))
# deuteranopia (Machado 2009, severity 1.0) on linear RGB
M=np.array([[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]])
a=np.asarray(row.convert('RGB')).astype(np.float64)/255; lin=np.where(a<=0.04045,a/12.92,((a+0.055)/1.055)**2.4)
sim=np.clip(lin@M.T,0,1); srgb=np.where(sim<=0.0031308,sim*12.92,1.055*sim**(1/2.4)-0.055)
dimg=Image.fromarray((srgb*255).astype(np.uint8)).convert('RGBA')
y4=y3+90; img.alpha_composite(dimg,(20,y4))
d.text((20,y4+90),'↑ 绿色盲模拟：草莓=饱满心形+黄籽；橡果=浅色帽+深色果（上下明暗反差）；青叶=细长叶形。6 种靠外形+明暗分布区分，不只靠色相。',font=font(20,False),fill=(110,90,60))
img.convert('RGB').save(os.path.join(OUT,'pieces_sheet.png'),optimize=True)

# ---------- compare ----------
PW,PH=750,1624; HDR=110
cur=Image.open('/workspace/yiqifengle/previews/pm-audit/B1_board_native_matte.jpg').convert('RGBA')
cur=cur.resize((PW,round(cur.height*PW/cur.width)),Image.LANCZOS)
new=Image.open(os.path.join(OUT,'board_final_tools.png')).convert('RGBA')
T9=Image.new('RGBA',(PW,PH),(232,240,238,255)); td=ImageDraw.Draw(T9)
c0=Image.open('/workspace/yiqifengle/previews/pm-audit/C0_island_T9_props_reference.png').convert('RGBA')
c0=c0.crop((0,650,c0.width,960)); c0=c0.resize((PW,round(c0.height*PW/c0.width)),Image.LANCZOS)
td.text((24,14),'① 实机截图裁切（C0_island_T9_props_reference）',font=font(26),fill=BROWN)
T9.alpha_composite(c0,(0,56)); yy=56+c0.height+24
td.text((24,yy),'② ui-props 原始渲染（T9 .blend，同一套灯光脚本）',font=font(26),fill=BROWN); yy+=46
R='/workspace/yiqifengle/work/grokbot/ui-props/renders/'
row=[('ui_signpost_with_text.png',280),('ui_satchel.png',110),('ui_notebook.png',90),('ui_compass.png',105)]
x=24
for fn,wd in row:
    im=Image.open(R+fn).convert('RGBA'); im=im.crop(im.getbbox()); im=sc(im,wd/im.width); T9.alpha_composite(im,(x,yy+(240-im.height)//2)); x+=wd+36
yy+=260
td.text((24,yy),'③ 新版棋盘件（同 M_env_palette 色块、同倒角、同光）',font=font(26),fill=BROWN); yy+=46
nb=Image.open(os.path.join(OUT,'board_final_tools.png')).convert('RGBA')
corner=nb.crop((20,420,330,640)); T9.alpha_composite(corner,(20,yy))
pl=S('hud_levelplate'); pl=sc(pl,0.9); T9.alpha_composite(pl,(350,yy))
pa=S('hud_pause'); T9.alpha_composite(sc(pa,0.8),(360,yy+128))
for i,n in enumerate(['tool_starlight','tool_windbell','tool_tidebottle']):
    t=S(n); t=sc(t,0.55); T9.alpha_composite(t,(470+i*92,yy+118))
yy+=240
sw=[('#956737','木 wood'),('#6e4826','深木'),('#f8f2e2','奶油'),('#e4d0a3','浅木'),('#7bbab5','青'),('#eac777','金')]
for i,(c,l) in enumerate(sw):
    x=24+i*120; td.rounded_rectangle((x,yy,x+100,yy+50),radius=10,fill=c,outline=(120,100,70),width=2); td.text((x,yy+56),l,font=font(18,False),fill=BROWN)
yy+=110
td.text((24,yy),'共用调色板色块、0 新贴图、倒边 0.02–0.045；木件同 T9 灯光；\n棋子/道具另加柔高光、顶光接触影、冷色轮廓光。',font=font(22,False),fill=(90,75,55),spacing=8)
yy+=90
td.text((24,yy),'④ 同比例摆在一起（沙地底，T9 原渲染 + 新版切图）',font=font(26),fill=BROWN); yy+=44
td.rounded_rectangle((20,yy,PW-20,yy+250),radius=18,fill=(235,220,173))
items=[(R+'ui_signpost_with_text.png',200),(R+'ui_satchel.png',85),(os.path.join(SL,'hud_pause.png'),70),(os.path.join(SL,'tool_starlight.png'),100),(R+'ui_compass.png',80),(os.path.join(SL,'tool_windbell.png'),100)]
x=34
for fn,wd in items:
    im=Image.open(fn).convert('RGBA'); im=im.crop(im.getbbox()); im=sc(im,wd/im.width)
    T9.alpha_composite(im,(x,yy+215-im.height)); x+=wd+14
GAP=24; out=Image.new('RGB',(PW*3+GAP*4,PH+HDR+GAP),(250,246,236)); od=ImageDraw.Draw(out)
heads=['现状（实机 B1_board_native_matte）','新版（b 定稿：有道具 + 自动提示）','基准：T9「继续旅程」路牌 + 行囊/旅程册/设置']
for i,(im,h) in enumerate(zip([cur,new,T9],heads)):
    x=GAP+i*(PW+GAP); out.paste(im.convert('RGB').crop((0,0,PW,min(PH,im.height))),(x,HDR))
    od.text((x,30),h,font=font(34),fill=BROWN)
out.save(os.path.join(OUT,'compare_current_new_T9.jpg'),quality=86,optimize=True)
print('sheets ok')
