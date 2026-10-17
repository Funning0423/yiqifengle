import sys,glob,numpy as np
sys.path.insert(0,'/workspace/wechat-game/art/regions/lakeside/scripts');from postgrade16 import grade
from PIL import Image
import imageio.v3 as iio
for k in ('r640','r844'):
  fs=sorted(glob.glob(f'ref/{k}/f_*.png'));pre=[];gr=[]
  for f in fs:
    a=iio.imread(f);a=a[...,:3].astype(float)*(255/65535 if a.dtype==np.uint16 else 1);pre.append(a)
    g=f.replace('f_','g_');grade(f,g,seed=int(f[-8:-4]));gr.append(np.asarray(Image.open(g).convert('RGB')).astype(float))
  P=np.median(np.stack(pre),0);G=np.median(np.stack(gr),0)
  np.save(f'ref/{k}_pre_tmed.npy',P);np.save(f'ref/{k}_graded_tmed.npy',G)
  Image.fromarray(np.clip(P+.5,0,255).astype(np.uint8)).save(f'ref/{k}_pre_tmed.png');Image.fromarray(np.clip(G+.5,0,255).astype(np.uint8)).save(f'ref/{k}_graded_tmed.png')
  print(k,len(fs),iio.imread(fs[0]).dtype)
