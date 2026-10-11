# keep every preview image ≤ 700 KB (easy to send): PNG → pngquant (q 85-98, then lower), JPG → lower quality
import os,sys,glob,subprocess
from PIL import Image
LIM=700*1000; D=sys.argv[1]
for f in sorted(glob.glob(os.path.join(D,'*.png'))+glob.glob(os.path.join(D,'*.jpg'))):
    if os.path.getsize(f)<=LIM: continue
    if f.endswith('.png'):
        for q in ('90-99','85-98','75-95','65-90'):
            subprocess.run(['pngquant','--force','--quality',q,'--speed','1','--strip','--output',f+'.tmp',f],check=False)
            if os.path.exists(f+'.tmp') and os.path.getsize(f+'.tmp')<=LIM: os.replace(f+'.tmp',f); break
    else:
        im=Image.open(f).convert('RGB')
        for q in range(85,55,-3):
            im.save(f+'.tmp.jpg',quality=q,optimize=True,progressive=True)
            if os.path.getsize(f+'.tmp.jpg')<=LIM: os.replace(f+'.tmp.jpg',f); break
    print(os.path.basename(f),os.path.getsize(f))
