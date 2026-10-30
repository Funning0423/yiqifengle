import numpy as np,sys,collections,colorsys
from PIL import Image,ImageDraw
from scipy import ndimage
P,N,I=sys.argv[1:4]
A=np.asarray(Image.open(P).convert('RGB')).astype(float)/255;B=np.asarray(Image.open(N).convert('RGB')).astype(float)/255;ID=np.asarray(Image.open(I).convert('RGB')).astype(float)/255
lin=lambda c:np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4);Y=lambda c:lin(c)@np.array([.2126,.7152,.0722])
YA=Y(A);diff=np.abs(A-B).sum(2)
m=diff>0.25;m[:200]=0;m[650:]=0
lab,n=ndimage.label(ndimage.binary_opening(m,iterations=2));objs=ndimage.find_objects(lab)
IDC={(1,0,0):'slab_0',(0,1,0):'slab_1',(0,0,1):'slab_2',(1,1,0):'slab_3',(1,0,1):'slab_4',(0,1,1):'slab_5'}
def kind(rgb):
  h,l,s=colorsys.rgb_to_hls(*rgb);h*=360
  if s<0.35 and l>0.75:return 'coral'          # pale-pink rim dominated
  if 40<=h<70:return 'star'
  if 70<=h<158:return 'badge'
  if 158<=h<192:return 'scallop'
  if 192<=h<235:return 'float'
  if h>=320 or h<12:return 'coral'
  if 12<=h<40:return 'conch'
  return '?'
DE={}
def lab_(c):
  c=lin(np.asarray(c));X=c@np.array([.4124,.3576,.1805])/0.9505;Yy=c@np.array([.2126,.7152,.0722]);Z=c@np.array([.0193,.1192,.9505])/1.089
  f=lambda t:np.where(t>0.008856,np.cbrt(t),7.787*t+16/116);return np.array([116*f(Yy)-16,500*(f(X)-f(Yy)),200*(f(Yy)-f(Z))])
def dE(a,b):return float(np.linalg.norm(lab_(a)-lab_(b)))
im=Image.open(P).convert('RGB');dr=ImageDraw.Draw(im);rows=[];UNK=[]
for i,sl in enumerate(objs):
  if sl is None:continue
  blob=lab[sl]==i+1
  if blob.sum()<80:continue
  y0,y1,x0,x1=sl[0].start,sl[0].stop,sl[1].start,sl[1].stop;pad=10;Y0,Y1,X0,X1=max(0,y0-pad),y1+pad,max(0,x0-pad),x1+pad
  bl=lab[Y0:Y1,X0:X1]==i+1;sub=A[Y0:Y1,X0:X1];sat=sub.max(2)-sub.min(2);ys=YA[Y0:Y1,X0:X1]
  ring=(diff[Y0:Y1,X0:X1]<0.06)&~bl
  idr=ID[Y0:Y1,X0:X1][ring|bl];keys=[tuple(np.round(c).astype(int)) for c in idr if c.max()>0.85 and (c>0.85).sum()+(c<0.15).sum()==3]
  if not keys:continue
  var=IDC.get(collections.Counter(keys).most_common(1)[0][0],'?')
  Ls=np.median(ys[ring])
  body=bl&~((ys<Ls)&(sat<0.2))          # drop contact-disc / shadow pixels (dark, unsaturated)
  hm=np.median(sub[body],0);k=kind(hm)
  # body luminance: median of the piece's own coloured pixels (main body hue)
  if k=='coral':  # coral: trunk + rim; report the WORSE of trunk and rim
    hs=np.array([colorsys.rgb_to_hls(*c)[1] for c in sub[body]]);tr=sub[body][hs>0.62];Lb=np.median(Y(tr)) if len(tr)>10 else np.median(ys[body])
  else:Lb=np.median(ys[body])
  cr=(max(Lb,Ls)+.05)/(min(Lb,Ls)+.05);rows.append((k,var,Lb,Ls,cr));DE.setdefault(k,[]).append(dE(hm,np.median(sub[ring],0)));UNK.append(((hm*255).astype(int).tolist(),X0,Y0)) if k=='?' else None;dr.rectangle([X0,Y0,X1,Y1],outline=(255,0,0));dr.text((X0+2,Y0+2),k[:3]+var[-1],fill=(255,255,255))
im.save(P.replace('.png','_boxes.png'))
T=collections.defaultdict(list)
for k,v,lb,ls,cr in rows:T[(k,v)].append(cr)
kinds=['conch','star','coral','float','scallop','badge'];sl=['slab_%d'%i for i in range(6)]
print('pieces',len(rows),collections.Counter(r[0] for r in rows))
print('|piece|'+'|'.join(sl)+'|min|');print('|'+'---|'*8);mn=9
for k in kinds:
  vals=[min(T[(k,s)]) if T[(k,s)] else None for s in sl];vv=[v for v in vals if v];m_=min(vv) if vv else 0;mn=min(mn,m_)
  print('|%s|'%k+'|'.join('%.2f'%v if v else '–' for v in vals)+'|%.2f|'%m_)
print('min %.2f'%mn)
for s in sl:
  l=[r[3] for r in rows if r[1]==s];print(s,'slab Y %.3f'%np.median(l) if l else '')
print('\nFull cross table (rendered piece-body Y, min over that kind, vs each slab variant measured rendered Y, darkest-ring 10th pct and median):')
SY={s:[r[3] for r in rows if r[1]==s] for s in sl}
print('|piece (body Y min)|'+'|'.join(sl)+'|min|');print('|'+'---|'*8);mn=9
for k in kinds:
  lbs=[r[2] for r in rows if r[0]==k]
  if not lbs:print('|%s|not detected|'%k);continue
  lb=min(lbs)
  vals=[]
  for s in sl:
    for ls in (np.percentile(SY[s],10),np.percentile(SY[s],90)):pass
    lo,hi=min(SY[s]),max(SY[s]);vals.append(min((max(lb,x)+.05)/(min(lb,x)+.05) for x in (lo,hi)))
  mn=min(mn,min(vals));print('|%s (%.3f)|'%(k,lb)+'|'.join('%.2f'%v for v in vals)+'|%.2f|'%min(vals))
print('cross min %.2f'%mn)
print('unclassified',[ (r[1],round(r[2],3)) for r in rows if r[0]=='?'],UNK)

print('\nColour difference piece body vs surrounding slab (CIE76 dE, Lab):')
print('|piece|n|dE min|dE median|');print('|---|---|---|---|')
for k in kinds:
  v=DE.get(k,[])
  print('|%s|%d|%s|%s|'%(k,len(v),'%.1f'%min(v) if v else '-','%.1f'%np.median(v) if v else '-'))
