from PIL import Image, ImageDraw, ImageFont
import shutil, os
FP='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
if not os.path.exists(FP): FP='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
F=lambda s:ImageFont.truetype(FP,s)
R=lambda f:Image.open('renders/'+f).convert('RGB')
shutil.copy('renders/new_day_lens.png','rainbow_bridge_day_720x1280.png'); shutil.copy('renders/new_night_lens.png','rainbow_bridge_night_720x1280.png')
def label(im,t,s=28):
    d=ImageDraw.Draw(im); d.rectangle([0,0,im.width,s+18],fill=(0,0,0)); d.text((10,6),t,font=F(s),fill=(255,255,255)); return im
def sheet(items,out,w=360,title=None):
    ims=[label(R(f).resize((w,int(w*16/9))),t,18) for f,t in items]; H=ims[0].height+(50 if title else 0)
    s=Image.new('RGB',(w*len(ims)+8*(len(ims)-1),H),(25,25,25))
    for i,im in enumerate(ims): s.paste(im,(i*(w+8),50 if title else 0))
    if title: ImageDraw.Draw(s).text((10,10),title,font=F(26),fill=(255,255,255))
    s.save(out,quality=92); print(out,s.size)
sheet([('close_start_day.png','起点·海岛 白天'),('close_start_night.png','起点·海岛 夜间'),('close_end_day.png','终点·草地 白天'),('close_end_night.png','终点·草地 夜间'),('qa_seam_end.png','终点贴地近看')],
      'rainbow_bridge_ends_closeup.jpg',title='两端衔接：桥端溶解成花瓣格子 + 落花/光点 + 地面彩色光晕，无断口、不插地')
# comparison: real recording frame | current rebuild | new  (lens mid-bridge) and landing
rec=Image.open('current/rec_0405_t22_day_night.png').convert('RGB'); rec=rec.crop((0,0,rec.width//2,rec.height))
recs=rec.resize((360,int(360*rec.height/rec.width)))
row=lambda fs:[R(f).resize((360,640)) for f in fs]
r1=[recs]+row(['cur_day_lens.png','new_day_lens.png','new_night_lens.png']); r2=row(['cur_day_land.png','new_day_land.png','cur_close_end.png','close_end_day.png'])
T1=['现状·真机录屏（落地）','现状·按代码重建（桥中段）','新方案 白天','新方案 夜间']; T2=['现状·落地（重建）','新方案·落地','现状·落地近景','新方案·落地近景']
s=Image.new('RGB',(4*368,60+2*(640+40)),(25,25,25)); d=ImageDraw.Draw(s); d.text((10,12),'彩虹桥：现状（7 条平面色带、直角断口、斜插地面） vs 新方案（有厚度的光之桥、花瓣溶解落地）',font=F(24),fill=(255,255,255))
for j,(r,T) in enumerate(((r1,T1),(r2,T2))):
    for i,(im,t) in enumerate(zip(r,T)):
        y=60+j*680; s.paste(im.resize((360,640)) if im.size!=(360,640) else im,(i*368,y+36)); d.text((i*368+6,y+4),t,font=F(20),fill=(255,230,120))
s.save('rainbow_bridge_current_vs_new.jpg',quality=90); print(s.size)
sheet([('qa_seam_end.png','贴地接缝'),('qa_side_span.png','侧面：拱高/厚度'),('qa_under.png','仰视：底面/侧面'),('close_end_day.png','终点近景')],'qa/rainbow_bridge_closeup_QA.jpg',title='近景自检：穿模 / z-fighting / 悬空 / 接缝')
