# 统计 mask 里穿插三角（品红）和握把（绿）的可见像素；Workbench 经过色彩管理，所以按最近色分类
import numpy as np,glob,json,sys
from PIL import Image
out={}
for f in sorted(glob.glob(sys.argv[1]+'/*_mask.png')):
    a=np.array(Image.open(f).convert('RGB')).astype(int)
    m=(np.abs(a-[201,116,201]).sum(-1)<40);g=(np.abs(a-[110,196,80]).sum(-1)<40)
    ys,xs=np.where(m|g);out[f.split('/')[-1][:-9]]=dict(bad_px=int(m.sum()),grip_px=int(g.sum()),bbox=[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())] if len(xs) else None)
json.dump(out,open(sys.argv[1]+'/visibility.json','w'),indent=1)
for k,v in out.items(): print(k,v)
