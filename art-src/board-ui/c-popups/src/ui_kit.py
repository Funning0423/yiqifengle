# Shared drawing kit for (c) popups: 9-slice panel, buttons, toggles, text. Used by compose.py / slices.py / night.py.
import os, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance, ImageOps
ROOT='/workspace/yiqifengle/previews/棋盘UI美术bot'
RAW=os.environ.get('CRAW',os.path.join(os.path.dirname(os.path.abspath(__file__)),'raw'))                # this folder's Blender renders (build_popups.py)
BRAW=os.path.join(ROOT,'c-popups/src/inputs/b_raw')                 # (b) renders: tools, stars of HUD, pieces, moss, hourglass, deco
W,H=750,1624; S=W/390.0
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; FR='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FK='/workspace/la/LXGWWenKai-Medium.ttf'                    # 霞鹜文楷 Medium v1.522, SIL OFL 1.1 (same as (a) title)
def font(px,bold=True): return ImageFont.truetype(FB if bold else FR,int(px),index=2)
def kfont(px): return ImageFont.truetype(FK,int(px))
BROWN=(99,63,33); BROWN2=(118,86,55); CREAM=(248,242,226); TEAL=(38,98,104); WHITE=(251,248,236)
# ---- night (propNightWeight = 1) : coefficients read from creator-build-project/assets/scripts/world-r2/IslandPropsLayout.ts ----
TAG_FILL,TAG_NIGHT_FILL='#f8f2e2','#9a8f7f'      # ISLAND_PROPS.tag.fill -> nightFill
TAG_TEXT_NIGHT='#2b1b0c'                          # ISLAND_PROPS.tag.nightText
SEA_NIGHT_TINT='#7f9fb3'                          # ISLAND_PROPS.seaNight.tint (sRGB-byte multiply, seaColorAt)
def _h(x): return tuple(int(x[i:i+2],16) for i in (1,3,5))
K_UI=tuple(n/d for n,d in zip(_h(TAG_NIGHT_FILL),_h(TAG_FILL)))   # (0.621,0.591,0.562) sprite multiply for UI / board props
K_SEA=tuple(c/255 for c in _h(SEA_NIGHT_TINT))                     # (0.498,0.624,0.702) background multiply
# PM 决定 6：宝箱和星星夜间只乘一半的夜间色（保留一点暖光）：K_HALF = 1 − (1 − K_UI)/2
K_HALF=tuple(1-(1-k)/2 for k in K_UI)                               # (0.811,0.796,0.781)
NIGHT=os.environ.get('NIGHT')=='1'
def mul(im,k):
    r,g,b,a=im.split(); return Image.merge('RGBA',(r.point(lambda v:int(v*k[0]+.5)),g.point(lambda v:int(v*k[1]+.5)),b.point(lambda v:int(v*k[2]+.5)),a))
if NIGHT:
    BROWN=(30,19,8); BROWN2=(34,23,11); TEAL=(6,30,34); WHITE=(232,226,212); CREAM=_h(TAG_NIGHT_FILL)   # nightText #2b1b0c gives 4.41:1 on the darker night paper -> one step deeper
def L(n,raw=None):
    for d in ([raw] if raw else [RAW,BRAW]):
        p=os.path.join(d,n+'.png')
        if os.path.exists(p): return Image.open(p).convert('RGBA')
    raise FileNotFoundError(n)
def crop(im): return im.crop(im.getbbox())
def scaled(im,f): return im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
def fitw(im,w): return scaled(im,w/im.width)
def fith(im,h): return scaled(im,h/im.height)
def paste_c(dst,im,cx,cy): dst.alpha_composite(im,(round(cx-im.width/2),round(cy-im.height/2)))
def shadow_of(im,blur,alpha,grow=0):
    a=im.getchannel('A').point(lambda v:255 if v>8 else 0)
    if grow: a=a.filter(ImageFilter.MaxFilter(grow*2+1))
    a=a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v:int(v*alpha))
    sh=Image.new('RGBA',im.size,(40,30,20,0)); sh.putalpha(a); return sh
def pad(im,p):
    o=Image.new('RGBA',(im.width+2*p,im.height+2*p),(0,0,0,0)); o.alpha_composite(im,(p,p)); return o
def drop(dst,im,cx,cy,blur=10,alpha=0.35,dy=10,grow=0):
    im2=pad(im,blur*3); sh=shadow_of(im2,blur,alpha,grow)
    dst.alpha_composite(sh,(round(cx-im2.width/2)+2,round(cy-im2.height/2)+dy)); paste_c(dst,im,cx,cy)
# ---------- 9-slice / 3-slice ----------
def nine(src,ins,w,h,scale=1.0):
    """src: frame image, ins=(l,t,r,b) source px insets; output w×h; corners drawn at `scale`."""
    l,t,r,b=ins; sw,sh=src.size
    L_,T_,R_,B_=[round(v*scale) for v in ins]
    out=Image.new('RGBA',(w,h),(0,0,0,0))
    xs=[(0,l,0,L_),(l,sw-r,L_,w-R_),(sw-r,sw,w-R_,w)]; ys=[(0,t,0,T_),(t,sh-b,T_,h-B_),(sh-b,sh,h-B_,h)]
    for (sx0,sx1,dx0,dx1) in xs:
        for (sy0,sy1,dy0,dy1) in ys:
            if dx1<=dx0 or dy1<=dy0: continue
            out.alpha_composite(src.crop((sx0,sy0,sx1,sy1)).resize((dx1-dx0,dy1-dy0),Image.LANCZOS),(dx0,dy0))
    return out
def three(src,lr,w,h):
    s=h/src.height; return nine(src,(lr,0,lr,0),w,h,s) if False else _three(src,lr,w,h)
def _three(src,lr,w,h):
    s=h/src.height; im=src.resize((round(src.width*s),h),Image.LANCZOS); e=round(lr*s)
    out=Image.new('RGBA',(w,h),(0,0,0,0)); out.alpha_composite(im.crop((0,0,e,h)),(0,0))
    out.alpha_composite(im.crop((e,0,im.width-e,h)).resize((w-2*e,h),Image.LANCZOS),(e,0)); out.alpha_composite(im.crop((im.width-e,0,im.width,h)),(w-e,0))
    return out
# ---------- assets (lazily cropped) ----------
_C={}
def A(n):
    if n not in _C:
        im=crop(L(n))
        if n.startswith('chest') or n=='star_full' or n.startswith('reward_seal'): im=focus_grade(im)   # focal items forward ((b) v2 rule)
        _C[n]=im if not NIGHT else mul(im,K_HALF if is_half(n) else K_UI)
    return _C[n]
def is_half(n): return n.startswith('chest') or n.startswith('star_')
def focus_grade(im,bright=1.0):
    a=im.getchannel('A'); rgb=ImageEnhance.Contrast(ImageEnhance.Color(im.convert('RGB')).enhance(1.22)).enhance(1.10)
    if bright!=1.0: rgb=ImageEnhance.Brightness(rgb).enhance(bright)
    o=rgb.convert('RGBA'); o.putalpha(a); return o
FRAME_INS=(118,118,118,118)      # source px insets on raw panel_frame (640², 100 px/unit) – rim + corner pegs inside
FRAME_SCALE=0.78
def panel(w,h):
    return nine(A('panel_frame_clean'),FRAME_INS,round(w),round(h),FRAME_SCALE)   # 精简版：无角钉（Funning 确认，全部弹窗）
def text_c(d,cx,y,txt,f,fill,anchor='mt'): d.text((cx,y),txt,font=f,fill=fill,anchor=anchor)
# ---------- baked 霞鹜文楷 titles (same method as a-loading/src/gen.py: fontTools outlines -> SVG -> cairosvg) ----------
import io
_TF=None
def baked_title(txt,size=46):
    """deep-brown vertical gradient fill + cream outline (light plank → dark text, a-loading uses cream fill on sky);"""
    global _TF
    import cairosvg, numpy as np
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    if _TF is None: _TF=TTFont(FK)
    gs=_TF.getGlyphSet(); cmap=_TF.getBestCmap(); s=size/1000.0; x=10; ds=[]
    for ch in txt:
        g=cmap[ord(ch)]; pen=SVGPathPen(gs); gs[g].draw(TransformPen(pen,(s,0,0,-s,x,size*0.88+8))); ds.append(pen.getCommands())
        x+=gs[g].width*s*(0.62 if ch in '，？' else 1.0)
    TW,TH=int(x+12),int(size*1.22+16); d=' '.join(ds)
    def layer(col,sw): return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=(f'<svg xmlns="http://www.w3.org/2000/svg" width="{TW}" height="{TH}"><path d="{d}" fill="{col}" stroke="{col}" stroke-width="{sw}" stroke-linejoin="round"/></svg>').encode(),output_width=TW,output_height=TH))).convert('RGBA')
    out=layer('#FFF6E2',6); out.putalpha(out.getchannel('A').point(lambda v:int(v*0.85)))
    fill=layer('#000000',0.8); g=np.linspace(0,1,TH)[:,None,None]
    grad=(np.array([112,72,38])*(1-g)+np.array([78,48,22])*g).repeat(TW,1)
    fa=np.array(fill).astype(float); fa[...,:3]=grad; out.alpha_composite(Image.fromarray(fa.astype('uint8')))
    return crop(out) if not NIGHT else mul(crop(out),K_UI)
def title_plank(txt,minw=300):
    pl=A('title_plank_clean'); h=round(pl.height*0.56)   # 精简版：无绳无钉
    t=baked_title(txt); w=max(minw,t.width+150); im=_three(pl,150,w,h)
    im.alpha_composite(t,(round(w/2-t.width/2),round(h*0.52-t.height/2))); return im
def button(kind,txt,w,h=96,icon=None,fsize=34,isc=None):
    src=A('btn_primary' if kind=='primary' else 'btn_secondary')
    im=_three(src,110,round(w),h); d=ImageDraw.Draw(im)
    col=WHITE if kind=='primary' else BROWN
    f=font(fsize); tw=d.textlength(txt,font=f); cy=h*0.47
    if icon is not None:
        ic=fith(A(icon),h*(isc or (0.40 if icon=='icon_play' else 0.62))); gap=12; x0=w/2-(ic.width+gap+tw)/2
        im.alpha_composite(ic,(round(x0),round(cy-ic.height/2))); d.text((x0+ic.width+gap,cy),txt,font=f,fill=col,anchor='lm')
    else: d.text((w/2,cy),txt,font=f,fill=col,anchor='mm')
    return im
def toggle(on,h=60):
    tr=fith(A('toggle_on' if on else 'toggle_off'),h); kn=fith(A('toggle_knob'),h*0.86)
    im=pad(tr,8); cx=8+(tr.width-h*0.5 if on else h*0.5); cy=8+h*0.48
    im.alpha_composite(shadow_of(pad(kn,6),3,0.35),(round(cx-kn.width/2-6+1),round(cy-kn.height/2-6+3)))
    paste_c(im,kn,cx,cy); return im
def slider(v,w=250,h=34):
    # music volume: toggle_off track 3-sliced as the rail, toggle_on track clipped to v as the fill, toggle_knob as the thumb (0 new art)
    off=fith(A('toggle_off'),h); on=fith(A('toggle_on'),h); e=h//2
    rail=_three(off,e,w,h); fill=_three(on,e,w,h); fw=max(h,round(w*v))
    rail.alpha_composite(fill.crop((0,0,fw,h)),(0,0))
    kn=fith(A('toggle_knob'),h*1.5); im=pad(rail,round(h*0.5)); p=round(h*0.5)
    cx=p+fw-h*0.5; cy=p+h*0.48
    im.alpha_composite(shadow_of(pad(kn,6),3,0.35),(round(cx-kn.width/2-6+1),round(cy-kn.height/2-6+3))); paste_c(im,kn,cx,cy); return im
def badge(n,r=22,dim=False):
    im=Image.new('RGBA',(2*r+8,2*r+10),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse((5,8,5+2*r,8+2*r),fill=(60,40,20,70)); d.ellipse((4,4,4+2*r,4+2*r),fill=CREAM,outline=(149,103,55),width=3)
    t=('×%d'%n) if isinstance(n,int) else n; f=font(round(r*1.05))
    d.text((4+r,4+r),t,font=f,fill=BROWN,anchor='mm'); return im
def mask(bg,blur=7,dark=0.35):
    b=bg.convert('RGB').filter(ImageFilter.GaussianBlur(blur)); b=Image.blend(b,Image.new('RGB',b.size,(16,28,34)),dark)
    return b.convert('RGBA')
def divider(d,x0,x1,y):
    for x in range(int(x0),int(x1),18): d.line((x,y,x+9,y),fill=(196,166,120),width=3)
def sysui(img):
    # WeChat capsule + status bar mock (context only, not game art) – same as (b)
    d=ImageDraw.Draw(img); x0,y0,x1,y1=[v*S for v in (297,51,384,83)]
    d.rounded_rectangle((x0,y0,x1,y1),radius=(y1-y0)/2,fill=(30,50,60,120),outline=(255,255,255,90),width=2)
    d.ellipse((x0+22,(y0+y1)/2-6,x0+34,(y0+y1)/2+6),fill=(255,255,255,230)); d.ellipse((x0+40,(y0+y1)/2-6,x0+52,(y0+y1)/2+6),fill=(255,255,255,230))
    d.ellipse((x1-46,(y0+y1)/2-14,x1-18,(y0+y1)/2+14),outline=(255,255,255,230),width=4)
    d.text((24,14),'9:41',font=font(28),fill=(255,255,255)); d.rounded_rectangle((375-70,H-22,375+70,H-12),radius=5,fill=(30,30,30,170))

PW=680   # 精简规则：所有弹窗统一宽 680
