# Composite rendered props onto the in-game reference frames (portrait + landscape).
import json, sys, os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A='/home/box/agent-data/agents/8c7b417d-ced0-405f-97a8-6cb496b2ecc5/attachments/'
POR=A+'292d55dd789a6c8b5b18052210851dd572e9c3c583e8a9b5ad2dfe5575e60222.png'
LAN=A+'433624348b762e5c5da2e43f204c557c60ccbc0b2b0d4ad1b1eabc2aac000725.png'
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
DARK=(99,63,33)       # palette row8 x10 #633f21 dark wood brown (text)
CREAM=(248,242,226)   # palette plaster #f8f2e2 (tags)
TAGEDGE=(149,103,55)  # wood #956737

def trim(im):
    return im.crop(im.getchannel('A').getbbox())

def signpost_with_text():
    im=Image.open(os.path.join(D,'renders','ui_signpost.png')).convert('RGBA')
    q=json.load(open(os.path.join(D,'renders','ui_signpost_textquad.json')))
    # draw text flat, then warp into the projected panel quad
    tw,th=1440,480
    t=Image.new('RGBA',(tw,th),(0,0,0,0)); d=ImageDraw.Draw(t)
    f=ImageFont.truetype(FB,300,index=2)  # SC
    s='继续旅程'; bb=d.textbbox((0,0),s,font=f)
    d.text(((tw-(bb[2]-bb[0]))/2-bb[0],(th-(bb[3]-bb[1]))/2-bb[1]),s,font=f,fill=DARK+(255,))
    # perspective coeffs: map output quad -> input rect
    import numpy as np
    src=[(0,0),(tw,0),(tw,th),(0,th)]; dst=q
    M=[];B=[]
    for (x,y),(u,v) in zip(dst,src):
        M.append([x,y,1,0,0,0,-u*x,-u*y]); B.append(u)
        M.append([0,0,0,x,y,1,-v*x,-v*y]); B.append(v)
    c=np.linalg.solve(np.array(M,float),np.array(B,float))
    w=t.transform(im.size,Image.PERSPECTIVE,tuple(c),Image.BICUBIC)
    im.alpha_composite(w); return trim(im), im

def contact(base, cx, by, w, water=True):
    """soft shadow + light ripple ring under a prop sitting on the water."""
    h=max(6,int(w*0.16))
    lay=Image.new('RGBA',base.size,(0,0,0,0)); d=ImageDraw.Draw(lay)
    d.ellipse([cx-w*0.55,by-h*0.55,cx+w*0.55,by+h*0.55],fill=(10,60,80,110))
    lay=lay.filter(ImageFilter.GaussianBlur(max(2,w*0.04)))
    base.alpha_composite(lay)
    if water:
        r=Image.new('RGBA',base.size,(0,0,0,0)); d=ImageDraw.Draw(r)
        for k,(sc,a) in enumerate(((0.72,150),(0.92,80))):
            d.ellipse([cx-w*sc,by-h*sc,cx+w*sc,by+h*sc],outline=(235,250,250,a),width=max(2,int(w*0.018)))
        r=r.filter(ImageFilter.GaussianBlur(max(1,w*0.008)))
        base.alpha_composite(r)

def place(base, prop, cx, by, width, water=True):
    p=prop.resize((int(width), int(prop.height*width/prop.width)), Image.LANCZOS)
    contact(base, cx, by, width*0.8, water)
    base.alpha_composite(p,(int(cx-p.width/2), int(by-p.height+p.height*0.02)))
    return p

def tag(base, cx, top, text, size):
    f=ImageFont.truetype(FB,size,index=2)
    d=ImageDraw.Draw(base); bb=d.textbbox((0,0),text,font=f)
    tw,th=bb[2]-bb[0],bb[3]-bb[1]; px,py=size*0.75,size*0.38
    w,h=tw+2*px, th+2*py
    sh=Image.new('RGBA',base.size,(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([cx-w/2,top+size*0.12,cx+w/2,top+h+size*0.12],radius=h/2,fill=(20,50,60,90))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(size*0.12)))
    d=ImageDraw.Draw(base)
    d.rounded_rectangle([cx-w/2,top,cx+w/2,top+h],radius=h/2,fill=CREAM+(255,),outline=TAGEDGE+(255,),width=max(2,size//10))
    d.text((cx-tw/2-bb[0], top+py-bb[1]), text, font=f, fill=DARK+(255,))

sign,_=signpost_with_text()
sign.save(os.path.join(D,'renders','ui_signpost_with_text.png'))
props=[trim(Image.open(os.path.join(D,'renders',n+'.png')).convert('RGBA')) for n in ('ui_satchel','ui_notebook','ui_compass')]
labels=['行囊','旅程册','设置']

# ---- portrait 946x2048 ----
P=Image.open(POR).convert('RGBA').resize((946,2048),Image.LANCZOS)
W,H=P.size
sw_=W*0.48; place(P,sign,W/2,H*0.70+sign.height*sw_/sign.width/2,sw_,water=False)
for i,(pr,lb) in enumerate(zip(props,labels)):
    ph=W*0.165; pw=min(pr.width*ph/pr.height, W*0.2); ph=pr.height*pw/pr.width
    cx=W*(0.2+0.3*i); by=H*0.84+ph/2
    place(P,pr,cx,by,pw)
    tag(P,cx,by+22,lb,36)
P.convert('RGB').save(os.path.join(D,'mockup-portrait.png'))

# ---- landscape ----
L=Image.open(LAN).convert('RGBA')
if L.width<1920: L=L.resize((1920,int(L.height*1920/L.width)),Image.LANCZOS)
W,H=L.size
sw_=W*0.24; place(L,sign,W*0.16,H*0.62+sign.height*sw_/sign.width/2,sw_,water=False)
for i,(pr,lb) in enumerate(zip(props,labels)):
    ph=W*0.075; pw=min(pr.width*ph/pr.height, W*0.09)
    cx=W*(0.70+0.105*i); by=H*0.86
    place(L,pr,cx,by,pw)
    tag(L,cx,by+14,lb,26)
L.convert('RGB').save(os.path.join(D,'mockup-landscape.png'))
print('ok',P.size,L.size)
