import json,sys,numpy as np
from PIL import Image,ImageDraw,ImageFont
base,scene_p,outp=sys.argv[1:4]
sc=json.load(open(scene_p)); m=json.load(open(base+'_meta.json')); ids=np.load(base+'_ids.npy')
im=Image.open(base+'_raw.png').convert('RGBA'); W,H=im.size
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def hx(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+((int(h[6:8],16),) if len(h)>6 else (255,))
PPM=600
T=sc['text']; pl=sc.get('plateStyle')
if pl: rw,rh,quad=pl['widthM'],pl['heightM'],m['plate_px']
else: rw,rh,quad=1.44*0.9,0.48*0.8,m['text_px']
tw,th=int(rw*PPM),int(rh*PPM); tex=Image.new('RGBA',(tw,th),(0,0,0,0)); d=ImageDraw.Draw(tex)
if pl:
    e=pl['edgeM']*PPM; d.rounded_rectangle([e/2,e/2,tw-e/2,th-e/2],radius=pl['radiusM']*PPM,fill=hx(pl['fill']),outline=hx(pl['edge']),width=max(1,round(e)))
ch=0.32*PPM; f=ImageFont.truetype(FB,int(ch),index=2)
ol=round((T.get('outlinePx') or 0)/300*PPM)
bb=d.textbbox((0,0),T['string'],font=f,stroke_width=ol)
d.text((tw/2-(bb[2]-bb[0])/2-bb[0],th/2-(bb[3]-bb[1])/2-bb[1]),T['string'],font=f,fill=hx(T['color']),stroke_width=ol,stroke_fill=hx(T['color']))
# perspective: output px -> texture px
src=[(0,0),(tw,0),(tw,th),(0,th)]; A=[];B=[]
for (x,y),(u,v) in zip(quad,src):
    A.append([x,y,1,0,0,0,-u*x,-u*y]);B.append(u);A.append([0,0,0,x,y,1,-v*x,-v*y]);B.append(v)
coef=np.linalg.solve(np.array(A,float),np.array(B,float))
warp=tex.transform((W,H),Image.PERSPECTIVE,tuple(coef),Image.BICUBIC)
N=m['names']; sm=(ids==N.index('signpost')) if 'signpost' in N else np.zeros_like(ids,bool)
a=np.array(warp)[...,3].astype(float)*sm; wa=np.array(warp); wa[...,3]=a.astype(np.uint8)
im=Image.alpha_composite(im,Image.fromarray(wa))
# bottom tags (IslandJourneyOverlay numbers, day colours)
d=ImageDraw.Draw(im)
for t in sc['tags']:
    x0,y0=W/2+t['x']-t['width']/2,H/2-(t['y']+t['height']/2); x1,y1=x0+t['width'],y0+t['height']; r=(y1-y0)/2
    d.rounded_rectangle([x0,y0+2,x1,y1+2],radius=r,fill=hx('#14323c5a')); d.rounded_rectangle([x0,y0,x1,y1],radius=r,fill=hx('#f8f2e2'),outline=hx('#956737'),width=max(2,int(t['fontSize']/10)))
    f2=ImageFont.truetype(FB,int(t['fontSize']),index=2); bb=d.textbbox((0,0),t['label'],font=f2); d.text(((x0+x1)/2-(bb[2]-bb[0])/2-bb[0],(y0+y1)/2-(bb[3]-bb[1])/2-bb[1]),t['label'],font=f2,fill=hx('#633f21'))
im.convert('RGB').save(outp)
