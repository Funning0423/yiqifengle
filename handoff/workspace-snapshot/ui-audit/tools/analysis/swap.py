# python3 swap.py <cap_dir> <outprefix> : finds swap frame (first 'level' capture), writes prev/swap/next strip + diff image, prints diff stats
import json,sys,numpy as np
from PIL import Image,ImageDraw
d=sys.argv[1];out=sys.argv[2];idx=json.load(open(d+'/index.json'))
k=next((i for i,x in enumerate(idx) if x[2]=='level'),None)
if k is None: print('no level frame');sys.exit()
# camera swap may happen before state flips: also detect by cams string change
ks=[i for i in range(1,len(idx)) if idx[i][4]!=idx[i-1][4]]
im=lambda i:np.asarray(Image.open(d+'/c%03d.jpg'%idx[i][0]).convert('RGB')).astype(int)
def diff(a,b):
  D=np.abs(im(a)-im(b)).max(2);return D
res={'stateSwap':k,'camChanges':[(i,idx[i][4],idx[i][2]) for i in ks],'n':len(idx)}
# choose swap = first frame where LakesideBackgroundCamera/board camera appears or state level
s=k
for i in ks:
  if i<=k+1: s=i
res['swap']=s;res['times']=[idx[j][1] for j in (s-1,s,s+1) if 0<=j<len(idx)]
D1=diff(s-1,s);D0=diff(s-2,s-1) if s>=2 else None;D2=diff(s,s+1) if s+1<len(idx) else None
for nm,D in (('prev2->prev',D0),('prev->swap',D1),('swap->next',D2)):
  if D is not None: res[nm]={'px>24':int((D>24).sum()),'px>48':int((D>48).sum()),'mean':round(float(D.mean()),2),'total':int(D.size)}
ims=[Image.open(d+'/c%03d.jpg'%idx[j][0]).convert('RGB') for j in (s-1,s,s+1) if 0<=j<len(idx)]
W,H=ims[0].size;strip=Image.new('RGB',(W*4,H+16));dr=ImageDraw.Draw(strip)
for i,m in enumerate(ims):strip.paste(m,(W*i,16));dr.text((W*i+4,2),['prev','SWAP','next'][i],fill=(255,255,0))
dm=Image.fromarray(np.clip(D1*3,0,255).astype(np.uint8)).convert('RGB');strip.paste(dm,(W*3,16));dr.text((W*3+4,2),'|prev-swap|x3',fill=(255,255,0))
strip.save(out+'.jpg',quality=88);print(json.dumps(res))
