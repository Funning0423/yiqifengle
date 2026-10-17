import numpy as np,json;from boxes import *
def P(f):
  g=np.load(f);return np.stack([g['ViewLayer.pos__ViewLayer.pos.'+c] for c in 'RGB'],-1),g['ViewLayer.Object Index__ViewLayer.Object Index.X']
p6,o6=P('gb_640.npz');p8,o8=P('gb_844.npz')
def near(y,x):
  w=p6[y,x];d=np.linalg.norm(p8-w,axis=-1);d[o8!=o6[y,x]]=1e9;i=np.unravel_index(np.argmin(d),d.shape);return i,float(d[i])
out={};allb=dict(B);allb.update(BX);allb['STRIPE']=STRIPE
for n,(x0,y0,x1,y1) in allb.items():
  (a,da),(b,db)=near(y0,x0),near(y1-1,x1-1);(c,dc)=near((y0+y1)//2,(x0+x1)//2)
  # keep the 640 box size (both captures are 2x DPR of a ~same-width phone); centre from the world mapping
  w,h=x1-x0,y1-y0;cx,cy=c[1],c[0]
  out[n]=[int(cx-w/2),int(cy-h/2),int(cx-w/2)+w,int(cy-h/2)+h];print(n,out[n],'corner-map',(a[1],a[0],b[1]+1,b[0]+1),'dist %.2f %.2f %.2f'%(da,db,dc))
json.dump(out,open('boxes_844.json','w'),indent=1)
