# python3 paint_textures.py <outdir>   (reads <outdir>/data/params.json, base atlas body-r3/tex/T_G2_FACE.jpg)
# FACE atlas 1024 (UV, v up). Face tile = bottom-left quadrant, planar u = 0.25 + x*2.5, v = (z-uv_z0)*2.5
#   (uv_z0 moved from 1.41 to 1.455 for the taller Hunyuan face; blink cells stay clear of the white bib patch at v .865+).
#   Eye group (_tag_eyes: eye discs + lash ridges) blink by UV offset: OPEN (0,0), HALF (0,+0.5), CLOSED (+0.5,0).
#   Body colour patches of body-r3 are kept (yellow, white, fold strip, socks, sole, leather, hand skin);
#   shoe leather/sole re-tinted to the V12 red-brown.
# HEAD 512: left half hat straw + pink band (v .75-.95); right half hair: u .53-.97 = lock phase (seam dark .. centre light),
#   row (top=0) = (1.69 - z)/0.27 ; broken highlight ring per lock.
import sys, os, math, json, numpy as np
from PIL import Image, ImageDraw, ImageFilter
OUT=sys.argv[1]; HERE=os.path.dirname(os.path.abspath(__file__))
P=json.load(open(os.path.join(OUT,'data','params.json'))); E=P['eye']; Z0=P['uv_z0']
BASE=os.environ.get('FACE_BASE',os.path.join(HERE,'../../body-r3/tex/T_G2_FACE.jpg'))
S=4096
SKIN=(255,227,207)
im=Image.open(BASE).convert('RGB').resize((S,S),Image.LANCZOS); d=ImageDraw.Draw(im,'RGBA')
def uv2px(u,v): return (u*S,(1-v)*S)
def px(x,z,du=0,dv=0): return uv2px(0.25+x*2.5+du,(z-Z0)*2.5+dv)
def L(m): return m*2.5*S
def rect_uv(u0,v0,u1,v1,c): d.rectangle([*uv2px(u0,v1),*uv2px(u1,v0)],fill=c)
# clear face tile + old blink cells (keep white patch v>.86 and colour strips v>.35 on the right)
rect_uv(0.0,0.0,0.5,0.5,SKIN); rect_uv(0.0,0.5,0.5,0.858,SKIN); rect_uv(0.5,0.0,1.0,0.352,SKIN)
# shoes: V12 red-brown leather, darker sole/welt
rect_uv(0.55,0.427,0.95,0.472,(178,70,52)); rect_uv(0.55,0.388,0.95,0.427,(110,44,36))
# blush
bl=Image.new('L',(S,S),0); bd=ImageDraw.Draw(bl); B=P['blush']
for sx in (-1,1):
    cx,cy=px(sx*B['x'],B['z']); rx,ry=L(B['rx']),L(B['rz']); bd.ellipse([cx-rx,cy-ry,cx+rx,cy+ry],fill=110)
bl=bl.filter(ImageFilter.GaussianBlur(S*0.006)); im.paste(Image.new('RGB',(S,S),(250,158,148)),(0,0),bl)
d=ImageDraw.Draw(im,'RGBA')
# brows (outside the blink rect)
BR=P['brow']; BROW=(96,70,72)
for sx in (-1,1):
    pts=[]
    for k in range(17):
        a=k/16; x=sx*(BR['x0']+a*(BR['x1']-BR['x0'])); z=BR['z']+math.sin(a*math.pi)*BR['arch']-0.0016*a
        pts.append(px(x,z))
    d.line(pts,fill=BROW+(225,),width=int(L(0.0016)),joint='curve')
# nose hint + mouth
NZ=P['nose']['z']
d.line([px(0.0012,NZ-0.0035),px(-0.0006,NZ-0.0058)],fill=(224,170,155,170),width=int(L(0.0011)))
M=P['mouth']
pts=[px((k/14*2-1)*M['w'], M['z']-0.0017*(1-(k/14*2-1)**2)+0.0010*(k/14*2-1)**4) for k in range(15)]
d.line(pts,fill=(208,112,110,235),width=int(L(0.0011)),joint='curve')
# blink rect (all eye-group vertices live inside it)
RECT=dict(x0=-(E['cx']+E['w']*1.18+0.008),x1=E['cx']+E['w']*1.18+0.008,z0=E['cz']-E['h']*1.16-0.004,z1=E['cz']+E['h']*1.16+0.004)
OFF={'open':(0.0,0.0),'half':(0.0,0.5),'closed':(0.5,0.0)}
x0,y0=px(RECT['x0'],RECT['z1']); x1,y1=px(RECT['x1'],RECT['z0'])
bg=im.crop((int(x0),int(y0),int(x1),int(y1)))
for st,(du,dv) in OFF.items():
    if st!='open': im.paste(bg,(int(x0+du*S),int(y0-dv*S)))
LASH=(46,28,30); IRIS_D=(52,30,24); IRIS_L=(150,96,64); PUP=(26,14,12)
def lid_curve(t,sx):
    x=E['cx']+(t*2-1)*E['w']; z=E['cz']+E['h']*E['lid_y']*0.82+math.sin(t*math.pi)*E['h']*E['lid_curv']*0.55-0.0018*t
    return sx*x,z
def eye(sx,state):
    du,dv=OFF[state]; cx,cy=px(sx*E['cx'],E['cz'],du,dv); w,h=L(E['w']),L(E['h'])
    dd=ImageDraw.Draw(im,'RGBA')
    if state=='closed':
        pts=[(cx+(k/24*2-1)*w*0.98, cy+h*0.05+math.sin(k/24*math.pi)*h*0.26) for k in range(25)]
        dd.line(pts,fill=LASH,width=int(L(0.0022)),joint='curve')
        ox=cx+sx*w*0.98; dd.line([(ox,cy+h*0.05),(ox+sx*w*0.16,cy-h*0.06)],fill=LASH,width=int(L(0.0014)))
        return
    # lid line in pixel space (same curve as the 3D lash ridge)
    lid=[px(*lid_curve(k/24,sx),du,dv) for k in range(25)]
    if state=='half':
        lid=[(x,y+h*0.62) for x,y in lid]
    mask=Image.new('L',(S,S),0); md=ImageDraw.Draw(mask)
    md.ellipse([cx-w*0.96,cy-h*1.10,cx+w*0.96,cy+h*0.98],fill=255)
    top=sorted(lid,key=lambda p:p[0])
    md.polygon([(top[0][0]-w,cy-h*2),(top[-1][0]+w,cy-h*2),(top[-1][0]+w,top[-1][1]),*top[::-1],(top[0][0]-w,top[0][1])],fill=0)
    layer=Image.new('RGBA',(S,S),(0,0,0,0)); ld=ImageDraw.Draw(layer)
    ld.ellipse([cx-w*0.96,cy-h*1.10,cx+w*0.96,cy+h*0.98],fill=(252,247,245,255))
    iw,ih=w*0.80,h*0.95
    g=np.zeros((int(2*ih)+2,int(2*iw)+2,4),np.uint8); yy,xx=np.mgrid[0:g.shape[0],0:g.shape[1]]
    e=((xx-iw)/iw)**2+((yy-ih)/ih)**2<=1; t=(yy/g.shape[0])[...,None]**1.3
    rim=np.clip((((xx-iw)/iw)**2+((yy-ih)/ih)**2-0.72)/0.28,0,1)[...,None]
    col=np.array(IRIS_D)*(1-t)+np.array(IRIS_L)*t; col=col*(1-0.45*rim)
    g[...,:3]=col.astype(np.uint8); g[...,3]=e*255
    ir=Image.fromarray(g); layer.paste(ir,(int(cx-iw),int(cy-ih*1.02)),ir); ld=ImageDraw.Draw(layer)
    pw,ph=iw*0.40,ih*0.42; ld.ellipse([cx-pw,cy-ph*0.6,cx+pw,cy+ph*1.2],fill=PUP+(235,))
    ld.ellipse([cx-iw*0.66,cy-ih*0.72,cx-iw*0.66+iw*0.66,cy-ih*0.72+iw*0.66],fill=(255,255,255,252))
    ld.ellipse([cx+iw*0.20,cy+ih*0.34,cx+iw*0.20+iw*0.30,cy+ih*0.34+iw*0.30],fill=(255,255,255,220))
    im.paste(layer,(0,0),Image.composite(layer.getchannel('A'),Image.new('L',(S,S),0),mask))
    dd=ImageDraw.Draw(im,'RGBA')
    if state=='open':
        # lash band covers the 3D lash ridge footprint (lid line .. lid + thickness)
        n=len(lid); band=[]
        for k,(x,y) in enumerate(lid):
            tt=k/(n-1); th=E['lash_t0']+(E['lash_t1']-E['lash_t0'])*tt**1.5
            band.append((x,y-L(th)-L(0.0009)))
        dd.polygon([(x,y+L(0.0007)) for x,y in lid]+band[::-1],fill=LASH)
        ox,oy=lid[-1]; dd.polygon([(ox,oy),(ox+sx*L(0.0048),oy-L(0.0020)),(ox,oy-L(0.0028))],fill=LASH)
        dd.line([(cx-w*0.45,cy+h*0.98),(cx+w*0.40,cy+h*0.98)],fill=(150,96,90,150),width=int(L(0.0008)))
        dd.line([px(*lid_curve(k/12,sx),du,dv) for k in range(2,11)],fill=(0,0,0,0))
    else:
        dd.line(lid,fill=LASH,width=int(L(0.0020)),joint='curve')
for st in OFF:
    for sx in (-1,1): eye(sx,st)
im.resize((1024,1024),Image.LANCZOS).save(f'{OUT}/tex/T_G2_FACE.jpg',quality=88)
im.resize((1024,1024),Image.LANCZOS).save(f'{OUT}/tex/face_atlas_preview.png')
json.dump(dict(eye=E,rect=RECT,uv_offsets=OFF,planar=f'u=0.25+x*2.5, v=(z-{Z0})*2.5 (Blender UV, v up); glTF v = 1-v'),open(f'{OUT}/tex/face_atlas_layout.json','w'),indent=1)
# ---------------- HEAD 512 ----------------
H=512; yy,xx=np.mgrid[0:H,0:H]/H
key=[(0.0,(20,24,52)),(0.25,(26,32,66)),(0.50,(38,48,88)),(0.78,(64,78,120)),(1.0,(84,100,140))]
col=np.zeros((H,H,3))
for c in range(3): col[...,c]=np.interp(yy,[k for k,_ in key],[v[c] for _,v in key])
g=np.clip((0.5+xx/2-0.53)/0.44,0,1)               # lock phase across the final atlas u (right half)
prof=0.58+0.42*np.sin(g*np.pi/2)**0.9               # seams dark, lock centres light
col*=prof[...,None]
zrow=(1.69-1.585)/0.27
ring=np.exp(-((yy-zrow)/0.035)**2)*np.clip((g-0.35)/0.5,0,1)**1.2
col=col+ring[...,None]*(np.array([128,146,188])-col)*0.55
col*=(1+0.025*np.sin(yy*2*np.pi*14+xx*9))[...,None]
hm=np.zeros((H,H,3)); base=np.array([226,190,128.]); wv=0.5+0.5*np.sin(xx*H*1.8)*np.sin(yy*H*0.9)
hm[:]=base*(0.90+0.10*wv[...,None]); hm[int(0.05*H):int(0.25*H)]=np.array([222,96,124.])
hm[int(0.05*H):int(0.065*H)]*=0.85; hm[int(0.235*H):int(0.25*H)]*=0.85
out=np.concatenate([hm[:,::2],col[:,::2]],axis=1)
Image.fromarray(out.clip(0,255).astype(np.uint8)).save(f'{OUT}/tex/T_G2_HEAD.jpg',quality=88)
print('ok')
