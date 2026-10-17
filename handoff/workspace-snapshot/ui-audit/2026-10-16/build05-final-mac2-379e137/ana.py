import subprocess,numpy as np,colorsys,json,sys
from scipy.ndimage import uniform_filter
def fr(p,t):
  r=subprocess.run(['ffmpeg','-loglevel','error','-ss',str(t),'-i',p,'-frames:v','1','-vf','crop=374:812:0:0','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
  return np.frombuffer(r,np.uint8).reshape(812,374,3).astype(float)
def sea(a):
  r,g,b=a[...,0],a[...,1],a[...,2];m=(b>r+40)&(b>g-5)&(b>60);m[:60]=False
  if m.sum()<200:return None
  px=a[m]/255;mean=px.mean(0);h,s,v=colorsys.rgb_to_hsv(*mean);Y=(0.2126*px[:,0]+0.7152*px[:,1]+0.0722*px[:,2]).mean()
  return dict(area=round(m.mean()*100,1),hue=round(h*360),Y=round(Y,3),rgb=[int(x*255) for x in mean])
def flatgreen(a):
  g=a.mean(2);sd=np.sqrt(np.maximum(uniform_filter(g**2,15)-uniform_filter(g,15)**2,0))
  r,G,b=a[...,0],a[...,1],a[...,2];m=(G>r+25)&(G>b+25)&(sd<3);m[:90]=False;m[700:]=False
  return round(m[90:700].mean()*100,1)
out={}
for tag,p,t0 in [('25day','raw/25_fin_day_p750.webm',130.49),('25night','raw/25_fin_night_p750.webm',188.69)]:
  for dt in range(0,64,2):
    a=fr(p,t0+dt);out.setdefault(tag,[]).append([dt,flatgreen(a),sea(a)])
for tag,p,t0 in [('24night','raw/24_fin_night_p750.webm',196.58),('24day','raw/24_fin_day_p750.webm',112.33)]:
  for dt in [1,3,6,10,16]:
    a=fr(p,t0+dt);out.setdefault(tag,[]).append([dt,flatgreen(a),sea(a)])
json.dump(out,open('logs/ana.json','w'),indent=0)
for k,v in out.items():
  print(k)
  for x in v:print('  +%2d flatgreen %5.1f%%  sea %s'%(x[0],x[1],x[2]))
