import sys,json;sys.path.insert(0,'.')
from wref_fit import *
from PIL import ImageDraw
base=emu.shade(G2,P_now()).astype(float)
P=P_now();P['water']=dict(P['water'],vc_linear=True);fix=emu.shade(G2,P).astype(float)
print('| point | graded target | f3d3614 | S (fix only) |');print('|---|---|---|---|')
for n,b in B.items():
  t=TG[n];row=[]
  for im in (base,fix): m=smed(im,b);d=np.abs(m-t).max();row.append('%d/%d/%d %s Δ%d'%(*m.astype(int),'✓' if d<=12 else '✗',d))
  print('| %s | %d/%d/%d | %s |'%(n,*t.astype(int),' | '.join(row)))
print('| mid stripe std (≤10) | %.1f | %.1f | %.1f |'%(stripe(gm),stripe(base),stripe(fix)))
items=[('r5h3 graded (time median)',gm),('f3d3614',base),('S fix only',fix)];Wd,H=360,640;S=Image.new('RGB',(Wd*3,H+28),(20,20,20));d=ImageDraw.Draw(S)
for i,(n,im) in enumerate(items):S.paste(Image.fromarray(im.astype(np.uint8)).resize((Wd,H)),(i*Wd,28));d.text((i*Wd+6,8),n+('' if i==0 else ' - STAND-IN emulator'),fill=(255,255,255))
S.save('compare_water_fix_only.png')
