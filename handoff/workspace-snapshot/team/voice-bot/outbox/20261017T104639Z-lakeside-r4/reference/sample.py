#!/usr/bin/env python3
"""Engine-camera r5h3 colour reference (Voice Bot r4). Samples the 10 points + mid stripe of a lakeside board-background
capture and checks them against the graded engine-camera r5h3 targets (pass: every channel within +-12, stripe std <= 10).
usage: python3 sample.py <image.png> [390x844|360x640]   (390x844 = 780x1688 @2x, 360x640 = 720x1280 @2x; auto by size)"""
import sys,json,os,numpy as np
from PIL import Image
T=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'targets.json')))
PTS=['far_water','mid_water','mid_water_R','under_bridge','near_mid_water','near_water_bottom','near_water_L','bridge_stone_deck','bridge_stone_left','bridge_rail_top']
LAND=['grass_near','far_hills','mtn_snow','tree_crown','house_wall','far_shore']
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
k=sys.argv[2] if len(sys.argv)>2 else ('390x844' if a.shape[0]==1688 else '360x640')
key={'390x844':'844','360x640':'640'}[k];bx=T['boxes_'+k];tg=T['targets_graded'][key]
assert a.shape[:2]==((1688,780) if key=='844' else (1280,720)),'expected a %s @2x capture, got %s'%(k,a.shape[:2])
med=lambda b:np.median(a[b[1]:b[3],b[0]:b[2]].reshape(-1,3),0)
ok=True
for n in PTS:
  v=med(bx[n]);e=v-np.array(tg[n]);p=abs(e).max()<=12;ok&=p
  print('%-18s %3d/%3d/%3d  target %3d/%3d/%3d  diff %+4d/%+4d/%+4d  %s'%(n,*v,*tg[n],*e,'ok' if p else 'FAIL'))
x0,y0,x1,y1=bx['STRIPE'];s=float(a[y0:y1,x0:x1].mean(1).std(0).mean());ok&=s<=10
print('STRIPE std %.1f (bar <= 10, reference %.1f)'%(s,T['stripe'][key][0]))
for n in LAND:print('  land %-11s %3d/%3d/%3d  reference %3d/%3d/%3d'%(n,*med(bx[n]),*tg[n]))
print('PASS' if ok else 'FAIL');sys.exit(0 if ok else 1)
