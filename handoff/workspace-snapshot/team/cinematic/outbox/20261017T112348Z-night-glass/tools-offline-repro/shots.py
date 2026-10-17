import numpy as np, json, os
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import binary_dilation
from composite import compose
from glass import render
from tune import P, cr, lum
RAW='/workspace/wechat-game/ui-audit/2026-10-16/fixes-a4a1041/raw/'
OUT=os.environ['OUT']; os.makedirs(OUT,exist_ok=True)
x0,y0=150,800
DAYT=dict(text_rgb=(255,255,255),sh=(0,40,60,115),blur=6,off=(0,-1),outline=None)
NIT=dict(text_rgb=(232,226,212),sh=(20,12,5,200),blur=3,off=(0,-1),outline=((38,24,12,230),1.5))
OLD=lambda: P(0)  # pre-patch shader has no params3/4/5 == identity
NEW0=lambda: P(0,p3=(1,1,1,0),p4=(1,1,1,0),rimTint=(1,1,1))  # new shader at w=0 with CPU-blended values
NEW1=lambda: P(1,p3=(0.45,0.45,0.0,0),p4=(0.22,0.15,0.09,0),rimTint=(1,0.86,0.66))
def to8(a): return (np.clip(a,0,1)*255+0.5).astype(np.uint8)
def metrics(img,gl,ga,t):
    t=np.array(t)/255; ring=binary_dilation(ga>0.5,iterations=1)&(ga<0.5); near=binary_dilation(ga>0.05,iterations=3)
    c1=cr(t[None],img[ring]); c2=cr(t[None],gl[near])
    return {'caption_vs_adjacent_halo_1px':{'median':round(float(np.median(c1)),2),'p5':round(float(np.percentile(c1,5)),2)},
            'caption_vs_glass_without_text_effects':{'median':round(float(np.median(c2)),2),'p5':round(float(np.percentile(c2,5)),2),'min':round(float(c2.min()),2)}}
res={}
for mode in ('day','night'):
    bg=np.load(mode+'_bg.npy'); box=tuple(np.load(mode+'_box.npy')); full=np.asarray(Image.open(RAW+f'ib_{mode}_390_home_sign.png').convert('RGB')).astype(float)/255
    T=DAYT
    before,(glb,ga)=compose(bg,box,OLD(),**T)
    if mode=='day': after,(gla,ga2)=compose(bg,box,NEW0(),**DAYT)
    else: after,(gla,ga2)=compose(bg,box,NEW1(),**NIT)
    diff=float(np.abs(to8(before).astype(int)-to8(after).astype(int)).max())
    H,W=bg.shape[:2]
    for tag,img in (('before',before),('after',after)):
        f=full.copy(); f[y0:y0+H,x0:x0+W]=img
        Image.fromarray(to8(f)).resize((390,844),Image.LANCZOS).save(f'{OUT}/{mode}_glass_sign_context_390_{tag}.png')
        Image.fromarray(to8(img)).crop((40,40,360,200)).resize((1280,640),Image.LANCZOS).save(f'{OUT}/{mode}_glass_sign_4x_{tag}.png')
    real=full[y0:y0+H,x0:x0+W]
    Image.fromarray(to8(real)).crop((40,40,360,200)).resize((1280,640),Image.LANCZOS).save(f'{OUT}/{mode}_glass_sign_4x_MAC_a4a1041_reference.png')
    # side by side
    a=Image.open(f'{OUT}/{mode}_glass_sign_4x_before.png');b=Image.open(f'{OUT}/{mode}_glass_sign_4x_after.png')
    sbs=Image.new('RGB',(2560,690),(20,20,20));sbs.paste(a,(0,50));sbs.paste(b,(1280,50));d=ImageDraw.Draw(sbs)
    fnt=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',30,index=2)
    d.text((20,8),f'{mode.upper()} BEFORE (97b761d)',fill=(255,255,255),font=fnt);d.text((1300,8),f'{mode.upper()} AFTER (night-glass-r4)',fill=(255,255,255),font=fnt)
    sbs.save(f'{OUT}/{mode}_glass_sign_before_after_4x.png')
    tb=(255,255,255); ta=DAYT['text_rgb'] if mode=='day' else NIT['text_rgb']
    res[mode]={'max_abs_pixel_diff_before_vs_after_0_255':diff,'before':metrics(before,glb,ga,tb),'after':metrics(after,gla,ga2,ta),
               'base_layer_mean_alpha_inside_card':{'before':round(float(render(H,W,box,OLD())[...,3][ga<0.01].mean()),4)}}
    # glass whiteness: mean luminance of the card body (excluding text) before/after
    from glass import sdcap
    ys,xs=np.mgrid[0:H,0:W]+0.5; cx,cy,ux,uy,vx,vy=box; M=np.linalg.inv(np.array([[ux,vx],[uy,vy]])); dx=xs-cx; dy=ys-cy
    lx=(M[0,0]*dx+M[0,1]*dy+0.5)*280; ly=(M[1,0]*dx+M[1,1]*dy+0.5)*100; inside=(sdcap(lx,ly,140,50,50)<-6)&~binary_dilation(ga>0.02,iterations=6)&~binary_dilation(ga2>0.02,iterations=6)
    res[mode]['card_body_mean_luminance']={'backdrop':round(float(lum(bg[inside]).mean()),4),'before':round(float(lum(before[inside]).mean()),4),'after':round(float(lum(after[inside]).mean()),4)}
json.dump(res,open(f'{OUT}/glass_sign_metrics.json','w'),indent=1,ensure_ascii=False);print(json.dumps(res,indent=1))
