import math, io, numpy as np, cairosvg
from PIL import Image, ImageFilter, ImageChops
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

CREAM='#FFF6E2'; OUTL='#2D555B'; TEAL='#2FA7B0'; ORANGE='#E5814A'; BLUE='#4C78C8'; LH='#F3EAD3'

def svg2img(svg,w,h):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=w,output_height=h))).convert('RGBA')

font=TTFont('LXGWWenKai-Medium.ttf'); gs=font.getGlyphSet(); cmap=font.getBestCmap()
def glyph_d(ch,x,y,size,rot=0):
    s=size/1000.0
    pen=SVGPathPen(gs)
    c,sn=math.cos(math.radians(rot)),math.sin(math.radians(rot))
    # glyph coords -> rotate about glyph centre (500,380), scale, flip y
    cx,cy=500,380
    # matrix: T(x,y)*S(s,-s)*T(cx,cy)*R*T(-cx,-cy)
    a,b,cc,d=c*s, -sn*s, -sn*s*1, -c*s
    # compute properly: p' = S*R*(p-c)+S*c + (x,y)   with S=diag(s,-s)
    a= s*c; b=-s*sn; cc=-s*sn; d=-s*c
    a,b,cc,d = s*c, -s*sn, -s*(-sn), -s*c
    # affine (a b c d e f) means x'=a*x+c*y+e, y'=b*x+d*y+f
    A,B,C,D = s*c, -s*sn, -s*sn, -s*c
    A,B,C,D = s*c, -s*sn, s*(-sn)*-1*-1, -s*c
    # Simplest explicit: rotation R=[[c,-sn],[sn,c]] applied in glyph space, then flip/scale
    # x' = s*(c*(px-cx) - sn*(py-cy)) + s*cx + x
    # y' = -s*(sn*(px-cx) + c*(py-cy)) - s*cy + y
    A=s*c; C=-s*sn; E=s*(-c*cx+sn*cy)+s*cx+x
    B=-s*sn; D=-s*c; F=-s*(-sn*cx-c*cy)-s*cy+y
    tp=TransformPen(pen,(A,B,C,D,E,F))
    gs[cmap[ord(ch)]].draw(tp)
    return pen.getCommands()

def taper(pts_fn, n, w0, w1, wmid, t0=0, t1=1):
    """tapered stroke polygon along parametric centreline"""
    L=[];R=[]
    for i in range(n+1):
        t=t0+(t1-t0)*i/n
        x,y=pts_fn(t); x2,y2=pts_fn(min(t+1e-3,1)); x1,y1=pts_fn(max(t-1e-3,0))
        dx,dy=x2-x1,y2-y1; l=math.hypot(dx,dy) or 1; nx,ny=-dy/l,dx/l
        u=i/n; w=(w0*(1-u)+w1*u)+wmid*math.sin(math.pi*u)
        L.append((x+nx*w/2,y+ny*w/2)); R.append((x-nx*w/2,y-ny*w/2))
    pts=L+R[::-1]
    return 'M'+' L'.join(f'{a:.1f},{b:.1f}' for a,b in pts)+'Z'

def bez(p0,p1,p2,p3):
    def f(t):
        mt=1-t
        return (mt**3*p0[0]+3*mt*mt*t*p1[0]+3*mt*t*t*p2[0]+t**3*p3[0],
                mt**3*p0[1]+3*mt*mt*t*p1[1]+3*mt*t*t*p2[1]+t**3*p3[1])
    return f

# ---------------- TITLE ----------------
TW,TH=600,230
def title_shapes():
    d=[]
    # A4 layout: single centred line, upright; WenKai Medium glyphs
    d.append(glyph_d('咦',20,170,128,0))
    d.append(glyph_d('，',138,170,128,0))
    d.append(glyph_d('起',212,170,128,0))
    d.append(glyph_d('风',330,170,128,0))
    d.append(glyph_d('了',446,170,128,0))
    glyphs=' '.join(d)
    leaf='M0,0Z'
    # original treatment: a light wind stroke that leaves the hook of 风 and curls past 了
    f=bez((236,196),(360,212),(500,206),(566,166))
    curl=bez((566,166),(590,146),(578,122),(560,132))
    sw=taper(f,60,3,3.5,4)+' '+taper(curl,24,3.5,1.5,1)
    return glyphs, leaf, sw, 'M0,0Z'
def make_title():
    glyphs,leaf,swoosh,sw3=title_shapes()
    def layer(fill,stroke,sw,extra=''):
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="{TW}" height="{TH}" viewBox="0 0 {TW} {TH}">'\
          f'<g fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round">'\
          f'<path d="{glyphs}"/><path d="{leaf}"/><path d="{swoosh}"/><path d="{sw3}"/></g>{extra}</svg>'
    outline=svg2img(layer(OUTL,OUTL,7),TW,TH)
    outline.putalpha(outline.split()[3].point(lambda v:int(v*0.55)))
    fill=svg2img(layer(CREAM,CREAM,2.4),TW,TH)
    # colour accents: leaf teal, lower swoosh light teal
    acc=svg2img(f'<svg xmlns="http://www.w3.org/2000/svg" width="{TW}" height="{TH}"><path d="{swoosh}" fill="#BDE9E6" stroke="#BDE9E6" stroke-width="1"/></svg>',TW,TH)
    # vertical warm gradient on fill
    g=np.linspace(0,1,TH)[:,None]
    top=np.array([255,253,246]);bot=np.array([248,229,196])
    grad=(top*(1-g)+bot*g)[:, None, :].repeat(TW,1).reshape(TH,TW,3)
    fa=np.array(fill).astype(float)
    fa[...,:3]=grad
    fill=Image.fromarray(fa.astype(np.uint8))
    # shadow
    sh_a=svg2img(layer(OUTL,OUTL,10),TW,TH).split()[3].filter(ImageFilter.GaussianBlur(7))
    sh=Image.new('RGBA',(TW,TH),(22,74,82,0)); sh.putalpha(sh_a.point(lambda v:int(v*0.55)))
    out=Image.new('RGBA',(TW,TH),(0,0,0,0))
    out.alpha_composite(sh,(2,6))
    out.alpha_composite(outline)
    out.alpha_composite(fill)
    out.alpha_composite(acc)
    bb=out.getbbox(); out=out.crop((max(bb[0]-4,0),max(bb[1]-4,0),min(bb[2]+4,TW),min(bb[3]+6,TH)))
    return out

# ---------------- LOGO (low-poly lighthouse + wind) ----------------
LS=200
def make_logo():
    s=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{LS}" height="{LS}" viewBox="0 0 200 200">
<g stroke-linejoin="round">
 <!-- rock base -->
 <polygon points="42,176 70,154 100,160 98,182 54,184" fill="#8FA39A"/>
 <polygon points="98,182 100,160 132,152 160,174 150,184" fill="#6F857D"/>
 <polygon points="70,154 100,146 132,152 100,160" fill="#A9BBB1"/>
 <!-- tower: low-poly facets -->
 <polygon points="78,160 86,84 100,84 100,160" fill="#FFF8E8"/>
 <polygon points="100,160 100,84 114,84 122,160" fill="#E8D8B8"/>
 <polygon points="80,140 84,108 100,112 100,144" fill="#F6EBD2"/>
 <polygon points="100,144 100,112 116,108 120,140" fill="#D9C7A3"/>
 <!-- teal band -->
 <polygon points="81,128 82,118 100,120 100,130" fill="{TEAL}"/>
 <polygon points="100,130 100,120 118,118 119,128" fill="#23848C"/>
 <!-- door -->
 <path d="M95,160 L95,149 Q100,143 105,149 L105,160Z" fill="#7A5236"/>
 <!-- gallery -->
 <polygon points="78,86 122,86 120,80 80,80" fill="#8A5A3A"/>
 <polygon points="100,86 122,86 120,80 100,80" fill="#6E4630"/>
 <!-- lantern room glow -->
 <polygon points="86,80 88,62 100,62 100,80" fill="#FFE39A"/>
 <polygon points="100,80 100,62 112,62 114,80" fill="#F7C866"/>
 <line x1="94" y1="63" x2="93" y2="79" stroke="#B9874C" stroke-width="1.6"/>
 <line x1="106" y1="63" x2="107" y2="79" stroke="#B9874C" stroke-width="1.6"/>
 <!-- roof -->
 <polygon points="82,63 100,38 100,63" fill="#F0985F"/>
 <polygon points="100,63 100,38 118,63" fill="#C9683A"/>
 <polygon points="80,64 120,64 117,59 83,59" fill="#B85B30" opacity=".9"/>
 <circle cx="100" cy="35" r="3.2" fill="#C9683A"/>
</g>
<!-- three wind lines (original) -->
<g fill="none" stroke-linecap="round">
 <path d="M126,58 C146,50 162,56 176,52 C188,48 190,36 180,34 C172,33 170,42 176,44" stroke="{TEAL}" stroke-width="5"/>
 <path d="M130,76 C150,70 166,78 186,70" stroke="#5FC2C6" stroke-width="4.2"/>
 <path d="M126,94 C142,90 152,96 168,92" stroke="#9FDCD8" stroke-width="3.6"/>
</g>
</svg>'''
    # outline pass so it reads on any bg
    im=svg2img(s,LS,LS)
    a=im.split()[3]
    ol=a.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
    olimg=Image.new('RGBA',im.size,(45,85,91,0)); olimg.putalpha(ol.point(lambda v:int(v*0.9)))
    sh=Image.new('RGBA',im.size,(22,74,82,0)); sh.putalpha(ol.filter(ImageFilter.GaussianBlur(5)).point(lambda v:int(v*.35)))
    out=Image.new('RGBA',im.size,(0,0,0,0)); out.alpha_composite(sh,(0,4)); out.alpha_composite(olimg); out.alpha_composite(im)
    bb=out.getbbox(); return out.crop((bb[0]-2,bb[1]-2,bb[2]+2,bb[3]+4)), s

# ---------------- PROGRESS: ribbon + pinwheel ----------------
BL=480
BH=44
AMP=5.0; LAM=135.0
def ribbon_y(x): return BH/2 + AMP*math.sin(2*math.pi*x/LAM)
def ribbon_svg(length, track=False):
    # twisting ribbon: width modulated by |cos|, front/back colours alternate
    polys=[]
    N=int(length/2)
    W0=9.0
    pts=[]
    for i in range(N+1):
        x=length*i/N; y=ribbon_y(x)
        tw=math.cos(2*math.pi*x/(LAM*1.5)+0.6)
        w=W0*(0.35+0.65*abs(tw))
        pts.append((x,y,w,tw))
    segs=[]
    cur=[];sign=None
    for p in pts:
        sg=p[3]>=0
        if sign is None: sign=sg
        if sg!=sign:
            cur.append(p); segs.append((sign,cur)); cur=[p]; sign=sg
        else: cur.append(p)
    segs.append((sign,cur))
    out=[]
    for sg,ps in segs:
        if len(ps)<2: continue
        top=[(x,y-w/2) for x,y,w,_ in ps]; bot=[(x,y+w/2) for x,y,w,_ in ps][::-1]
        d='M'+' L'.join(f'{a:.1f},{b:.1f}' for a,b in top+bot)+'Z'
        if track: col='#FFF6E2'; 
        else: col='#FFF8EA' if sg else '#C9ECE8'
        out.append(f'<path d="{d}" fill="{col}"/>')
        if not track and sg:  # light top edge facet
            hi=[(x,y-w/2) for x,y,w,_ in ps]; hi2=[(x,y-w/2+w*0.32) for x,y,w,_ in ps][::-1]
            out.append('<path d="M'+' L'.join(f'{a:.1f},{b:.1f}' for a,b in hi+hi2)+'Z" fill="#FFFFFF" opacity=".55"/>')
        if not track and not sg:
            lo=[(x,y+w/2) for x,y,w,_ in ps]; lo2=[(x,y+w/2-w*0.35) for x,y,w,_ in ps][::-1]
            out.append('<path d="M'+' L'.join(f'{a:.1f},{b:.1f}' for a,b in lo+lo2)+'Z" fill="#8FCFCB" opacity=".8"/>')
    return ''.join(out)

def make_track():
    W=BL+16
    s=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{BH}"><g transform="translate(8,0)">{ribbon_svg(BL,True)}</g></svg>'
    im=svg2img(s,W,BH); a=im.split()[3].point(lambda v:int(v*0.38)); im.putalpha(a)
    # thin dark under-line for contrast
    sh=Image.new('RGBA',im.size,(30,70,76,0)); sh.putalpha(im.split()[3].filter(ImageFilter.GaussianBlur(2)).point(lambda v:int(v*0.6)))
    out=Image.new('RGBA',im.size,(0,0,0,0)); out.alpha_composite(sh,(0,2)); out.alpha_composite(im); return out

def make_fill():
    W=BL+16
    s=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{BH}"><g transform="translate(8,0)">{ribbon_svg(BL)}</g></svg>'
    im=svg2img(s,W,BH)
    a=im.split()[3]
    ol=a.filter(ImageFilter.MaxFilter(3))
    oli=Image.new('RGBA',im.size,(45,85,91,0)); oli.putalpha(ol.point(lambda v:int(v*.55)))
    sh=Image.new('RGBA',im.size,(22,74,82,0)); sh.putalpha(ol.filter(ImageFilter.GaussianBlur(3)).point(lambda v:int(v*.4)))
    out=Image.new('RGBA',im.size,(0,0,0,0)); out.alpha_composite(sh,(0,3)); out.alpha_composite(oli); out.alpha_composite(im); return out

PW=72
def make_pinwheel():
    c=36; R=30
    cols=[(ORANGE,'#C9683A'),(BLUE,'#36599E'),(LH,'#D8C9A6'),(TEAL,'#23848C')]
    parts=[]
    for k,(lt,dk) in enumerate(cols):
        ang=k*90
        # classic pinwheel blade: triangle centre -> corner -> mid-edge folded
        parts.append(f'<g transform="rotate({ang} {c} {c})">'
          f'<polygon points="{c},{c} {c},{c-R} {c+R*0.78},{c-R*0.78}" fill="{lt}"/>'
          f'<polygon points="{c},{c} {c+R*0.78},{c-R*0.78} {c+R*0.18},{c-R*0.08}" fill="{dk}"/>'
          f'</g>')
    s=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{PW}" height="{PW}"><g stroke="#2D555B" stroke-width="1.6" stroke-linejoin="round">{''.join(parts)}</g>
<circle cx="{c}" cy="{c}" r="4.2" fill="#8A5A3A" stroke="#2D555B" stroke-width="1.2"/><circle cx="{c-1.2}" cy="{c-1.2}" r="1.4" fill="#F7C866"/></svg>'''
    im=svg2img(s,PW,PW)
    sh=Image.new('RGBA',im.size,(22,74,82,0)); sh.putalpha(im.split()[3].filter(ImageFilter.GaussianBlur(3)).point(lambda v:int(v*.4)))
    out=Image.new('RGBA',im.size,(0,0,0,0)); out.alpha_composite(sh,(1,3)); out.alpha_composite(im); return out

if __name__=='__main__':
    import os; os.makedirs('out',exist_ok=True)
    t=make_title(); t.save('out/title.png'); print('title',t.size)
    l,ls=make_logo(); l.save('out/logo.png'); open('out/logo.svg','w').write(ls); print('logo',l.size)
    make_track().save('out/bar_track.png'); make_fill().save('out/bar_fill.png'); make_pinwheel().save('out/pinwheel.png')
