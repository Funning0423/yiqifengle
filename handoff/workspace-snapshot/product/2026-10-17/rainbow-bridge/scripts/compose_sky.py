import json
from PIL import Image, ImageDraw, ImageFont
D=json.load(open('qa/sky_b.json')); F=lambda s:ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',s) if __import__('os').path.exists('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc') else ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',s)
out=[]
for scr in ['390x844','375x667','390x520','768x1024']:
    b=[x for x in D['boards'] if x['screen']==scr][0]; im=Image.open('renders/skyB_board_%s.png'%scr).convert('RGBA'); k=im.width/int(scr.split('x')[0])
    ov=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    ui=D['ui'][scr]
    for r in ui['rects']: d.rectangle([v*k for v in r],outline=(255,0,255,255),width=3)
    t=ui['tray']; d.rectangle([v*k for v in t],fill=(20,120,130,90),outline=(0,200,210,255),width=4)
    bx=b['boxPt']; d.rectangle([bx['l']*k,bx['t']*k,bx['r']*k,bx['b']*k],outline=(255,230,0,255),width=4)
    im=Image.alpha_composite(im,ov); d=ImageDraw.Draw(im); f=F(int(15*k))
    txt=f"{scr}  她高 {b['heightPt']} pt（{b['heightFrac']*100:.1f}% 屏高）  距UI {b['gapPt']} pt  托盘遮挡 {b['underTrayShare']:.0%}  场景遮挡 {b['sceneOccludedRays']}"
    d.rectangle([0,im.height-int(40*k),im.width,im.height],fill=(0,0,0,170)); d.text((int(8*k),im.height-int(34*k)),txt,font=f,fill=(255,255,255,255))
    im=im.convert('RGB'); H=900; out.append(im.resize((int(im.width*H/im.height),H)))
W=sum(i.width for i in out)+10*(len(out)-1); s=Image.new('RGB',(W,960),(30,30,30)); x=0
for i in out: s.paste(i,(x,0)); x+=i.width+10
d=ImageDraw.Draw(s); d.text((10,912),'方案B：彩虹桥接星庭前沿｜棋盘相机（skycityVisitPose）原样｜黄框=阿芳 1.73 m 包围盒｜青色=托盘｜品红=girlStandUi 的 UI 禁区（棋盘/目标/道具/暂停/安全区）',font=F(22),fill=(255,255,255))
s.save('skycity-B/skycity_B_board_camera_verify.jpg',quality=90); print(s.size)
