import numpy as np,colorsys
from PIL import Image
D='wt-coast-scene/creator-build-project/assets/bundles/board_art/board/'
lin=lambda c:np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
def Y(c):return float(lin(np.asarray(c))@np.array([.2126,.7152,.0722]))
def lab(c):
  c=lin(np.asarray(c));X=c@np.array([.4124,.3576,.1805])/0.9505;Yy=c@np.array([.2126,.7152,.0722]);Z=c@np.array([.0193,.1192,.9505])/1.089
  f=lambda t:np.cbrt(t) if t>0.008856 else 7.787*t+16/116;return np.array([116*f(Yy)-16,500*(f(X)-f(Yy)),200*(f(Yy)-f(Z))])
def body(p):
  a=np.asarray(Image.open(D+p+'.png').convert('RGBA')).astype(float)/255;m=a[...,3]>0.95;c=a[...,:3][m]
  hsv=np.array([colorsys.rgb_to_hsv(*x) for x in c[::7]]);c=c[::7]
  keep=~((hsv[:,1]<0.25)&(hsv[:,2]<0.45))   # drop the drop-shadow
  return np.median(c[keep],0),np.median(hsv[keep][:,1]),np.median(hsv[keep][:,2])
tiles={t:np.median(np.asarray(Image.open(D+t+'.png').convert('RGB')).astype(float)[40:120,40:120].reshape(-1,3)/255,0) for t in ('tile_a','tile_b')}
rows=[]
for k in ['strawberry','leaf','blueberry','flower','acorn','shell']:
  c,s,v=body('piece_'+k);cr=min((max(Y(c),Y(t))+.05)/(min(Y(c),Y(t))+.05) for t in tiles.values());de=min(np.linalg.norm(lab(c)-lab(t)) for t in tiles.values())
  rows.append((k,'#%02X%02X%02X'%tuple((c*255).astype(int)),s,v,cr,de))
print('tiles',{k:'#%02X%02X%02X'%tuple((v*255).astype(int)) for k,v in tiles.items()})
print('|island piece|body|S|V|lum contrast (min of tile_a/b)|dE (min)|');print('|---|---|---|---|---|---|')
for r in rows:print('|%s|%s|%.2f|%.2f|%.2f|%.1f|'%r)
cr=[r[4] for r in rows];de=[r[5] for r in rows]
print('median lum %.2f floor %.2f | median dE %.1f floor %.1f | S %.2f-%.2f V %.2f-%.2f'%(np.median(cr),min(cr),np.median(de),min(de),min(r[2] for r in rows),max(r[2] for r in rows),min(r[3] for r in rows),max(r[3] for r in rows)))
