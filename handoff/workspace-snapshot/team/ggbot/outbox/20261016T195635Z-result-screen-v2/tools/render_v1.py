import json, sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=2
BUN='/workspace/wechat-game/yiqifengle-result/creator-build-project/assets/bundles/board_art/'
BG={'day':'/workspace/wechat-game/ui-audit/2026-10-16/build05-home-2607de6/frames/final_25_h_day_142.05.png','night':'/workspace/wechat-game/ui-audit/2026-10-16/build05-home-2607de6/frames/final_25_h_night_224.55.png'}
FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
import os
if not os.path.exists(FONT):
    import glob; FONT=(glob.glob('/usr/share/fonts/**/NotoSansCJK*Bold*',recursive=True) or glob.glob('/usr/share/fonts/**/*CJK*',recursive=True))[0]
cache={}
def img(path):
    if path not in cache: cache[path]=Image.open(BUN+path+'.png').convert('RGBA')
    return cache[path]
def tint(im,c,a,gray):
    im=im.copy()
    if gray:
        g=im.convert('LA').convert('RGBA'); g.putalpha(im.getchannel('A')); im=g
    r,g_,b,al=im.split()
    r=r.point(lambda v:v*c['r']//255); g_=g_.point(lambda v:v*c['g']//255); b=b.point(lambda v:v*c['b']//255)
    al=al.point(lambda v:int(v*(c.get('a',255)/255)*a))
    return Image.merge('RGBA',(r,g_,b,al))
def nine(im,w,h,ins,k):
    L,R,T,B=ins; W,H=im.size
    l,r,t,b=[max(0,int(round(v*k))) for v in (L,R,T,B)]
    if l+r>w: s=w/max(1,l+r); l=int(l*s); r=w-l
    if t+b>h: s=h/max(1,t+b); t=int(t*s); b=h-t
    out=Image.new('RGBA',(max(1,w),max(1,h)))
    xs=[(0,L,0,l),(L,W-R,l,w-r),(W-R,W,w-r,w)]; ys=[(0,T,0,t),(T,H-B,t,h-b),(H-B,H,h-b,h)]
    for sx0,sx1,dx0,dx1 in xs:
        for sy0,sy1,dy0,dy1 in ys:
            if sx1<=sx0 or sy1<=sy0 or dx1<=dx0 or dy1<=dy0: continue
            out.paste(im.crop((sx0,sy0,sx1,sy1)).resize((dx1-dx0,dy1-dy0),Image.LANCZOS),(dx0,dy0))
    return out
def main(src,dst,chest_closed,chest_open,note):
    d=json.load(open(src)); W,H=d['w'],d['h']
    bg=Image.open(BG[d['mode']]).convert('RGBA').resize((W*S,H*S),Image.LANCZOS).filter(ImageFilter.GaussianBlur(10*S))
    can=bg.copy(); dr=ImageDraw.Draw(can,'RGBA')
    X=lambda x:(W/2+x)*S; Y=lambda y:(H/2-y)*S
    for o in d['ops']:
        w=abs(o['w']*o['sx'])*S; h=abs(o['h']*o['sy'])*S
        cx=X(o['x']); cy=Y(o['y']); x0=cx-o['ax']*w; y0=cy-(1-o['ay'])*h
        if o['t']=='s' and o.get('path'):
            if o['name']=='ResultChestArt' and chest_closed:
                # the engine shows the 3D chest here (flat art hides once it loads); substitute the Blender render of result_chest.glb
                src_im=Image.open(chest_open if d['state']=='claimed' else chest_closed).convert('RGBA')
                im=src_im.resize((max(1,int(w)),max(1,int(h))),Image.LANCZOS)  # full 512² RenderTexture stretched to the node box, as the engine Sprite does
                c=o['color']; im=tint(im,c,o['a'],False)
                can.alpha_composite(im,(int(cx-im.width/2),int(cy-im.height/2))); continue
            base=img(o['path'])
            if o['type']==1 and any(o['ins']): im=nine(base,int(w),int(h),o['ins'],abs(o['sx'])*S)
            else: im=base.resize((max(1,int(w)),max(1,int(h))),Image.LANCZOS)
            im=tint(im,o['color'],o['a'],o['gray'])
            if o.get('rot'): im=im.rotate(o['rot'],expand=True,resample=Image.BICUBIC); can.alpha_composite(im,(int(cx-im.width/2),int(cy-im.height/2)))
            else: can.alpha_composite(im,(int(x0),int(y0)))
        elif o['t']=='g':
            k=abs(o['sx'])*S; path=[]
            for op in o['ops']:
                n=op[0]
                P=lambda px,py:(cx+px*k, cy-py*k)
                if n=='roundRect':
                    _,x,y,ww,hh,r=op[:6]; a=P(x,y+hh); b=P(x+ww,y); path=[('rr',(a[0],a[1],b[0],b[1]),r*k)]
                elif n=='rect':
                    _,x,y,ww,hh=op[:5]; a=P(x,y+hh); b=P(x+ww,y); path=[('rr',(a[0],a[1],b[0],b[1]),0)]
                elif n=='circle':
                    _,x,y,r=op[:4]; a=P(x-r,y+r); b=P(x+r,y-r); path=[('el',(a[0],a[1],b[0],b[1]))]
                elif n=='moveTo': path=[('poly',[P(op[1],op[2])])] if not path or path[-1][0]!='poly' else path+[('poly',[P(op[1],op[2])])]
                elif n=='lineTo' and path and path[-1][0]=='poly': path[-1][1].append(P(op[1],op[2]))
                elif n in ('fill','stroke'):
                    c=op[-1]; col=(int(c['r']),int(c['g']),int(c['b']),int(c.get('a',255)*o['a']))
                    layer=Image.new('RGBA',can.size); ld=ImageDraw.Draw(layer)
                    for p in path:
                        if p[0]=='rr':
                            box=p[1]; box=(min(box[0],box[2]),min(box[1],box[3]),max(box[0],box[2]),max(box[1],box[3]))
                            if n=='fill': ld.rounded_rectangle(box,radius=p[2],fill=col)
                            else: ld.rounded_rectangle(box,radius=p[2],outline=col,width=max(1,int(2*S)))
                        elif p[0]=='el':
                            if n=='fill': ld.ellipse(p[1],fill=col)
                            else: ld.ellipse(p[1],outline=col,width=2)
                        elif p[0]=='poly' and len(p[1])>1:
                            if n=='fill' and len(p[1])>2: ld.polygon(p[1],fill=col)
                            else: ld.line(p[1],fill=col,width=max(1,int(2*S)))
                    can.alpha_composite(layer)
                    if n=='fill' or n=='stroke': pass
        elif o['t']=='l':
            fsz=int(o['fs']*abs(o['sy'])*S); f=ImageFont.truetype(FONT,max(6,fsz))
            c=o['color']; col=(int(c['r']),int(c['g']),int(c['b']),int(c.get('a',255)*o['a']))
            tw=dr.textlength(o['str'],font=f); al=o.get('align',1)
            tx = x0 if al==0 else (x0+w-tw if al==2 else cx-tw/2) if o['ax']==0.5 or al!=0 else x0
            if o['ax']==0 and al==0: tx=x0
            dr.text((tx,cy),o['str'],font=f,fill=col,anchor='lm')
    out=can.resize((W,H),Image.LANCZOS).convert('RGB')
    if note:
        dd=ImageDraw.Draw(out); f=ImageFont.truetype(FONT,11); dd.rectangle((0,H-18,W,H),fill=(0,0,0)); dd.text((4,H-9),note,font=f,fill=(255,255,255),anchor='lm')
    out.save(dst)
if __name__=='__main__': main(*sys.argv[1:6])
