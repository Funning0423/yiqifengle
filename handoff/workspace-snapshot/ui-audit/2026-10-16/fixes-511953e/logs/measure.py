from PIL import Image;import numpy as np,sys
S={'390':(101.83,235.11,428.17,489.88),'320':(97.30,186.99,288.29,329.84)}
for f,k in [('raw/ib_day_390_home_sign.png','390'),('raw/ib_night_390_home_sign.png','390'),('raw/rs_day_320x568_chest_home_sign.png','320'),('raw/rs_night_320x568_chest_home_sign.png','320')]:
  l,r,t,b=S[k];a=np.asarray(Image.open(f).convert('RGB')).astype(int)
  h=b-t;y0,y1=int(2*(t+h*0.22)),int(2*(b-h*0.22));x0,x1=int(2*(l+5)),int(2*(r-5))
  A=a[y0:y1,x0:x1];R,G,B=A[...,0],A[...,1],A[...,2]
  green=(G>R+25)&(G>B+40);white=(R>232)&(G>232)&(B>232)
  gc=np.where(green.any(0))[0];wc=np.where(white.sum(0)>=1)[0]
  gl,gr=(gc.min()+x0)/2,(gc.max()+1+x0)/2;wl,wr=(wc.min()+x0)/2,(wc.max()+1+x0)/2
  gy=np.where(green.any(1))[0];wy=np.where(white.any(1))[0]
  cl,cr=min(gl,wl),max(gr,wr)
  print(f.split('/')[1][:24],k,'cap %.1f'%(r-l),'leaf %.1f-%.1f (w%.1f h%.1f)'%(gl-l,gr-l,gr-gl,(gy.max()-gy.min()+1)/2),'text %.1f-%.1f (h%.1f)'%(wl-l,wr-l,(wy.max()-wy.min()+1)/2),'gap %.1f'%(wl-gr),'L %.1f R %.1f diff %.1f'%(cl-l,r-cr,(cl-l)-(r-cr)))
