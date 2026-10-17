import sys,json;sys.path.insert(0,'.')
from wref_fit import *
SKY=([0.107,0.102,0.089],[0.093,0.171,0.181])
base=emu.shade(G2,P_now()).astype(float)
c1=shade(json.load(open('wref_c1.json')),None,G2);c2=shade(json.load(open('wref_c2.json')),SKY,G2)
cols=[('a6f39ed',base),('cand c1',c1),('cand c1+c2',c2)]
print('| point | graded target | '+' | '.join(n for n,_ in cols)+' |');print('|---|---|'+'---|'*len(cols))
for n,b in B.items():
  t=TG[n];row=[]
  for _,im in cols:
    m=smed(im,b);d=np.abs(m-t).max();row.append('%d/%d/%d %s(Δ%d)'%(*m.astype(int),'✓' if d<=12 else '✗',d))
  print('| %s | %d/%d/%d | %s |'%(n,*t.astype(int),' | '.join(row)))
print('| stripe std | %.1f | %s |'%(stripe(gm),' | '.join('%.1f'%stripe(im) for _,im in cols)))
for n,im in cols: Image.fromarray(im.astype(np.uint8)).save('wref_%s.png'%n.replace(' ','_').replace('+','_'))
from PIL import ImageDraw
items=[('r5h3 graded (time median)',gm)]+cols;W,H=360,640;S=Image.new('RGB',(W*4,H+28),(20,20,20));d=ImageDraw.Draw(S)
for i,(n,im) in enumerate(items):S.paste(Image.fromarray(im.astype(np.uint8)).resize((W,H)),(i*W,28));d.text((i*W+6,8),n+('' if i==0 else ' STAND-IN'),fill=(255,255,255))
S.save('compare_water_ref.png')
