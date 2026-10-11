# QA only (not shipped). Run inside /tmp/fxbot/gv2-style dir holding {old,new}_{0,1}_sel.json + r_{old,new}_{0,1}/ renders (see docs/handoff-scene-fx.md 6).
import json, math
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',18);F2=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',14)
OUT='/workspace/yiqifengle/previews/场景特效bot/gulls-v2/'
def proj(c,p,W,H):
    f=[c['target'][i]-c['pos'][i] for i in range(3)];l=math.sqrt(sum(x*x for x in f));f=[x/l for x in f]
    r=[f[1]*0-f[2]*1, f[2]*0-f[0]*0, f[0]*1-f[1]*0];l=math.sqrt(sum(x*x for x in r));r=[x/l for x in r]
    u=[r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]]
    d=[p[i]-c['pos'][i] for i in range(3)];z=sum(d[i]*f[i] for i in range(3));ty=math.tan(math.radians(c['fov'])/2);asp=W/H
    sx=sum(d[i]*r[i] for i in range(3))/(z*ty*asp);sy=sum(d[i]*u[i] for i in range(3))/(z*ty);return ((sx+1)/2*W,(1-sy)/2*H,z)
for w,lab in ((0,'白天'),(1,'夜里')):
    j=json.load(open('new_%d_sel.json'%w));rows=[]
    for k,fr in enumerate(j['frames']):
        c=fr['camera'];W,H=586,1266;best=None
        for g in fr['gulls']:
            if not g['vis']:continue
            x,y,z=proj(c,g['pos'],W,H)
            if z>0 and -50<x<W+50 and -50<y<H+50 and (best is None or z<best[2]):best=(x,y,z)
        if best: rows.append((k,fr["t"],best))
    S=200  # crop half-size px (=> 400x400 crop, shown 1:1)
    cols=[];full=[]
    for k,t,b in rows:
        pair=[]
        for v in ('old','new'):
            im=Image.open('r_%s_%d/f%05d.png'%(v,w,k)).convert('RGB')
            cx,cy=(int(b[0]),int(b[1])) if b else (W//2,H//3);cx=max(S,min(W-S,cx));cy=max(S,min(H-S,cy))
            pair.append(im.crop((cx-S,cy-S,cx+S,cy+S)));full.append((v,k,im))
        cols.append((t,b,pair))
    n=len(cols);pad=8;top=64;cw=2*S;img=Image.new('RGB',(n*(cw+pad)+pad,top+2*(cw+30)+pad),(24,24,28));d=ImageDraw.Draw(img)
    d.text((pad,6),'近处海鸥飞过（出门近处叫声，%s）：上排 修前 b6f2572 / 下排 修后（翅膀修正）。局部 1:1，400×400 px 裁自 586×1266'%lab,font=F,fill=(255,255,255))
    d.text((pad,34),'离线复刻预览（Blender Cycles，非 Cocos 渲染）；镜头轨迹 camera-track 4ec8f72a；同一 seed，两版航线逐帧相同',font=F2,fill=(200,200,200))
    for i,(t,b,pair) in enumerate(cols):
        x=pad+i*(cw+pad)
        for r,im in enumerate(pair):
            y=top+r*(cw+30);img.paste(im,(x,y+24));d.text((x,y+2),('修前' if r==0 else '修后')+'  t=%.2fs  离镜头 %.1f m'%(t,b[2] if b else 0),font=F2,fill=(230,230,230))
    img.save(OUT+'compare_near_gull_%s.png'%('day' if w==0 else 'night'))
    # full frame of the closest moment, before | after
    k=2;rk=[r for r in rows if r[0]==k][0];a=Image.open('r_old_%d/f%05d.png'%(w,k)).convert('RGB');bb=Image.open('r_new_%d/f%05d.png'%(w,k)).convert('RGB')
    o=Image.new('RGB',(2*W+3*pad,H+50),(24,24,28));dd=ImageDraw.Draw(o);o.paste(a,(pad,50));o.paste(bb,(2*pad+W,50))
    dd.text((pad,12),'修前（%s，t=%.2fs）'%(lab,rk[1]),font=F,fill=(255,255,255));dd.text((2*pad+W,12),'修后',font=F,fill=(255,255,255))
    o.save(OUT+'compare_full_%s_t%.2f.png'%('day' if w==0 else 'night',rk[1]))
    bb.save(OUT+'key_near_gull_%s_after_t%.2f.png'%('day' if w==0 else 'night',rk[1]))
    print(lab,[(round(t,3),b and [round(x) for x in b[:2]]+[round(b[2],2)]) for t,b in [(r[1],r[2]) for r in rows]])
