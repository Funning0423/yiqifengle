# Side-by-side B4 | B5 labelled frames -> mp4. Usage: compose.py <asp 046|075> <out.mp4>
import sys,json,os,glob,subprocess,numpy as np
from PIL import Image,ImageDraw,ImageFont
from kin import kin
asp,out=sys.argv[1],sys.argv[2]
K={v:kin(f'/tmp/b5/frames_{v}.json') for v in ('B4','B51')}
def font(sz):
  for p in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
    if os.path.exists(p): return ImageFont.truetype(p,sz)
  return ImageFont.load_default()
F1,F2=font(20),font(14)
n=max(len(glob.glob(f'/tmp/b5/vf/{v}_075_*.png')) for v in ('B4','B51'))
tmp=f'/tmp/b5/comp51_{asp}';os.makedirs(tmp,exist_ok=True)
for i in range(n):
  ims=[]
  for v in ('B4','B51'):
    fs=sorted(glob.glob(f'/tmp/b5/vf/{v}_075_*.png'));p=fs[min(i,len(fs)-1)];im=Image.open(p).convert('RGB')
    if asp=='046':W=round(im.size[1]*390/844);x0=(im.size[0]-W)//2;im=im.crop((x0,0,x0+W,im.size[1]))
    ims.append(im)
  w,h=ims[0].size;H=h+64+40;C=Image.new('RGB',(w*2+6,H),(20,20,20));d=ImageDraw.Draw(C)
  for k,(v,im) in enumerate(zip(('B4','B51'),ims)):
    x=k*(w+6);C.paste(im,(x,64));t=i/10;k_=K[v];j=int(np.argmin(abs(k_['t']-t)));sp=float(np.linalg.norm(k_['V'][j]));y=float(k_['P'][j,1])
    lab='B4 (rejected)' if v=='B4' else 'B5.1 (candidate)'
    d.text((x+8,6),lab,fill=(255,120,120) if v=='B4' else (120,190,255),font=F1)
    held=' (end, held)' if t>k_['t'][-1] else ''
    d.text((x+8,36),f't={t:4.1f}s  cam {sp:4.1f} m/s  h={y:4.1f} m{held}',fill=(230,230,230),font=F2)
  d.text((8,64+h+4),f'aspect {"0.46 (390x844 portrait, centre crop of the 0.75 render, same vertical FOV)" if asp=="046" else "0.75"} · t=0 = crossing-out start · flow_sim camera, B5.1 = b12ff1f',fill=(200,200,200),font=F2)
  d.text((8,64+h+21),'Blender EEVEE offline preview, NOT a Cocos capture; static pose slides along her real root; no audio',fill=(255,210,120),font=F2)
  C.save(f'{tmp}/{i:04d}.png')
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','10','-i',f'{tmp}/%04d.png','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-crf','18',out],check=True);print(out,n)
