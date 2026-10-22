# Offline proxy renderer (numpy z-buffer, flat Lambert): lakeside GLB triangles + a girl proxy (dress cone, head, facing nose).
# NOT the engine look; used for framing / continuity evidence only. usage: render.py <dir> ends|track [step]
import sys,json,math,numpy as np
from PIL import Image,ImageDraw
D=sys.argv[1];mode=sys.argv[2];step=int(sys.argv[3]) if len(sys.argv)>3 else 1
T=np.fromfile(D+'/tris.f32',np.float32).reshape(-1,3,3).astype(np.float64);C=np.fromfile(D+'/cols.f32',np.float32).reshape(-1,3)
F=json.load(open(D+'/frames.json'))
def girl(p,yaw):
  tr=[];cl=[];n=14
  def ring(y,r):return [(p[0]+r*math.sin(2*math.pi*i/n),p[1]+y,p[2]+r*math.cos(2*math.pi*i/n)) for i in range(n)]
  def band(a,b,col):
    for i in range(n):j=(i+1)%n;tr.extend([[a[i],b[i],b[j]],[a[i],b[j],a[j]]]);cl.extend([col,col])
  band(ring(0,.26),ring(.85,.16),(.93,.55,.45));band(ring(.85,.16),ring(1.3,.14),(.95,.9,.85))
  hs=[ring(1.3+.13-.13*math.cos(math.pi*k/6),.13*math.sin(math.pi*k/6)+1e-3) for k in range(7)]
  for k in range(6):band(hs[k],hs[k+1],(.98,.85,.75))
  f=(math.sin(yaw),math.cos(yaw));c=(p[0]+f[0]*.16,p[1]+1.45,p[2]+f[1]*.16);s=(-f[1]*.05,f[0]*.05)
  tr.append([(p[0]+s[0],p[1]+1.5,p[2]+s[1]),(p[0]-s[0],p[1]+1.5,p[2]-s[1]),c]);cl.append((.9,.1,.1))
  return np.array(tr),np.array(cl)
L=np.array([.4,.8,.3]);L/=np.linalg.norm(L)
def render(cam,w,h,g,yaw):
  P=np.array(cam['position']);f=np.array(cam['target'])-P;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f)
  gt,gc=girl(g,yaw);tris=np.concatenate([T,gt]);cols=np.concatenate([C,gc])
  v=tris-P;z=v@f;x=v@r;y=v@u;th=math.tan(math.radians(cam['fov'])/2);asp=w/h
  ok=(z>.15).all(1);sx=(1+x/(z*th*asp))*w/2;sy=(1-y/(z*th))*h/2
  ok&=~((sx<0).all(1)|(sx>w).all(1)|(sy<0).all(1)|(sy>h).all(1))
  nrm=np.cross(tris[:,1]-tris[:,0],tris[:,2]-tris[:,0]);nl=np.linalg.norm(nrm,axis=1)+1e-12;nrm/=nl[:,None]
  vd=(tris.mean(1)-P);flip=(nrm*vd).sum(1)>0;nrm[flip]*=-1
  sh=.45+.55*np.clip(nrm@L,0,1);
  img=np.zeros((h,w,3));img[:]=(.72,.84,.95);zb=np.full((h,w),1e9)
  for i in np.nonzero(ok)[0]:
    X=sx[i];Y=sy[i];Z=z[i];x0=max(int(X.min()),0);x1=min(int(X.max())+1,w);y0=max(int(Y.min()),0);y1=min(int(Y.max())+1,h)
    if x0>=x1 or y0>=y1:continue
    gx,gy=np.meshgrid(np.arange(x0,x1)+.5,np.arange(y0,y1)+.5)
    d=(Y[1]-Y[2])*(X[0]-X[2])+(X[2]-X[1])*(Y[0]-Y[2])
    if abs(d)<1e-9:continue
    a=((Y[1]-Y[2])*(gx-X[2])+(X[2]-X[1])*(gy-Y[2]))/d;b=((Y[2]-Y[0])*(gx-X[2])+(X[0]-X[2])*(gy-Y[2]))/d;c=1-a-b
    m=(a>=0)&(b>=0)&(c>=0)
    if not m.any():continue
    iz=a/Z[0]+b/Z[1]+c/Z[2];zz=1/np.where(m,iz,1e-9);sub=zb[y0:y1,x0:x1];m&=zz<sub
    sub[m]=zz[m];img[y0:y1,x0:x1][m]=cols[i]*sh[i]
  return (np.clip(img,0,1)*255).astype(np.uint8)
def proj(cam,w,h,q):
  P=np.array(cam['position']);f=np.array(cam['target'])-P;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);v=np.array(q)-P;z=v@f;th=math.tan(math.radians(cam['fov'])/2)
  return ((1+(v@r)/(z*th*w/h))*w/2,(1-(v@u)/(z*th))*h/2)
if mode=='ends':
  for e in F['ends']:
    w,h=e['w'],e['h'];im=Image.fromarray(render(e['cam'],w,h,e['girl'],e['yaw']));dr=ImageDraw.Draw(im)
    dr.line([(0,e['trayBottom']),(w,e['trayBottom'])],fill=(255,0,255),width=1);dr.text((4,4),'%dx%d v4 end  cam %s fov %.2f  (proxy render)'%(w,h,[round(v,2) for v in e['cam']['position']],e['cam']['fov']),fill=(0,0,0))
    im.save(D+'/end_%dx%d.png'%(w,h));print('end',w,h,flush=True)
else:
  w,h=F['w'],F['h']
  for k,fr in enumerate(F['track'][::step]):
    im=Image.fromarray(render(fr['cam'],w,h,fr['girl'],fr['yaw']));dr=ImageDraw.Draw(im);dr.line([(0,F['trayBottom']),(w,F['trayBottom'])],fill=(255,0,255),width=1)
    dr.text((4,4),'t=%.2fs blend %.2fs  door lens -> board (390x844, proxy)'%(fr['t'],F['blendS']),fill=(0,0,0));im.save(D+'/trk_%04d.png'%k)
    if k%10==0:print('trk',k,flush=True)
