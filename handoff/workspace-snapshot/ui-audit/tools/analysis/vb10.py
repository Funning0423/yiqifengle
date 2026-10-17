import sys,json,numpy as np
from PIL import Image,ImageDraw
import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));from zones4 import lab
R=os.environ.get('QF_VB_REF','team/voice-bot/outbox/20261017T104639Z-lakeside-r4/reference/')
T=json.load(open(R+'targets.json'))
PTS=['far_water','mid_water','mid_water_R','under_bridge','near_mid_water','near_water_bottom','near_water_L','bridge_stone_deck','bridge_stone_left','bridge_rail_top']
for p in sys.argv[1:]:
  a=np.asarray(Image.open(p).convert('RGB')).astype(float);bx=T['boxes_360x640'];tg=T['targets_graded']['640']
  med=lambda b:np.median(a[b[1]:b[3],b[0]:b[2]].reshape(-1,3),0)
  print('==',p, a.shape);ok=0;night='night' in p or 'toggled' in p
  for n in PTS:
    v=med(bx[n]);e=v-np.array(tg[n]);de=float(np.linalg.norm(lab(v)-lab(tg[n])));pp=abs(e).max()<=12;ok+=pp
    hue='B≥G>R' if (v[2]>=v[1]>v[0]) else ('G>B>R' if v[1]>v[2]>v[0] else 'other')
    print('  %-18s %3d/%3d/%3d target %3d/%3d/%3d diff %+4d/%+4d/%+4d ΔE76 %5.1f %s %s'%(n,*v,*tg[n],*e,de,'ok' if pp else 'FAIL',hue))
  x0,y0,x1,y1=bx['STRIPE'];s=float(a[y0:y1,x0:x1].mean(1).std(0).mean())
  print('  STRIPE std %.1f (bar<=10, ref %.1f)  points %d/10'%(s,T['stripe']['640'][0],ok))
  im=Image.open(p).convert('RGB');d=ImageDraw.Draw(im)
  for i,n in enumerate(PTS):b=bx[n];d.rectangle(b,outline=(255,0,0),width=2);d.text((b[0],b[1]-11),str(i+1),fill=(255,255,255))
  d.rectangle(bx['STRIPE'],outline=(255,255,0),width=1);im.save(p.replace('.png','_vb10.png'))
