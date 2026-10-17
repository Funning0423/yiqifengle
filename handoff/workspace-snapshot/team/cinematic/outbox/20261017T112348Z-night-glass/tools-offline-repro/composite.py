import numpy as np, json, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy.ndimage import map_coordinates
from glass import render
FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
LEAF='/workspace/tmp-nightglass/wt/creator-build-project/assets/resources/world/glass-sign-leaf.png'
SS=4
def text_layers(text_rgb, sh_rgba, sh_blur, sh_off, outline=None):
    """card-local RGBA layers (premult float) at SS x, 280x100 local px. Returns glyph alpha, layer premult."""
    W,H=280*SS,100*SS
    f=ImageFont.truetype(FONT,34*SS,index=2)  # SC
    cap='出发去看海'; sp=4*SS
    ws=[f.getlength(c) for c in cap]; capW=(sum(ws)+sp*(len(cap)-1))/SS
    visW=(41-7)*44/48; visL=7*44/48; total=visW+6+capW; left=-total/2
    leafX=left-visL+22; capX=left+visW+6+capW/2
    g=Image.new('L',(W,H),0); d=ImageDraw.Draw(g)
    x=(140+capX-capW/2)*SS; asc,desc=f.getmetrics(); y=(50-1)*SS-(asc+desc)/2+ (desc*0.0)
    for c,w in zip(cap,ws): d.text((x,y+ SS*1.5),c,font=f,fill=255); x+=w+sp
    ga=np.asarray(g).astype(float)/255
    shadow=Image.fromarray((ga*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sh_blur*SS/2))
    sa=np.roll(np.asarray(shadow).astype(float)/255,int(-sh_off[1]*SS),0)*sh_rgba[3]/255
    layer=np.zeros((H,W,4))
    if outline:
        from scipy.ndimage import grey_dilation
        rr=int(round(outline[1]*SS)); yy,xx=np.mgrid[-rr:rr+1,-rr:rr+1]; fp=(xx*xx+yy*yy)<=rr*rr
        oa=grey_dilation(ga,footprint=fp)*outline[0][3]/255
    else: oa=None
    layer[...,:3]=np.array(sh_rgba[:3])/255*sa[...,None]; layer[...,3]=sa
    leaf=Image.open(LEAF).convert('RGBA').resize((44*SS,44*SS),Image.LANCZOS); la=np.asarray(leaf).astype(float)/255
    lx0=int((140+leafX-22)*SS); ly0=int((50-1-22)*SS)
    lp=np.zeros((H,W,4)); lp[ly0:ly0+44*SS,lx0:lx0+44*SS,:3]=la[...,:3]*la[...,3:4]; lp[ly0:ly0+44*SS,lx0:lx0+44*SS,3]=la[...,3]
    tp=np.zeros((H,W,4)); tp[...,:3]=np.array(text_rgb)/255*ga[...,None]; tp[...,3]=ga
    def over(t,u): return t+u*(1-t[...,3:4])
    if oa is not None:
        ol=np.zeros((H,W,4)); ol[...,:3]=np.array(outline[0][:3])/255*oa[...,None]; ol[...,3]=oa; layer=over(ol,layer)
    out=over(tp,over(lp,layer))
    return out, ga, la, (lx0,ly0)
def warp(layer,box,H,W):
    cx,cy,ux,uy,vx,vy=box; ys,xs=np.mgrid[0:H,0:W].astype(float)+0.5
    M=np.linalg.inv(np.array([[ux,vx],[uy,vy]])); dx=xs-cx; dy=ys-cy
    px=(M[0,0]*dx+M[0,1]*dy+0.5)*280*SS-0.5; py=(M[1,0]*dx+M[1,1]*dy+0.5)*100*SS-0.5
    return np.stack([map_coordinates(layer[...,c],[py,px],order=1,cval=0) for c in range(layer.shape[2])],-1)
def compose(bg,box,gparams,text_rgb,sh,blur,off,outline=None):
    H,W=bg.shape[:2]; g=render(H,W,box,gparams)
    out=g[...,:3]+bg*(1-g[...,3:4])
    tl,ga,la,lo=text_layers(text_rgb,sh,blur,off,outline); t=warp(tl,box,H,W)
    return t[...,:3]+out*(1-t[...,3:4]), (out, warp(np.dstack([ga]),box,H,W)[...,0])
