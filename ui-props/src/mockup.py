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


# ---------- beach props (palms + animals) ----------
BI=json.load(open(os.path.join(D,'beach-props','beach_props_info.json')))
def beach(name):
    im=Image.open(os.path.join(D,'beach-props','renders',name+'.png')).convert('RGBA')
    ortho=max(BI[name]['bbox_m'])*1.12+0.05
    return im, im.width/ortho          # image, render px per metre
def foot(im):
    a=im.getchannel('A'); bb=a.getbbox(); y1=bb[3]
    band=a.crop((0,int(y1-(y1-bb[1])*0.03)-1,im.width,y1)); bx=band.getbbox()
    return ((bx[0]+bx[2])/2, y1)
def shadow(base, cx, cy, w, h, a=80, blur=0.25, col=(96,84,48)):
    lay=Image.new('RGBA',base.size,(0,0,0,0)); ImageDraw.Draw(lay).ellipse([cx-w/2,cy-h/2,cx+w/2,cy+h/2],fill=col+(a,))
    base.alpha_composite(lay.filter(ImageFilter.GaussianBlur(max(1.5,h*blur))))
def put(base, name, x, y, pxm, flip=False, canopy=False):
    """place a beach prop with its foot at (x,y); pxm = mockup px per metre at that depth."""
    im,rpm=beach(name); k=pxm/rpm
    im=im.resize((max(1,int(im.width*k)),max(1,int(im.height*k))),Image.LANCZOS)
    if flip: im=im.transpose(Image.FLIP_LEFT_RIGHT)
    bb=im.getchannel('A').getbbox(); im=im.crop(bb)
    fx,fy=foot(im); w=im.width; h=im.height
    if canopy:   # crown shadow falls back-right on the sand (sun upper-left-front)
        shadow(base, x+w*0.30, y-h*0.05, w*0.75, h*0.16, a=55, blur=0.35)
        shadow(base, x+w*0.12, y-h*0.01, w*0.30, h*0.035, a=70, blur=0.3)
    else:
        shadow(base, x+w*0.10, y-h*0.03, w*1.05, max(4,w*0.30), a=95, blur=0.22)
    base.alpha_composite(im,(int(x-fx),int(y-fy)+1))

sign,_=signpost_with_text()
sign.save(os.path.join(D,'renders','ui_signpost_with_text.png'))
props=[trim(Image.open(os.path.join(D,'renders',n+'.png')).convert('RGBA')) for n in ('ui_satchel','ui_notebook','ui_compass')]
labels=['行囊','旅程册','设置']

# ---- portrait 946x2048 ----
P=Image.open(POR).convert('RGBA').resize((946,2048),Image.LANCZOS)
W,H=P.size
# beach (sand band y~1230-1450): back row first so nearer things overlap correctly
put(P,'beach_palm_short',800,1300,66,canopy=True)
put(P,'beach_palm_tall',255,1318,64,canopy=True)
put(P,'beach_gull',400,1268,112)
put(P,'beach_gull',458,1292,112,flip=True)
put(P,'beach_crab',655,1330,118)
put(P,'beach_turtle',535,1398,112)
# signpost moved to the RIGHT, standing in the shallows below the beach so the sand stays clear
sw_=W*0.36; place(P,sign,W*0.79,1668,sw_,water=True)
for i,(pr,lb) in enumerate(zip(props,labels)):
    ph=W*0.150; pw=min(pr.width*ph/pr.height, W*0.18); ph=pr.height*pw/pr.width
    cx=W*(0.2+0.3*i); by=H*0.885+ph/2
    place(P,pr,cx,by,pw)
    tag(P,cx,by+20,lb,34)
P.convert('RGB').save(os.path.join(D,'mockup-portrait.png'))

# ---- landscape ----
L=Image.open(LAN).convert('RGBA')
if L.width<1920: L=L.resize((1920,int(L.height*1920/L.width)),Image.LANCZOS)
W,H=L.size
put(L,'beach_palm_short',455,872,62,canopy=True)
put(L,'beach_palm_short',1150,905,52,flip=True,canopy=True)
put(L,'beach_gull',560,955,100,flip=True)
put(L,'beach_turtle',790,975,98)
put(L,'beach_crab',1010,945,100)
sw_=W*0.22; place(L,sign,W*0.845,H*0.70,sw_,water=True)
for i,(pr,lb) in enumerate(zip(props,labels)):
    ph=W*0.075; pw=min(pr.width*ph/pr.height, W*0.09)
    cx=W*(0.70+0.105*i); by=H*0.86
    place(L,pr,cx,by,pw)
    tag(L,cx,by+14,lb,26)
L.convert('RGB').save(os.path.join(D,'mockup-landscape.png'))
print('ok',P.size,L.size)
