import json,numpy as np,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
from PIL import Image,ImageDraw
F=json.load(open('q_fixed.json'));O=json.load(open('q_orig.json'))
fig,ax=plt.subplots(2,2,figsize=(12,7))
for j,c in enumerate(('sit_down','stand_up')):
  for rows,lab,ls in ((F,'planA','-'),(O,'original','--')):
    for s in 'LR':
      p=np.array([r['wrist'+s] for r in rows if r['clip']==c]);v=np.linalg.norm(np.diff(p,axis=0),axis=1)*30;a=np.diff(np.diff(p,axis=0)*30,axis=0)*30
      ax[0,j].plot(v,ls,label=f'{lab} hand.{s}');ax[1,j].plot(np.linalg.norm(a,axis=1),ls,label=f'{lab} hand.{s}')
  ax[0,j].set_title(c+' wrist speed m/s (30fps)');ax[1,j].set_title(c+' wrist accel m/s^2');ax[0,j].legend(fontsize=7)
plt.tight_layout();plt.savefig('wrist_speed_accel.png',dpi=90)
def sheet(names,kind,out,cols):
  rows=[]
  for lab,d in (('PROD',  'xf_prod'),('PLAN A','xf_fixed')):
    ims=[Image.open(f'{d}/{n}_{kind}.png').convert('RGB') for n in names]
    for im,n in zip(ims,names): ImageDraw.Draw(im).text((6,6),f'{lab} {n}',fill=(255,0,0))
    rows.append(ims)
  w,h=rows[0][0].size;S=Image.new('RGB',(w*len(names),h*2),'white')
  for r,ims in enumerate(rows):
    for i,im in enumerate(ims): S.paste(im,(i*w,r*h))
  S.save(out)
import os
L=sorted(set(f.rsplit('_',1)[0] for f in os.listdir('xf_fixed') if f.endswith('.png')))
pick=lambda pre:[n for n in L if n.split('_')[1] in pre]
sheet(pick(['sd34','sd36','xA00','xA03','xA06']),'game','seamA_game_prod_vs_planA.png',5)
sheet(pick(['sd34','sd36','xA00','xA03','xA06']),'hands','seamA_hands_prod_vs_planA.png',5)
sheet(pick(['xB00','xB02','xB04','xB06','xB09']),'game','seamB_game_prod_vs_planA.png',5)
sheet(pick(['xB00','xB02','xB04','xB06','xB09']),'hands','seamB_hands_prod_vs_planA.png',5)
