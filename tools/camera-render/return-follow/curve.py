import json,sys,glob,os,numpy as np
from PIL import Image
def curve(d,frames):
  R=json.load(open(frames));out=[]
  for r in R:
    p=os.path.join(d,r['name']+'.png')
    if not os.path.exists(p): continue
    a=np.asarray(Image.open(p).convert('RGB'),dtype=np.float32)/255.
    out.append((r['t'],r['state'],float((a@np.array([.2126,.7152,.0722])).mean()),r['w'],r['k']))
  return out
if __name__=='__main__':
  c=curve(sys.argv[1],sys.argv[2])
  for i in range(0,len(c),int(sys.argv[3]) if len(sys.argv)>3 else 15): print('%.2f %-16s %.4f w %.2f k %.2f'%c[i])
