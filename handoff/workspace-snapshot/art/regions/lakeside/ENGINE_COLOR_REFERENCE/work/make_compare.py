import json
from PIL import Image, ImageDraw, ImageFont
S=json.load(open('work/samples.json')); B=S['boxes_x0y0x1y1']; V=S['values']
R='/workspace/wechat-game/art/regions/lakeside/renders/r5h3/'
E='/workspace/wechat-game/ui-audit/2026-10-17/next-f60c8ec/v32/raw/lake_day_v32_layered_lake_bgonly_360x640.png'
panels=[('r5h3 调色前 (f61) ← 引擎场景输出对这个','r5h3_pre_timemedian',R+'f61.png'),
        ('r5h3 调色后 (g61) ← 加完 LUT/Bloom/暗角后对这个','r5h3_graded_timemedian',R+'g61.png'),
        ('引擎 v3.2 layered 雾 (Mac, 仅背景)','engine_v32_layered',E)]
F='/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc'
fT=ImageFont.truetype(F,22); fS=ImageFont.truetype(F,17); fB=ImageFont.truetype(F,26)
s=0.75; PW,PH=int(720*s),int(1280*s); top=44; bot=176
c=Image.new('RGB',(PW*3+40,PH+top+bot),(250,247,240)); d=ImageDraw.Draw(c)
zones=[('①近水','near_water_bottom',(255,60,60)),('①近水','near_mid_water',(255,60,60)),('②中段','mid_water',(255,160,0)),('②中段','mid_water_R',(255,160,0)),('远水','far_water',(80,160,255)),('③桥','bridge_stone_deck',(200,0,200)),('③桥','bridge_stone_left',(200,0,200))]
for i,(title,key,p) in enumerate(panels):
  im=Image.open(p).convert('RGB').resize((720,1280)); dr=ImageDraw.Draw(im)
  # problem regions
  dr.rectangle((4,1150,716,1276),outline=(255,60,60),width=4); dr.text((10,1120),'① 近水',font=fB,fill=(255,60,60),stroke_width=3,stroke_fill='black')
  dr.rectangle((4,372,716,478),outline=(255,160,0),width=4); dr.text((10,480),'② 湖中段条纹带',font=fB,fill=(255,160,0),stroke_width=3,stroke_fill='black')
  dr.rectangle((60,505,660,700),outline=(200,0,255),width=4); dr.text((70,705),'③ 桥',font=fB,fill=(220,80,255),stroke_width=3,stroke_fill='black')
  dr.rectangle((690,420,719,610),outline=(255,255,0),width=4); dr.text((560,612),'亭子(仅露边)',font=fS,fill=(255,255,0),stroke_width=2,stroke_fill='black')
  for name,z,col in zones:
    x0,y0,x1,y1=B[z]; dr.rectangle((x0,y0,x1,y1),outline='white',width=2)
    v=V[key][z]; dr.text((x0+2,(y1+1) if y1<1240 else y0-20),'%d/%d/%d'%tuple(v),font=fS,fill='white',stroke_width=2,stroke_fill='black')
  c.paste(im.resize((PW,PH)),(10+i*(PW+10),top))
  d.text((14+i*(PW+10),10),title,font=fT,fill=(40,30,20))
y=top+PH+8
lines=['r5h3 数值 = 8 秒视频 24 帧时间中位数再取框内中位数（底图第 61 帧）；引擎 = 单帧框内中位数；sRGB 8bit，坐标见 REFERENCE.md。',
 '引擎截图：ui-audit/2026-10-17/next-f60c8ec/v32/raw/lake_day_v32_layered_lake_bgonly_360x640.png（v3.2 = 21c187d + 3 个 TEST ONLY 提交，Mac DPR2，最新一张湖畔截图）。',
 '① 近水底部 r5h3 调色前 %s / 调色后 %s，引擎 %s：G/B 高约 80，R 偏低 → 偏亮偏青。'%tuple('%d/%d/%d'%tuple(V[k]['near_water_bottom']) for k in ('r5h3_pre_timemedian','r5h3_graded_timemedian','engine_v32_layered')),
 '② 中段 r5h3 行均值标准差 %.1f，引擎 %.1f（linear60/off 32）：橙/青横条 = 波浪法线把反射方向扫过「地平线橙→天顶蓝」天空渐变。'%(V['r5h3_pre_timemedian']['_midlake_rowmean_std'],V['engine_v32_layered']['_midlake_rowmean_std']),
 '③ 桥石面 r5h3 %s，引擎 %s：发白偏青。r5h3 桥上本来就没有亭子；唯一的 LK_pavilion_i 在右岸 (13.6, 0.55, -4.6)，两边都只在右缘露出一条（黄框）。'%('%d/%d/%d'%tuple(V['r5h3_pre_timemedian']['bridge_stone_deck']),'%d/%d/%d'%tuple(V['engine_v32_layered']['bridge_stone_deck']))]
for l in lines: d.text((14,y),l,font=fS,fill=(30,30,30)); y+=26
c.save('compare_r5h3_vs_engine.jpg',quality=88)
print(c.size)
