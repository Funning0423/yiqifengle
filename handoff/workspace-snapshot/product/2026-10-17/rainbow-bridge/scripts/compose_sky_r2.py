import json, os
from PIL import Image, ImageDraw, ImageFont
B='/workspace/wechat-game/product/2026-10-17/rainbow-bridge/'
D=json.load(open(B+'skycity-B/r2/sky_b2_verify.json'))
FP=[f for f in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'] if os.path.exists(f)][0]
F=lambda s:ImageFont.truetype(FP,s)
out=[]
for b in D['boards']:
    scr=b['screen']; im=Image.open(B+'renders/skyB2_board_%s.png'%scr).convert('RGBA'); k=im.width/int(scr.split('x')[0])
    ov=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(ov); ui=D['ui'][scr]
    for r in ui['rects']: d.rectangle([v*k for v in r],outline=(255,0,255,255),width=3)
    t=ui['tray']; d.rectangle([v*k for v in t],fill=(20,120,130,80),outline=(0,200,210,255),width=4)
    ts=ui['toast']; d.rectangle([v*k for v in ts],fill=(255,140,0,70),outline=(255,140,0,255),width=4)
    bx=b['boxPt']; d.rectangle([bx['l']*k,bx['t']*k,bx['r']*k,bx['b']*k],outline=(255,230,0,255),width=4)
    m=13*k; d.rectangle([bx['l']*k-m,bx['t']*k-m,bx['r']*k+m,bx['b']*k+m],outline=(255,230,0,160),width=2)
    im=Image.alpha_composite(im,ov); d=ImageDraw.Draw(im); f=F(int(13*k))
    l1=f"{scr}  她高 {b['heightPt']} pt（{b['heightFrac']*100:.1f}%）  距UI {b['gapPt']} pt"
    l2=f"托盘遮挡 {b['underTrayShare']:.0%}  场景遮挡 {b['sceneOccludedRays']}  比Build05 {b['extraVsBuild05S']:+.2f} s"
    d.rectangle([0,im.height-int(48*k),im.width,im.height],fill=(0,0,0,180)); d.text((int(6*k),im.height-int(46*k)),l1,font=f,fill=(255,255,255,255)); d.text((int(6*k),im.height-int(24*k)),l2,font=f,fill=(255,255,255,255))
    im=im.convert('RGB'); H=900; out.append(im.resize((int(im.width*H/im.height),H)))
W=sum(i.width for i in out)+10*(len(out)-1); s=Image.new('RGB',(W,990),(30,30,30)); x=0
for i in out: s.paste(i,(x,0)); x+=i.width+10
d=ImageDraw.Draw(s)
d.text((10,908),'方案B r2：彩虹桥落在星庭前沿右侧，她停在右前区草坪｜棋盘相机 skycityVisitPose 原样｜黄框=阿芳 1.73 m 包围盒（外圈 = 13 pt 安全距）',font=F(22),fill=(255,255,255))
d.text((10,946),'青=托盘  橙=提示牌（GGbot 260ea02，toast.maxWidth×height+2pt 阴影）  品红=girlStandUi 全部禁区（目标牌/3 个道具/暂停/胶囊/安全区）｜7 种竖屏都 ≥13 pt',font=F(22),fill=(255,255,255))
s.save(B+'skycity-B/skycity_B_board_camera_verify_r2.jpg',quality=90); print(s.size)
