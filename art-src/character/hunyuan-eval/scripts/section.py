import os
# python3 section.py : sagittal (x=0) and coronal (y=0) cross-sections of the sample, segments coloured by face class
import json,struct,numpy as np
from PIL import Image,ImageDraw,ImageFont
G=os.environ.get('HUNYUAN_GLB','/workspace/yiqifengle/previews/grokbot/hunyuan-head/hunyuan_head_v31.glb')
f=open(G,'rb'); f.read(12); l,_=struct.unpack('<II',f.read(8)); j=json.loads(f.read(l)); f.read(8); B=f.read()
def bv(i): v=j['bufferViews'][i]; o=v.get('byteOffset',0); return B[o:o+v['byteLength']]
P=np.frombuffer(bv(0),np.float32).reshape(-1,3); W=np.stack([P[:,0],-P[:,1],-P[:,2]],1)
I=np.frombuffer(bv(3),np.uint32).reshape(-1,3); cls=np.load('../data/face_class.npy')
COL=[(40,50,110),(240,190,170),(200,160,90),(230,80,140),(240,200,0),(150,150,150),(255,0,0)]
F=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',22) if __import__('os').path.exists('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc') else ImageFont.load_default()
def section(axis,h,title):
    T=W[I]; d=T[:,:,axis]
    m=(d.min(1)<0)&(d.max(1)>0); T=T[m]; d=d[m]; c=cls[m]
    other=[a for a in (0,1,2) if a!=axis]
    im=Image.new('RGB',(700,800),'white'); dr=ImageDraw.Draw(im)
    def pt(p): return (350+p[other[0]]*700, 760-p[2]*780)
    for t,dd,cc in zip(T,d,c):
        q=[]
        for a,b in ((0,1),(1,2),(2,0)):
            if (dd[a]<0)!=(dd[b]<0):
                s=dd[a]/(dd[a]-dd[b]); q.append(t[a]+(t[b]-t[a])*s)
        if len(q)==2: dr.line([pt(q[0]),pt(q[1])],fill=COL[cc],width=2)
    dr.text((10,8),title,fill='black',font=F); return im
a=section(0,0,'纵切面 x=0（左=脸前方 -Y）'); b=section(1,0,'横切面 y=0（正面看）')
im=Image.new('RGB',(1400,850),'white'); im.paste(a,(0,40)); im.paste(b,(700,40))
dr=ImageDraw.Draw(im)
lg=['头发','皮肤','帽子草编','粉色(帽带/唇/腮红)','黄上衣','白(背带/眼白)','其它']
for k,n in enumerate(lg): dr.rectangle([10+195*k,8,30+195*k,28],fill=COL[k]); dr.text((36+195*k,4),n,fill='black',font=F)
im.save('../raw/section.png'); print('ok')
