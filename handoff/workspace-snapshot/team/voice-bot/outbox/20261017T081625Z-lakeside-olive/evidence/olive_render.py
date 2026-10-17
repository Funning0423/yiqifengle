import sys,json;sys.path.insert(0,'.')
from olive_fit import *
from PIL import ImageDraw
nc=json.load(open('olive_cells.json'))
G2=dict(G);alb=G['alb'].copy()
for k,b in nc.items(): g,c=k.split(':');alb[MS[g][c]]=s2l(b)
G2['alb']=alb;after=emu.shade(G2,P_now());before=emu.shade(G,P_now())
Image.fromarray(after).save('emu_olive_after.png');Image.fromarray(before).save('emu_olive_before.png')
items=[('r5h3',ref),('stand-in before f7f892f',Image.fromarray(before)),('stand-in after olive',Image.fromarray(after))]
print(regions.table(items))
H,W_=G['oid'].shape;x0,y0,x1,y1=regions.R['far_trees'];sl=(slice(int(y0*H),int(y1*H)),slice(int(x0*W_),int(x1*W_)))
hm=G['oid'][sl]==G['ids']['LK_far_hills.glb'];print('far hills only: before',np.median(before[sl][hm],0),'after',np.median(after[sl][hm],0))
W,Hh=360,640;S=Image.new('RGB',(W*3,Hh+28),(20,20,20));d=ImageDraw.Draw(S)
for i,(n,im) in enumerate(items):S.paste(im.resize((W,Hh)),(i*W,28));d.text((i*W+6,8),n+(' (STAND-IN emulator, not Creator)' if 'stand-in' in n else ' (reference)'),fill=(255,255,255))
S.save('compare_olive_r5h3_before_after.png')
