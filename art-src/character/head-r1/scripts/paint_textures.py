# python3 paint_textures.py <outdir>   -> face_1024.png (painted), T_G2_FACE.jpg (512), T_G2_HEAD.jpg (256)
import sys, math, numpy as np
from PIL import Image, ImageDraw, ImageFilter
OUT=sys.argv[1]
S=2048  # supersample, final 512
SKIN=(248,224,208); SKIN_SH=(238,205,190)
YEL=(250,222,40); YEL_SH=(222,190,28)
# planar mapping used by build_head.py: u = 0.375 + x*3.75 ; v = (z-1.41)*4.0  (v up)
def px(x,z): return ((0.375+x*3.75)*S, (1-(z-1.41)*4.0)*S)
def L(m): return m*3.75*S  # meters -> px (horizontal); vertical uses 4.0
im=Image.new('RGB',(S,S),SKIN); d=ImageDraw.Draw(im,'RGBA')
# yellow patch (collar) region u .80-.98 v .40-.62 ; skin patch u .80-.98 v .05-.30
d.rectangle([0.78*S,(1-0.64)*S,S,(1-0.38)*S],fill=YEL)
d.rectangle([0.78*S,(1-0.44)*S,S,(1-0.38)*S],fill=YEL_SH)
# blush
bl=Image.new('L',(S,S),0); bd=ImageDraw.Draw(bl)
for sx in (-1,1):
    cx,cy=px(sx*0.046,1.498); rx,ry=L(0.016),L(0.008)
    bd.ellipse([cx-rx,cy-ry,cx+rx,cy+ry],fill=110)
bl=bl.filter(ImageFilter.GaussianBlur(S*0.012)); im.paste(Image.new('RGB',(S,S),(240,150,150)),(0,0),bl); d=ImageDraw.Draw(im,'RGBA')
LASH=(58,36,32); IRIS_D=(92,52,30); IRIS_L=(170,108,58); PUP=(45,24,16)
def eye(sx):
    cx,cy=px(sx*0.034,1.527); w,h=L(0.0165),L(0.0190)   # half sizes
    # white
    d.ellipse([cx-w*0.92,cy-h*0.80,cx+w*0.92,cy+h*0.95],fill=(255,252,250))
    # iris (vertical gradient)
    iw,ih=w*0.70,h*0.92
    ir=Image.new('RGBA',(int(2*iw)+2,int(2*ih)+2),(0,0,0,0)); g=np.zeros((ir.height,ir.width,4),np.uint8)
    yy,xx=np.mgrid[0:ir.height,0:ir.width]; ex=((xx-iw)/iw)**2+((yy-ih)/ih)**2<=1
    t=(yy/ir.height)[...,None]; col=np.array(IRIS_D)*(1-t)+np.array(IRIS_L)*t
    g[...,:3]=col.astype(np.uint8); g[...,3]=ex*255; ir=Image.fromarray(g)
    im.paste(ir,(int(cx-iw),int(cy-ih*0.88)),ir)
    dd=ImageDraw.Draw(im,'RGBA')
    pw,ph=iw*0.45,ih*0.45; dd.ellipse([cx-pw,cy-ph*0.6,cx+pw,cy+ph*1.2],fill=PUP+(235,))
    # highlights
    dd.ellipse([cx-iw*0.55+ sx*0, cy-ih*0.62, cx-iw*0.55+iw*0.55, cy-ih*0.62+iw*0.55],fill=(255,255,255,245))
    dd.ellipse([cx+iw*0.25, cy+ih*0.35, cx+iw*0.25+iw*0.25, cy+ih*0.35+iw*0.25],fill=(255,255,255,200))
    # upper lash line: thick arc, outer end flicks
    pts=[]
    for k in range(25):
        a=k/24; x=cx+(a*2-1)*w*1.02*sx*-1
        y=cy-h*0.78-math.sin(a*math.pi)*h*0.22
        pts.append((x,y))
    dd.line(pts,fill=LASH,width=int(S*0.0085),joint='curve')
    ox=cx+sx*w*1.02; dd.line([(ox,cy-h*0.78),(ox+sx*w*0.25,cy-h*0.95)],fill=LASH,width=int(S*0.004))
    # crease
    pts=[(cx+(k/12*2-1)*w*0.8,cy-h*1.08-math.sin(k/12*math.pi)*h*0.18) for k in range(13)]
    dd.line(pts,fill=(205,160,150,170),width=int(S*0.0022))
    # lower lash hint
    dd.line([(cx-w*0.35,cy+h*0.93),(cx+w*0.35,cy+h*0.93)],fill=(140,90,80,150),width=int(S*0.0022))
    # brow
    bx,by=px(sx*0.035,1.562)
    pts=[(bx+(k/12*2-1)*w*1.05,by-math.sin(k/12*math.pi)*h*0.18+((k/12)-0.5)*sx*h*0.10) for k in range(13)]
    dd.line(pts,fill=(58,44,56,240),width=int(S*0.0050),joint='curve')
for sx in (-1,1): eye(sx)
d=ImageDraw.Draw(im,'RGBA')
# nose: tiny shadow
nx,ny=px(0.003,1.500); d.line([(nx,ny-L(0.002)),(nx-L(0.002),ny+L(0.001))],fill=(215,160,145,200),width=int(S*0.0025))
# mouth: soft small smile
mx,my=px(0,1.474); pts=[(mx+(k/10*2-1)*L(0.0065),my+math.sin(k/10*math.pi)*L(0.0012)) for k in range(11)]
d.line(pts,fill=(196,104,104,235),width=int(S*0.003),joint='curve')
im.resize((1024,1024),Image.LANCZOS).save(f'{OUT}/face_1024_preview.png')
im.resize((512,512),Image.LANCZOS).save(f'{OUT}/T_G2_FACE.jpg',quality=88)
# hat 256: straw weave everywhere, pink band strip v .80-.95
H=512; hm=np.zeros((H,H,3),float); yy,xx=np.mgrid[0:H,0:H]
base=np.array([226,190,128.]); wv=0.5+0.5*np.sin(xx*0.9)*np.sin(yy*0.9)
hm[:]=base*(0.90+0.10*wv[...,None])
hm[int((1-0.95)*H):int((1-0.80)*H)]=np.array([214,96,120.])
Image.fromarray(hm.clip(0,255).astype(np.uint8)).resize((256,256),Image.LANCZOS).save(f'{OUT}/T_G2_HEAD.jpg',quality=88)
print('ok')
