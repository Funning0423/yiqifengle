# python3 paint_textures.py <outdir>
# FACE atlas 1024 (UV, v up):  face tile  = bottom-left quadrant, planar  u = 0.25 + x*2.5 , v = (z-1.41)*2.5
#   eye patch rect (both eyes) x in [-0.058,0.058], z in [1.494,1.547]
#   OPEN   = natural position (offset 0,0)
#   HALF   = same rect shifted (du,dv) = (0.0, +0.5)   -> top-left quadrant
#   CLOSED = same rect shifted (du,dv) = (+0.5, 0.0)   -> bottom-right quadrant
#   skin patch  u .55-.95 v .55-.75 ; yellow cloth patch u .55-.95 v .83-.95 (shade .80-.83) ; white u .05-.45 v .88-.98
import sys, math, json, numpy as np
from PIL import Image, ImageDraw, ImageFilter
OUT=sys.argv[1]; S=4096
SKIN=(255,226,205); YEL=(251,233,39); YEL_SH=(228,205,32); WHT=(253,239,230); WHT_SH=(226,214,208)
def uv2px(u,v): return (u*S,(1-v)*S)
def px(x,z,du=0,dv=0): return uv2px(0.25+x*2.5+du,(z-1.41)*2.5+dv)
def L(m): return m*2.5*S
EYE=dict(cx=0.0315,cz=1.509,w=0.0192,h=0.0215)
RECT=dict(x0=-0.057,x1=0.057,z0=1.482,z1=1.540)
OFF={'open':(0.0,0.0),'half':(0.0,0.5),'closed':(0.5,0.0)}
im=Image.new('RGB',(S,S),SKIN); d=ImageDraw.Draw(im,'RGBA')
d.rectangle([*uv2px(0.55,0.95),*uv2px(0.95,0.80)],fill=YEL); d.rectangle([*uv2px(0.55,0.83),*uv2px(0.95,0.80)],fill=YEL_SH)
# body-r1 patches: white (bib/straps) u .05-.45 v .88-.98 with a soft edge strip v .865-.88
d.rectangle([*uv2px(0.05,0.98),*uv2px(0.45,0.88)],fill=WHT); d.rectangle([*uv2px(0.05,0.88),*uv2px(0.45,0.865)],fill=WHT_SH)
# blush: soft, warm, below the eye patch
bl=Image.new('L',(S,S),0); bd=ImageDraw.Draw(bl)
for sx in (-1,1):
    cx,cy=px(sx*0.047,1.4735); rx,ry=L(0.016),L(0.0062); bd.ellipse([cx-rx,cy-ry,cx+rx,cy+ry],fill=105)
bl=bl.filter(ImageFilter.GaussianBlur(S*0.006)); im.paste(Image.new('RGB',(S,S),(250,160,150)),(0,0),bl)
d=ImageDraw.Draw(im,'RGBA')
# brows (outside the eye patch, stay during blink)
BROW=(122,86,74)
for sx in (-1,1):
    pts=[]
    for k in range(17):
        a=k/16; x=sx*(0.019+a*0.027); z=1.5480+math.sin(a*math.pi)*0.0036-0.0010*a
        pts.append(px(x,z))
    d.line(pts,fill=BROW+(225,),width=int(L(0.0015)),joint='curve')
# nose hint + mouth (gentle smile)
d.line([px(0.0015,1.4935),px(-0.0005,1.4915)],fill=(222,168,152,190),width=int(L(0.0012)))
pts=[px((k/14*2-1)*0.0058, 1.4770-0.0018*(1-(k/14*2-1)**2)+0.0012*(k/14*2-1)**4) for k in range(15)]
d.line(pts,fill=(214,118,116,230),width=int(L(0.0011)),joint='curve')
# copy the eye-rect background into the HALF/CLOSED cells before drawing eyes
x0,y0=px(RECT['x0'],RECT['z1']); x1,y1=px(RECT['x1'],RECT['z0'])
bg=im.crop((int(x0),int(y0),int(x1),int(y1)))
for st,(du,dv) in OFF.items():
    if st!='open': im.paste(bg,(int(x0+du*S),int(y0-dv*S)))
d=ImageDraw.Draw(im,'RGBA')
LASH=(52,32,30); IRIS_D=(58,34,26); IRIS_L=(132,88,62); PUP=(30,18,14)
def arc(cx,cy,w,h,sx,yoff,curv,n=25):
    return [(cx+(k/(n-1)*2-1)*w, cy+yoff-math.sin(k/(n-1)*math.pi)*curv) for k in range(n)]
def eye(sx,state):
    du,dv=OFF[state]; cx,cy=px(sx*EYE['cx'],EYE['cz'],du,dv); w,h=L(EYE['w']),L(EYE['h'])
    dd=ImageDraw.Draw(im,'RGBA')
    if state=='closed':
        pts=[(cx+(k/24*2-1)*w*0.95, cy+h*0.10+math.sin(k/24*math.pi)*h*0.28) for k in range(25)]
        dd.line(pts,fill=LASH,width=int(L(0.0024)),joint='curve')
        ox=cx+sx*w*0.95; dd.line([(ox,cy+h*0.10),(ox+sx*w*0.18,cy-h*0.02)],fill=LASH,width=int(L(0.0016)))
        return
    lid = -h*0.80 if state=='open' else -h*0.05      # upper lid y (relative)
    mask=Image.new('L',(S,S),0); md=ImageDraw.Draw(mask)
    md.ellipse([cx-w*0.94,cy-h*1.12,cx+w*0.94,cy+h*0.98],fill=255)
    lidpts=arc(cx,cy,w*1.0,h,sx,lid+(h*0.18 if state=='open' else 0),h*(0.38 if state=='open' else 0.10))
    md.polygon([(cx-w*1.2,cy-h*1.5),(cx+w*1.2,cy-h*1.5)]+lidpts[::-1],fill=0)
    layer=Image.new('RGBA',(S,S),(0,0,0,0)); ld=ImageDraw.Draw(layer)
    ld.ellipse([cx-w*0.94,cy-h*1.12,cx+w*0.94,cy+h*0.98],fill=(250,244,242,255))
    iw,ih=w*0.80,h*0.94
    g=np.zeros((int(2*ih)+2,int(2*iw)+2,4),np.uint8); yy,xx=np.mgrid[0:g.shape[0],0:g.shape[1]]
    e=((xx-iw)/iw)**2+((yy-ih)/ih)**2<=1; t=(yy/g.shape[0])[...,None]**1.2
    g[...,:3]=(np.array(IRIS_D)*(1-t)+np.array(IRIS_L)*t).astype(np.uint8); g[...,3]=e*255
    ir=Image.fromarray(g); layer.paste(ir,(int(cx-iw),int(cy-ih*1.06)),ir); ld=ImageDraw.Draw(layer)
    pw,ph=iw*0.42,ih*0.42; ld.ellipse([cx-pw,cy-ph*0.5,cx+pw,cy+ph*1.3],fill=PUP+(240,))
    ld.ellipse([cx-iw*0.62,cy-ih*0.66,cx-iw*0.62+iw*0.62,cy-ih*0.66+iw*0.62],fill=(255,255,255,250))
    ld.ellipse([cx+iw*0.22,cy+ih*0.36,cx+iw*0.22+iw*0.28,cy+ih*0.36+iw*0.28],fill=(255,255,255,215))
    im.paste(layer,(0,0),Image.composite(layer.getchannel('A'),Image.new('L',(S,S),0),mask))
    dd=ImageDraw.Draw(im,'RGBA')
    n=len(lidpts); top=[]
    for k,(x,y) in enumerate(lidpts):
        o=(k/(n-1)) if sx>0 else 1-k/(n-1)          # 0 inner .. 1 outer
        top.append((x,y-L(0.0012)-L(0.0016)*o**1.5))
    dd.polygon(lidpts+top[::-1],fill=LASH)
    ox,oy=(lidpts[-1] if sx>0 else lidpts[0])
    dd.polygon([(ox,oy),(ox+sx*w*0.16,oy+L(0.0006)),(ox,oy-L(0.0026))],fill=LASH)
    if state=='open':
        dd.line(arc(cx,cy,w*0.75,h,sx,-h*1.07,h*0.16,13),fill=(214,170,160,160),width=int(L(0.0007)))
        dd.line([(cx-w*0.40,cy+h*0.97),(cx+w*0.40,cy+h*0.97)],fill=(150,96,86,150),width=int(L(0.0008)))
for st in OFF:
    for sx in (-1,1): eye(sx,st)
im.resize((1024,1024),Image.LANCZOS).save(f'{OUT}/T_G2_FACE.jpg',quality=88)
im.resize((1024,1024),Image.LANCZOS).save(f'{OUT}/face_atlas_preview.png')
json.dump(dict(eye=EYE,rect=RECT,uv_offsets=OFF,planar='u=0.25+x*2.5, v=(z-1.41)*2.5 (Blender UV, v up); glTF v = 1-v'),open(f'{OUT}/face_atlas_layout.json','w'),indent=1)
# HEAD 512 (shared by M_G2_HEAD hat + M_G2_HAIR): left half u 0-.49 = hat straw (band strip v .75-.95),
#   right half u .51-1 = hair gradient: image row(top=0) = (1.665 - z)/0.23 ; u = .53 + .44*|azimuth|/180 (mirror, no seam)
H=512; yy,xx=np.mgrid[0:H,0:H]/H
key=[(0.0,(22,28,58)),(0.30,(28,36,72)),(0.55,(44,56,96)),(0.80,(74,90,130)),(1.0,(92,108,146))]
col=np.zeros((H,H,3))
for c in range(3):
    col[...,c]=np.interp(yy,[k for k,_ in key],[v[c] for _,v in key])
band=np.exp(-((yy-0.40)/0.045)**2)*(0.55+0.45*np.sin(xx*2*np.pi*22)**2)
col=col+band[...,None]*(np.array([110,128,170])-col)*0.45
col*=(1+0.02*np.sin(xx*2*np.pi*9)+0.015*np.sin(xx*2*np.pi*17+1.3))[...,None]
hm=np.zeros((H,H,3)); base=np.array([228,192,130.]); wv=0.5+0.5*np.sin(xx*H*1.8)*np.sin(yy*H*0.9)
hm[:]=base*(0.90+0.10*wv[...,None]); hm[int(0.05*H):int(0.25*H)]=np.array([222,96,124.])
hm[int(0.05*H):int(0.065*H)]*=0.85; hm[int(0.235*H):int(0.25*H)]*=0.85
out=np.concatenate([hm[:,::2],col[:,::2]],axis=1)
Image.fromarray(out.clip(0,255).astype(np.uint8)).save(f'{OUT}/T_G2_HEAD.jpg',quality=88)
print('ok')
