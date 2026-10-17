import subprocess,numpy as np,colorsys
def fr(path,t):
  r=subprocess.run(['ffmpeg','-loglevel','error','-ss',str(t),'-i',path,'-frames:v','1','-vf','crop=374:812:0:0','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
  return np.frombuffer(r,np.uint8).reshape(812,374,3).astype(float)
def sea(a):
  r,g,b=a[...,0],a[...,1],a[...,2];m=(b>r+40)&(b>g-5)&(b>60)
  m[:60]=False
  if m.sum()<200: return None
  px=a[m]/255;mean=px.mean(0);h,s,v=colorsys.rgb_to_hsv(*mean)
  Y=(0.2126*px[:,0]+0.7152*px[:,1]+0.0722*px[:,2]).mean()
  return dict(area=round(m.mean()*100,1),hue=round(h*360),sat=round(s,2),Y=round(Y,3),rgb=[int(x*255) for x in mean])
V3='build05-v3-764dcd8/raw/';OLD='build05-journey-a373227-4c30cf7/raw/'
rows=[('v3 08→09 day',V3+'25_v3_day_p750.webm',62.53),('v3 08→09 night',V3+'25_v3_night_p750.webm',59.48),('old 08→09 night',OLD+'25_b05_night_p750.webm',59.30),('old 08→09 day',OLD+'25_b05_day_p750.webm',59.45),
('v3 04→05 day',V3+'24_v3_day_p750.webm',34.61),('v3 04→05 night',V3+'24_v3_night_p750.webm',36.86),('old 04→05 night',OLD+'24_b05_night_p750.webm',32.64)]
for name,p,t0 in rows:
  print(name)
  for dt in ([6,12,18,24,30] if '08' in name else [1,3,6,10,16]):
    print('   +%ds'%dt,sea(fr(p,t0+dt)))
