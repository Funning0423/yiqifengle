import os
# python3 classify_faces.py : per-triangle material class from albedo at UV centroid -> ../data/face_class.npy + stats
import json,struct,io,numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
G=os.environ.get('HUNYUAN_GLB','/workspace/yiqifengle/previews/grokbot/hunyuan-head/hunyuan_head_v31.glb')
f=open(G,'rb'); f.read(12); l,_=struct.unpack('<II',f.read(8)); j=json.loads(f.read(l)); f.read(8); B=f.read()
def bv(i): v=j['bufferViews'][i]; o=v.get('byteOffset',0); return B[o:o+v['byteLength']]
UV=np.frombuffer(bv(2),np.float32).reshape(-1,2); I=np.frombuffer(bv(3),np.uint32).reshape(-1,3)
P=np.frombuffer(bv(0),np.float32).reshape(-1,3); W=np.stack([P[:,0],-P[:,1],-P[:,2]],1)
alb=np.asarray(Image.open(io.BytesIO(bv(5))).convert('RGB'))
c=UV[I].mean(1); px=np.clip((c[:,0]*4096).astype(int),0,4095); py=np.clip((c[:,1]*4096).astype(int),0,4095)
rgb=alb[py,px].astype(float); r,g,b=rgb.T
mx=rgb.max(1); mn=rgb.min(1); sat=(mx-mn)/np.maximum(mx,1)
cls=np.full(len(I),6,np.int8)   # 6 other
cls[(b>=r-5)&(mx<150)]=0                         # hair: dark blue-grey
cls[(r>200)&(g>150)&(b>120)&(r-b<110)&(sat<0.45)]=1  # skin (light, warm)
cls[(r>130)&(g>100)&(b<150)&(r-b>45)&(r-g<70)&(g-b>15)&(b>60)]=2   # straw (hat)
cls[(r>170)&(g<150)&(b>90)&(r-g>70)]=3           # pink band / lips / blush
cls[(r>200)&(g>160)&(b<110)&(g-b>90)]=4           # yellow shirt
cls[(mn>200)&(sat<0.12)]=5                         # white (straps, eye whites)
zc=W[I].mean(1)[:,2]
cls[(cls==1)&(zc>0.64)]=2   # light straw on the crown front reads as skin colour -> hat (no skin above brim height)
cls[(cls==3)&(zc>0.64)]=3
names=['hair','skin','hat_straw','pink','shirt_yellow','white','other']
st={n:int((cls==k).sum()) for k,n in enumerate(names)}
# region split by height: above chin (z>0.30) = head
head=zc>0.30
st['tris_above_chin']=int(head.sum()); st['tris_below_chin_bust']=int((~head).sum())
st['head_region_by_class']={n:int(((cls==k)&head).sum()) for k,n in enumerate(names)}
np.save('../data/face_class.npy',cls)
json.dump(st,open('../data/face_class_stats.json','w'),indent=1)
print(json.dumps(st,indent=1))
