import numpy as np,json,sys
from PIL import Image,ImageDraw
W,H=471,1024
def load(fn):
  im=Image.open(fn).convert('RGB').resize((W,H),Image.LANCZOS);g=np.asarray(im.convert('L')).astype(float)
  gx=np.zeros_like(g);gy=np.zeros_like(g);gx[:,1:-1]=g[:,2:]-g[:,:-2];gy[1:-1]=g[2:]-g[:-2];return im,np.hypot(gx,gy)
def ncc(T,S):
  T=(T-T.mean())/(T.std()+1e-9);best=(-2,0,0)
  for dy in range(-40,41):
    for dx in range(-40,41):
      yield dy,dx
sR,sS=sys.argv[1],sys.argv[2];imR,eR=load(sR);imS,eS=load(sS)
L={'lighthouseTop (finial+lantern roof)':(150,270,225,335),'cottageRoof':(235,385,330,445),'lighthouseDoorArch':(170,425,235,470)}
out={}
for k,(x0,y0,x1,y1) in L.items():
  T=eR[y0:y1,x0:x1];T=(T-T.mean())/(T.std()+1e-9);best=(-2,0,0)
  for dy in range(-40,41):
    for dx in range(-40,41):
      P=eS[y0+dy:y1+dy,x0+dx:x1+dx];P=(P-P.mean())/(P.std()+1e-9);c=float((T*P).mean())
      if c>best[0]:best=(c,dx,dy)
  out[k]={'renderBox':[x0,y0,x1,y1],'offsetPx_screenshot_minus_render':[best[1],best[2]],'ncc':round(best[0],3)}
def hz(im):
  a=np.asarray(im).astype(float);col=a[:H//2,420:466].mean(1);d=np.abs(np.diff(col,axis=0)).sum(1);d[:120]=0;return float(np.argmax(d)+.5)
out['horizonY']={'render':hz(imR),'screenshot':hz(imS),'offsetPx_screenshot_minus_render':hz(imS)-hz(imR)}
res={'scale':'both images at 471x1024 px (0.46 portrait; screenshot 1206x2622 downscaled x0.3905). Offsets in these px; x2.56 for screenshot-native px','method':'normalised cross-correlation of edge magnitude, search +/-40 px','landmarks':out}
json.dump(res,open(sys.argv[3],'w'),indent=1);print(json.dumps(res,indent=1))
# annotated side-by-side
C=Image.new('RGB',(W*2+6,H+70),(20,20,20));C.paste(imR,(0,70));C.paste(imS,(W+6,70));d=ImageDraw.Draw(C)
d.text((6,4),'B5.4.2 final frame (Blender preview, home pose v24-readable, FOV 42)',fill=(255,255,255));d.text((W+12,4),"Funning's screenshot (game, with UI)",fill=(255,255,255))
y=20
for k,v in out.items():
  if 'renderBox' in v:
    x0,y0,x1,y1=v['renderBox'];dx,dy=v['offsetPx_screenshot_minus_render'];d.rectangle([x0,y0+70,x1,y1+70],outline=(255,0,255),width=2);d.rectangle([x0+dx+W+6,y0+dy+70,x1+dx+W+6,y1+dy+70],outline=(255,0,255),width=2)
    d.text((6,y),f"{k}: dx={dx:+d} dy={dy:+d} px (ncc {v['ncc']})",fill=(255,180,255));y+=12
hr,hs=out['horizonY']['render'],out['horizonY']['screenshot'];d.line([0,hr+70,W,hr+70],fill=(0,255,255));d.line([W+6,hs+70,2*W+6,hs+70],fill=(0,255,255))
d.text((W+12,y-24+12),f"horizon: render y={hr:.1f} screenshot y={hs:.1f} -> {hs-hr:+.1f} px",fill=(150,255,255))
C.save(sys.argv[4])
