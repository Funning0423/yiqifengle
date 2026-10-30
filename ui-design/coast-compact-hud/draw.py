import sys,math;sys.path.insert(0,'/tmp');from proj import proj
from PIL import Image,ImageDraw,ImageFont,ImageFilter
S=3;A='/workspace/wechat-game/work/coast-compact-hud/creator-build-project/assets/bundles/board_art/board/'
P='/workspace/tmp-exp/wt-coast-scene/creator-build-project/assets/bundles/region_coast/board/'
OUT='/workspace/wechat-game/work/coast-compact-hud/ui-design/coast-compact-hud/'
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
import os
if not os.path.exists(FB): FB='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
def F(pt): return ImageFont.truetype(FB,int(pt*S))
BROWN=(107,74,43);TEAL=(31,107,104);CREAM=(255,244,220)
img=lambda f:Image.open(f).convert('RGBA')
PL=img(A+'hud_levelplate.png');PA=img(A+'hud_pause.png');MV=img(A+'icon_moves.png')
TOOLS=[img(A+t) for t in ['tool_starlight.png','tool_windbell.png','tool_tidebottle.png']]
PIECES=[img(P+'piece_%s.png'%n) for n in ['conch','star','coral','float','scallop','badge']]
def paste(c,im,x,y,w,h):  # pt box top-left
    r=im.resize((max(1,int(w*S)),max(1,int(h*S))),Image.LANCZOS);c.alpha_composite(r,(int(x*S),int(y*S)))
def sliced(c,x,y,w,h):  # 3-slice horizontally, plate height scaled
    k=h/129;l,r=15,19;L=PL.crop((0,0,l,129));M=PL.crop((l,0,411-r,129));R=PL.crop((411-r,0,411,129))
    paste(c,L,x,y,l*k,h);paste(c,M,x+l*k,y,w-(l+r)*k,h);paste(c,R,x+w-r*k,y,r*k,h)
def text(d,x,y,s,pt,col,anchor='lm'): d.text((x*S,y*S),s,font=F(pt),fill=col,anchor=anchor)
def scene(w,h,D):
    c=Image.new('RGBA',(w*S,h*S));d=ImageDraw.Draw(c)
    for yy in range(h*S):  # warm sand gradient
        t=yy/(h*S);d.line([(0,yy),(w*S,yy)],fill=(int(226-20*t),int(205-22*t),int(160-25*t),255))
    pr=lambda x,z,y=.15:tuple(v*S for v in proj(w,h,D,x,y,z))
    rim=[pr(-3.95,-3.95),pr(3.95,-3.95),pr(3.95,3.95),pr(-3.95,3.95)]
    sh=Image.new('RGBA',c.size);ImageDraw.Draw(sh).polygon([(p[0],p[1]+10*S) for p in rim],fill=(80,60,40,90));c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8*S)))
    d.polygon(rim,fill=(196,170,128,255));d.polygon([pr(-3.5,-3.5),pr(3.5,-3.5),pr(3.5,3.5),pr(-3.5,3.5)],fill=(150,128,96,255))
    for r in range(7):
        for col in range(7):
            x0,z0=col-3-.465,r-3-.465;x1,z1=x0+.93,z0+.93
            d.polygon([pr(x0,z0,.12),pr(x1,z0,.12),pr(x1,z1,.12),pr(x0,z1,.12)],fill=(214,206,188,255) if (r+col)%2 else (200,192,174,255))
    for r in range(7):
        for col in range(7):
            cx,cy=proj(w,h,D,col-3,.12,r-3);a=proj(w,h,D,col-3-.5,.12,r-3)[0];b=proj(w,h,D,col-3+.5,.12,r-3)[0];s=(b-a)*1.15
            paste(c,PIECES[(r*3+col*5+r*col)%6],cx-s/2,cy-s*0.62,s,s)
    return c
def pause(c,g): paste(c,PA,38-20.5,g['py']-20.5,41,41)
def capsule(c,w,py):
    d=ImageDraw.Draw(c);d.rounded_rectangle([(w-93)*S,(py-16)*S,(w-6)*S,(py+16)*S],radius=16*S,fill=(255,255,255,230),outline=(210,210,210,255),width=S)
def goals_row(c,d,x,cy,pt,icon,gap,moves_pt):
    for i,(p,n) in enumerate([(0,'12'),(2,'9')]):
        paste(c,PIECES[p],x,cy-icon/2,icon,icon);x+=icon+3;text(d,x,cy,n,pt,BROWN);x+=d.textlength(n,font=F(pt))/S+gap
    d.line([(x*S,(cy-9)*S),(x*S,(cy+9)*S)],fill=(196,166,120),width=int(1.5*S));x+=gap
    paste(c,MV,x,cy-moves_pt*0.55,moves_pt*0.63,moves_pt*1.0);x+=moves_pt*0.63+4;text(d,x,cy,'25',moves_pt,TEAL);return x+d.textlength('25',font=F(moves_pt))/S
def old(w,h,D):
    c=scene(w,h,D);d=ImageDraw.Draw(c);py=67;capsule(c,w,py);pause(c,{'py':py})
    pw=214;x0=w/2-pw/2;sliced(c,x0,96,pw,60);text(d,w/2,111,'05  贝壳湾',13.5,BROWN,'mm')
    # row 2 centred
    tmp=Image.new('RGBA',c.size);td=ImageDraw.Draw(tmp);ww=goals_row(tmp,td,0,0,16.7,24,10,16.7)
    goals_row(c,d,w/2-ww/2,137,16.7,24,10,16.7)
    toastB={568:194,520:171.7}[h];toast(c,d,w/2,toastB-16,'拖动相邻两颗，三颗一样就消除',min(330,w-24),13)
    tools(c,d,w,h-34-80,60,82)
    return c
def toast(c,d,cx,cy,s,maxw,pt,h=32):
    tw=min(maxw,d.textlength(s,font=F(pt))/S+28);d.rounded_rectangle([(cx-tw/2)*S,(cy-h/2)*S,(cx+tw/2)*S,(cy+h/2)*S],radius=h/2*S,fill=(255,244,220,240),outline=(196,166,120),width=int(1.5*S))
    text(d,cx,cy,s,pt,BROWN,'mm')
def tools(c,d,w,ty,size,step):
    for i in range(3):
        x=w/2+(i-1)*step;paste(c,TOOLS[i],x-size/2,ty-size/2,size,size)
        r=8.5 if size<55 else 10;bx,by=x+size*0.32,ty+size*0.3
        d.ellipse([(bx-r)*S,(by-r)*S,(bx+r)*S,(by+r)*S],fill=(255,244,220),outline=(196,166,120),width=S);text(d,bx,by,'3',11 if size<55 else 13.5,BROWN,'mm')
def new(w,h,D,show_toast=False):
    c=scene(w,h,D);d=ImageDraw.Draw(c);py=67;capsule(c,w,py);pause(c,{'py':py})
    sl,sr=70,w-93-10
    if show_toast: toast(c,d,(sl+sr)/2,py,'拖动相邻两颗，三颗一样就消除' if sr-sl>200 else '相邻两颗交换消除',sr-sl,12)
    else:
        t='05 · 贝壳湾';tw=d.textlength(t,font=F(13))/S+24
        d.rounded_rectangle([sl*S,(py-14)*S,(sl+tw)*S,(py+14)*S],radius=14*S,fill=(255,244,220,235),outline=(196,166,120),width=int(1.5*S));text(d,sl+12,py,t,13,BROWN)
    pw=min(214,w-24);sliced(c,w/2-pw/2,95,pw,36)
    tmp=Image.new('RGBA',c.size);ww=goals_row(tmp,ImageDraw.Draw(tmp),0,0,15,22,8,15);goals_row(c,d,w/2-ww/2,113.5,15,22,8,15)
    tools(c,d,w,h-34-34,48,64);return c
def fin(c): return c.resize((c.width//S*2,c.height//S*2),Image.LANCZOS)
DS={(320,568):(24.719,15.97),(390,520):(23.003,14.719)}
for (w,h),(db,da) in [i for i in DS.items() if i[0][0]==320]:
    b,a=fin(old(w,h,db)),fin(new(w,h,da));a2=fin(new(w,h,da,True))
    pad=60;W=b.width*3+pad*4;H=b.height+150;cv=Image.new('RGB',(W,H),(250,246,238));dd=ImageDraw.Draw(cv);f=ImageFont.truetype(FB,30)
    for i,(im,lab) in enumerate([(b,'现状'),(a,'紧凑版'),(a2,'紧凑版 · 提示出现时（2 s）')]):
        x=pad+i*(b.width+pad);cv.paste(im,(x,110),im);dd.rectangle([x-1,109,x+b.width,110+b.height],outline=(170,150,120),width=2);dd.text((x,40),lab,font=f,fill=BROWN)
    cv.save(OUT+'compare_%dx%d.png'%(w,h))
    # annotation
    an=fin(new(w,h,da)).convert('RGB');ad=ImageDraw.Draw(an);fa=ImageFont.truetype(FB,20);R=(200,40,60)
    cnt=[0]
    def hl(y,lab):
        ad.line([(0,y*2),(an.width,y*2)],fill=R,width=2);x=6 if cnt[0]%2==0 else an.width-ad.textlength(lab,font=fa)-10;cnt[0]+=1
        ad.rectangle([x-3,y*2+3,x+ad.textlength(lab,font=fa)+3,y*2+27],fill=(255,255,255));ad.text((x,y*2+3),lab,font=fa,fill=R)
    hl(51,'胶囊行 51');hl(89,'暂停热区底 89');hl(95,'目标条 95');hl(131,'目标条底 131 = topNoGo');hl(h-34-34-26,'工具热区顶 %d'%(h-94));hl(h-34,'安全区 %d'%(h-34))
    rt=proj(w,h,da,0,.15,-3.95)[1];hl(rt,'石框顶 %.1f'%rt)
    fh=proj(w,h,da,0,.12,-2.5)[1]-proj(w,h,da,0,.12,-3.5)[1];y0=proj(w,h,da,0,.12,-3.5)[1]
    ad.rectangle([ (w/2-16)*2,y0*2,(w/2+16)*2,(y0+fh)*2],outline=(20,90,200),width=3);ad.text(((w/2+20)*2,y0*2),'远排 %.1f pt'%fh,font=fa,fill=(20,90,200))
    if w==320:
        for sx in (1,-1):
            ys,yn=proj(w,h,da,-3.95,.15,1.723)[1],proj(w,h,da,-3.686,.15,3.95)[1]
            X=0 if sx==1 else an.width-1
            ad.line([(X,ys*2),(X,yn*2)],fill=(20,150,60),width=8)
        ad.rectangle([4,350*2-26,330,350*2],fill=(255,255,255));ad.text((8,350*2-26),'绿：出屏切口 y345–436，两侧各 11.5 pt',font=fa,fill=(20,150,60))
    an.save(OUT+'annot_%dx%d.png'%(w,h))
print('ok')
