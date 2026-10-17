import numpy as np, os, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy.ndimage import binary_dilation, grey_dilation
from tune import lum, cr
RAW='/workspace/wechat-game/ui-audit/2026-10-16/fixes-a4a1041/raw/';OUT=os.environ['OUT']
box=(200,1470,590,1555); res={}
for mode in ('day','night'):
    full=Image.open(RAW+f'ib_{mode}_390_home_sign.png').convert('RGB'); a=np.asarray(full.crop(box)).astype(float)/255
    L=lum(a); m=binary_dilation((L>0.55)|(np.abs(a.mean(2)-np.median(a.mean(2)))>0.12)&(np.arange(a.shape[0])[:,None]>10)&(np.arange(a.shape[0])[:,None]<75),iterations=4)
    m[:8]=False;m[-8:]=False
    init=a.copy()
    for y in range(a.shape[0]):
        mm=m[y]
        if mm.any() and (~mm).any():
            for c in range(3): init[y,mm,c]=np.interp(np.where(mm)[0],np.where(~mm)[0],a[y,~mm,c])
    u=init
    for _ in range(800):
        nb=(np.roll(u,1,0)+np.roll(u,-1,0)+np.roll(u,1,1)+np.roll(u,-1,1))/4; u=np.where(m[...,None],nb,init)
    floor=u
    # draw label: 14 css px * dpr2 = 28 px, #fff2cf, outline 1 css px (2 device)
    SS=4; H,W=floor.shape[:2]
    f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',28*SS,index=2)
    s='向左轻拖，看看门口  ›'; g=Image.new('L',(W*SS,H*SS),0); d=ImageDraw.Draw(g); tw=d.textlength(s,font=f)
    d.text(((W*SS-tw)/2,(H*SS)/2-17*SS),s,font=f,fill=255)
    ga=np.asarray(g.resize((W,H),Image.LANCZOS)).astype(float)/255
    rr=2; yy,xx=np.mgrid[-rr:rr+1,-rr:rr+1]; oa=grey_dilation(ga,footprint=(xx*xx+yy*yy)<=rr*rr)
    t=np.array([255,242,207])/255
    out={}
    for tag,oc in (('before',(33,45,45,170)),('after',(33,45,45,170) if mode=='day' else (38,24,12,230))):
        o=np.array(oc[:3])/255; al=oa*oc[3]/255
        img=floor*(1-al[...,None])+o*al[...,None]; img=img*(1-ga[...,None])+t*ga[...,None]
        ring=binary_dilation(ga>0.5,iterations=1)&(ga<0.5)
        c=cr(t[None],img[ring]); cf=cr(t[None],floor[binary_dilation(ga>0.05,iterations=3)])
        out[tag]={'text_vs_adjacent_1px':{'median':round(float(np.median(c)),2),'p5':round(float(np.percentile(c,5)),2)},'text_vs_floor_no_outline':{'median':round(float(np.median(cf)),2),'p5':round(float(np.percentile(cf,5)),2)}}
        ff=full.copy(); ff.paste(Image.fromarray((np.clip(img,0,1)*255+.5).astype(np.uint8)),box[:2])
        ff.crop(box).resize((W*3,H*3),Image.LANCZOS).save(f'{OUT}/{mode}_room_hint_3x_{tag}.png')
    out['max_abs_pixel_diff']=0 if mode=='day' else None
    res[mode]=out
json.dump(res,open(f'{OUT}/room_hint_metrics.json','w'),indent=1);print(json.dumps(res,indent=1))
