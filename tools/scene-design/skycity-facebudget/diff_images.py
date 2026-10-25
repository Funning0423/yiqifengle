"""before/after/diff per camera x day/night. diff = |after-before| x AMP (clipped); stats on 8-bit RGB.
python3 diff_images.py <render_dir> <out_dir>   (render_dir has before_*, before2_* (noise floor), after_*)"""
import sys,os,json,shutil,numpy as np
from PIL import Image
R,O=sys.argv[1],sys.argv[2];os.makedirs(O,exist_ok=True);AMP=10;res={}
L=lambda p:np.asarray(Image.open(p).convert('RGB')).astype(int)
for cam in ['t02_final','board','arrival','departure']:
  for st in ['day','night']:
    n=f'{cam}_{st}';b,a,b2=L(f'{R}/before_{n}.png'),L(f'{R}/after_{n}.png'),L(f'{R}/before2_{n}.png')
    d=np.abs(a-b);dn=np.abs(b2-b)
    shutil.copy(f'{R}/before_{n}.png',f'{O}/{n}_before.png');shutil.copy(f'{R}/after_{n}.png',f'{O}/{n}_after.png')
    Image.fromarray(np.clip(d*AMP,0,255).astype('u1')).save(f'{O}/{n}_diff_x{AMP}.png')
    res[n]={'max':int(d.max()),'mean':round(float(d.mean()),4),'pixelsOver2':int((d.max(2)>2).sum()),'noiseFloor_before_vs_before':{'max':int(dn.max()),'mean':round(float(dn.mean()),4)}}
json.dump(res,open(f'{O}/pixel_diff.json','w'),indent=1);print(json.dumps(res,indent=1))
