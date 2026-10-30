import json,sys,numpy as np
from PIL import Image
def lin(c):c=c/255.0;return np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
def Y(a):l=lin(a[...,:3].astype(float));return 0.2126*l[...,0]+0.7152*l[...,1]+0.0722*l[...,2]
def cr(a,b):a,b=max(a,b),min(a,b);return (a+0.05)/(b+0.05)
name=sys.argv[1];A=np.array(Image.open(f's_{name}.png').convert('RGB'));B=np.array(Image.open('s_nopieces.png').convert('RGB'))
H=A.shape[0];st=json.load(open(f's_{name}.png.json'));YA,YB=Y(A),Y(B)
diff=np.abs(A.astype(int)-B.astype(int)).sum(2)>40
snowY=float(np.median(YB[H-120:H-60,0:60]))  # snow pad, bottom-left
res={}
for p in st['pieces']:
  x=int(p['sx']);y=H-int(p['sy']);r=20
  w=(slice(max(0,y-r),y+r),slice(max(0,x-r),x+r))
  m=diff[w]
  if m.sum()<30:continue
  pv=YA[w][m];gv=YB[w][~m] if (~m).sum()>10 else YB[w].ravel()
  core=float(np.median(pv));paver=float(np.median(YB[w]))
  res.setdefault(p['kind'],[]).append((core,paver,float(np.percentile(pv,10))))
out={'snowY':round(snowY,3)}
for k,v in res.items():
  v=np.array(v);c=v[:,0].mean();pv=v[:,1].mean();dk=v[:,2].mean()
  out[k]={'n':len(v),'pieceY':round(c,3),'paverY':round(pv,3),'vsPaver':round(cr(c,pv),2),'vsSnow':round(cr(c,snowY),2),'darkEdgeY_p10':round(dk,3),'edgeVsPaver':round(cr(dk,pv),2)}
print(json.dumps(out,indent=1,ensure_ascii=False));json.dump(out,open(f'contrast_{name}.json','w'),indent=1)
