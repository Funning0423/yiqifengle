import json,sys
from PIL import Image,ImageDraw
S=3
def frames(p):
    d=json.load(open(p));ims=[]
    for f in d['frames']:
        W,H=d['W'],d['H'];im=Image.new('RGB',(W,H));im.putdata([tuple(c) for c in f['px']]);im=im.resize((W*S,H*S),Image.NEAREST);dr=ImageDraw.Draw(im)
        for k,x,y in f['her']:
            col={'face':(255,0,255),'chest':(255,80,200),'head':(255,255,0),'root':(0,255,0)}[k];dr.ellipse([x*S-4,y*S-4,x*S+4,y*S+4],outline=col,width=2)
        ims.append((f,im))
    return d,ims
import os
SCN=os.environ.get('SC','390x844')
b,B=frames('/tmp/t03/before_%s.json'%SCN);a,A=frames('/tmp/t03/after_%s.json'%SCN)
w,h=B[0][1].size;pad=26
sheet=Image.new('RGB',(len(B)*(w+6)+110,2*(h+pad)+40),(25,25,30));dr=ImageDraw.Draw(sheet)
dr.text((8,8),('T-03 skycity->lakeside balloon: before 234e614f (visible flight %.1f s) vs after (visible %.1f s); ray-cast schematic '%(b['visible'],a['visible'])+SCN+', markers: face magenta, chest pink, head yellow, feet green'),fill=(230,230,230))
for row,(d,L,lab) in enumerate([(b,B,'BEFORE'),(a,A,'AFTER')]):
    y=40+row*(h+pad);dr.text((8,y+h//2),lab,fill=(255,255,255))
    for i,(f,im) in enumerate(L):
        x=110+i*(w+6);sheet.paste(im,(x,y+14));dr.text((x,y),'%s  t=%.1fs'%(f['name'][:16],f['t']),fill=(220,220,220))
sheet.save(sys.argv[1])
