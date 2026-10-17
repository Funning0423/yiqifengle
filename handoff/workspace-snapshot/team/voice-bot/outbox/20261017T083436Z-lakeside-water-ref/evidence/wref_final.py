import sys,json;sys.path.insert(0,'.')
from wref_fit import *
x=[1.197,1.866,0.0,0.386,0.543,1.051,1.071];json.dump(x,open('wref_c1t.json','w'))
W=W_of(x[:4]);W['tint']=x[4:];P=P_now();P['water']=W;cand=emu.shade(G2,P).astype(float)
base=emu.shade(G2,P_now()).astype(float)
cols=[('a6f39ed / f3d3614',base),('candidate',cand)]
print('| point | graded target | '+' | '.join(n for n,_ in cols)+' |');print('|---|---|'+'---|'*len(cols))
for n,b in B.items():
  t=TG[n];row=[]
  for _,im in cols: m=smed(im,b);d=np.abs(m-t).max();row.append('%d/%d/%d %s Δ%d'%(*m.astype(int),'✓' if d<=12 else '✗',d))
  print('| %s | %d/%d/%d | %s |'%(n,*t.astype(int),' | '.join(row)))
print('| mid stripe std (≤10) | %.1f | %s |'%(stripe(gm),' | '.join('%.1f'%stripe(im) for _,im in cols)))
from PIL import ImageDraw
items=[('r5h3 graded (time median)',gm)]+cols;Wd,H=360,640;S=Image.new('RGB',(Wd*3,H+28),(20,20,20));d=ImageDraw.Draw(S)
for i,(n,im) in enumerate(items):S.paste(Image.fromarray(im.astype(np.uint8)).resize((Wd,H)),(i*Wd,28));d.text((i*Wd+6,8),n+('' if i==0 else ' - STAND-IN emulator'),fill=(255,255,255))
S.save('compare_water_ref.png')
