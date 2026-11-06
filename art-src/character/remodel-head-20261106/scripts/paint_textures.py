# Nahoko / Wind Rises face atlas. Ghibli: smaller almond dark eyes, thin brows, soft mouth, subtle blush.
# Atlas layout matches head-r2: OPEN (0,0), HALF (0,+0.5), CLOSED (+0.5,0).
import sys, math, json, numpy as np
from PIL import Image, ImageDraw, ImageFilter
OUT=sys.argv[1]; S=4096
SKIN=(255,228,210); YEL=(226,170,46); YEL_SH=(200,148,38); WHT=(250,244,232); WHT_SH=(230,222,210)
def uv2px(u,v): return (u*S,(1-v)*S)
def px(x,z,du=0,dv=0): return uv2px(0.25+x*2.5+du,(z-1.41)*2.5+dv)
def L(m): return m*2.5*S
# Smaller almond eyes than head-r2 (was w=0.0192 h=0.0215) — Ghibli scale
EYE=dict(cx=0.0265,cz=1.517,w=0.0125,h=0.0086)
RECT=dict(x0=-0.052,x1=0.052,z0=1.488,z1=1.536)
OFF={'open':(0.0,0.0),'half':(0.0,0.5),'closed':(0.5,0.0)}
im=Image.new('RGB',(S,S),SKIN); d=ImageDraw.Draw(im,'RGBA')
d.rectangle([*uv2px(0.55,0.95),*uv2px(0.95,0.80)],fill=YEL); d.rectangle([*uv2px(0.55,0.83),*uv2px(0.95,0.80)],fill=YEL_SH)
d.rectangle([*uv2px(0.05,0.98),*uv2px(0.45,0.88)],fill=WHT); d.rectangle([*uv2px(0.05,0.88),*uv2px(0.45,0.865)],fill=WHT_SH)
# soft cheek blush (warm, subtle — Ghibli)
bl=Image.new('L',(S,S),0); bd=ImageDraw.Draw(bl)
for sx in (-1,1):
    cx,cy=px(sx*0.042,1.482); rx,ry=L(0.014),L(0.007); bd.ellipse([cx-rx,cy-ry,cx+rx,cy+ry],fill=85)
bl=bl.filter(ImageFilter.GaussianBlur(S*0.010)); im.paste(Image.new('RGB',(S,S),(245,165,155)),(0,0),bl)
d=ImageDraw.Draw(im,'RGBA')
# thin soft brows — outside eye patch so they stay during blink
BROW=(78,58,52)
for sx in (-1,1):
    pts=[]
    for k in range(18):
        a=k/17
        # slight arch, soft outer taper; brows closer to eyes (Ghibli)
        x=sx*(0.014+a*0.024)
        z=1.534+math.sin(a*math.pi)*0.0020-0.0005*a
        pts.append(px(x,z))
    d.line(pts,fill=BROW+(210,),width=max(2,int(L(0.00095))),joint='curve')
# soft Ghibli nose: thin bridge line + tip shade (front-readable)
for i,a in enumerate([0.75,0.55,0.40,0.28]):
    nx,ny=px(0.0010, 1.520-0.008*i)
    d.ellipse([nx-L(0.0010),ny-L(0.0022),nx+L(0.0020),ny+L(0.0016)],fill=(218,175,160,int(85*a)))
# tip underside
d.ellipse([*px(-0.0025,1.488), *px(0.0035,1.480)], fill=(220,175,160,100))
# tiny nostril hint (very soft)
d.ellipse([*px(-0.0030,1.486), *px(-0.0005,1.483)], fill=(200,150,140,90))
d.ellipse([*px(0.0010,1.486), *px(0.0035,1.483)], fill=(200,150,140,90))
# small natural mouth — soft muted rose, NOT a bold red U
pts=[px((k/16*2-1)*0.0042, 1.4730 + 0.00035*math.sin(k/16*math.pi)) for k in range(17)]
d.line(pts,fill=(168,108,100,200),width=max(2,int(L(0.00075))),joint='curve')
# copy eye-rect bg into HALF/CLOSED cells
x0,y0=px(RECT['x0'],RECT['z1']); x1,y1=px(RECT['x1'],RECT['z0'])
bg=im.crop((int(x0),int(y0),int(x1),int(y1)))
for st,(du,dv) in OFF.items():
    if st!='open': im.paste(bg,(int(x0+du*S),int(y0-dv*S)))
d=ImageDraw.Draw(im,'RGBA')
# Ghibli eye: dark almond, simple upper lash, tiny soft highlight (not big shiny anime iris)
LASH=(42,30,28); IRIS=(48,32,28); WHITE=(248,244,240)
def arc(cx,cy,w,h,yoff,curv,n=28):
    return [(cx+(k/(n-1)*2-1)*w, cy+yoff-math.sin(k/(n-1)*math.pi)*curv) for k in range(n)]
def eye(sx,state):
    du,dv=OFF[state]; cx,cy=px(sx*EYE['cx'],EYE['cz'],du,dv); w,h=L(EYE['w']),L(EYE['h'])
    dd=ImageDraw.Draw(im,'RGBA')
    if state=='closed':
        pts=[(cx+(k/24*2-1)*w*1.05, cy+math.sin(k/24*math.pi)*h*0.35) for k in range(25)]
        dd.line(pts,fill=LASH,width=max(2,int(L(0.0014))),joint='curve')
        return
    # True almond: pointed inner/outer canthi, flatter top than round anime eye
    n=32; poly=[]
    for k in range(n):
        a=k/(n-1)  # 0..1 left to right
        # horizontal: slightly asymmetric (outer longer)
        x=cx+(a*2-1)*w*(1.02 if (a<0.5)==(sx<0) else 1.08)
        # upper lid (shallower) and we'll build upper then lower
        yu=cy - h*(0.55*math.sin(a*math.pi)**0.85 + 0.08)
        poly.append((x,yu))
    for k in range(n-1,-1,-1):
        a=k/(n-1)
        x=cx+(a*2-1)*w*(1.02 if (a<0.5)==(sx<0) else 1.08)
        yl=cy + h*(0.42*math.sin(a*math.pi)**1.1 + 0.05)
        poly.append((x,yl))
    mask=Image.new('L',(S,S),0); ImageDraw.Draw(mask).polygon(poly,fill=255)
    layer=Image.new('RGBA',(S,S),(0,0,0,0)); ld=ImageDraw.Draw(layer)
    ld.polygon(poly,fill=WHITE+(255,))
    # dark iris fills most of almond; soft edge; tiny single highlight
    iw,ih=w*0.55,h*0.78
    g=np.zeros((max(2,int(2*ih)+2),max(2,int(2*iw)+2),4),np.uint8)
    yy,xx=np.mgrid[0:g.shape[0],0:g.shape[1]]
    e=((xx-iw)/(iw+1e-6))**2+((yy-ih)/(ih+1e-6))**2<=1
    t=(yy/max(1,g.shape[0]-1))[...,None]
    base=np.array(IRIS,float); lite=np.array([70,48,40],float)
    g[...,:3]=(base*(1-0.30*t)+lite*(0.30*t)).astype(np.uint8); g[...,3]=(e*255).astype(np.uint8)
    ir=Image.fromarray(g)
    iy = cy - ih*0.55 if state=='open' else cy - ih*0.15
    layer.paste(ir,(int(cx-iw),int(iy)),ir); ld=ImageDraw.Draw(layer)
    hs=max(2,int(L(0.0014)))
    ld.ellipse([cx-iw*0.15-hs, iy+ih*0.35-hs, cx-iw*0.15+hs, iy+ih*0.35+hs],fill=(255,255,255,160))
    if state=='half':
        # cover upper half with skin-coloured lid
        lid_poly=poly[:n]+[(poly[n-1][0],cy+h*0.1),(poly[0][0],cy+h*0.1)]
        ld.polygon([(cx-w*1.2,cy-h*2),(cx+w*1.2,cy-h*2),(cx+w*1.2,cy+h*0.05),(cx-w*1.2,cy+h*0.05)],fill=SKIN+(230,))
    a=Image.composite(layer.getchannel('A'),Image.new('L',(S,S),0),mask)
    im.paste(layer,(0,0),a)
    dd=ImageDraw.Draw(im,'RGBA')
    # upper lash curve (simple Ghibli line, thicker outer)
    lid=[(cx+(k/(n-1)*2-1)*w*1.05, cy - h*(0.55*math.sin(k/(n-1)*math.pi)**0.85 + 0.10) - L(0.0004)) for k in range(n)]
    top=[]
    for k,(x,y) in enumerate(lid):
        o=(k/(n-1)) if sx>0 else 1-k/(n-1)
        top.append((x,y-L(0.0006)-L(0.0009)*o**1.4))
    dd.polygon(lid+top[::-1],fill=LASH)
    if state=='open':
        dd.line([(cx+(k/14*2-1)*w*0.7, cy+h*0.48+math.sin(k/14*math.pi)*h*0.12) for k in range(15)],fill=(140,95,85,120),width=max(1,int(L(0.00045))),joint='curve')

for st in OFF:
    for sx in (-1,1): eye(sx,st)
im.resize((1024,1024),Image.LANCZOS).save(f'{OUT}/T_G2_FACE.jpg',quality=90)
im.resize((1024,1024),Image.LANCZOS).save(f'{OUT}/face_atlas_preview.png')
json.dump(dict(eye=EYE,rect=RECT,uv_offsets=OFF,style='nahoko-ghibli-v1'),open(f'{OUT}/face_atlas_layout.json','w'),indent=1)
# HEAD 512: left hat straw+band, right hair navy gradient
H=512; yy,xx=np.mgrid[0:H,0:H]/H
# deeper navy bob (closer to Wind Rises reference)
key=[(0.0,(18,22,42)),(0.28,(24,30,58)),(0.55,(36,46,82)),(0.78,(58,72,110)),(1.0,(78,92,128))]
col=np.zeros((H,H,3))
for c in range(3):
    col[...,c]=np.interp(yy,[k for k,_ in key],[v[c] for _,v in key])
band=np.exp(-((yy-0.38)/0.05)**2)*(0.5+0.5*np.sin(xx*2*np.pi*18)**2)
col=col+band[...,None]*(np.array([96,112,150])-col)*0.35
col*=(1+0.015*np.sin(xx*2*np.pi*8)+0.01*np.sin(xx*2*np.pi*15+1.1))[...,None]
hm=np.zeros((H,H,3)); base=np.array([220,186,128.]); wv=0.5+0.5*np.sin(xx*H*1.6)*np.sin(yy*H*0.85)
hm[:]=base*(0.90+0.10*wv[...,None])
# pink/red hat band
hm[int(0.05*H):int(0.25*H)]=np.array([210,88,112.])
out=np.where((xx<0.50)[...,None],hm,col)
Image.fromarray(out.clip(0,255).astype(np.uint8)).save(f'{OUT}/T_G2_HEAD.jpg',quality=90)
print('painted nahoko face+hat/hair ->',OUT)
