import sys,json,numpy as np
sys.path.insert(0,'.');from rast import *
t,ids,names=load('meadow');P=json.load(open('panel_m2.json'));ims=[]
for p in P:
    w,h=map(int,p['scr'].split('x'));img,_,_=render(p['cam'],t,w,h,1,None);im=Image.fromarray(img);dr=ImageDraw.Draw(im)
    for q in p['ui']:dr.rectangle([q['l'],q['t'],q['r'],q['b']],outline=(255,0,255),width=1)
    o=p['old'];dr.rectangle([o['l'],o['t'],o['r'],o['b']],outline=(255,0,0),width=2)
    b=p['box'];dr.rectangle([b['l'],b['t'],b['r'],b['b']],outline=(255,255,0),width=3)
    dr.text((4,h-46),p['scr'],fill='black');dr.text((4,h-32),'yellow=new stop  red=old walk_path_02, magenta=keep-outs',fill='black')
    ims.append(im.resize((int(w*600/h),600)))
W=sum(i.width for i in ims)+8*len(ims);out=Image.new('RGB',(W,600),'white');x=0
for i in ims:out.paste(i,(x,0));x+=i.width+8
out.save(D+'meadow_r41_stops_7screens.png');print(out.size,D)
