# B5.1 | B5.3 side-by-side, 0.46 portrait native renders, 10 fps real time. Usage: compose53.py out.mp4
import sys,os,glob,subprocess,numpy as np
sys.path.insert(0,'/tmp/b5')
from PIL import Image,ImageDraw,ImageFont
from kin import kin
out=sys.argv[1];K={'B53':kin('/tmp/b5/frames_B53.json'),'B542':kin('/tmp/b5/frames_B542.json')}
def font(sz):
  for p in ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
    if os.path.exists(p): return ImageFont.truetype(p,sz)
  return ImageFont.load_default()
F1,F2=font(18),font(12)
fs={v:sorted(glob.glob(f'/tmp/b542v10/{v}_046_*.png')) for v in K};n=max(len(x) for x in fs.values())
tmp='/tmp/b542comp';os.makedirs(tmp,exist_ok=True)
for i in range(n):
  ims=[Image.open(fs[v][min(i,len(fs[v])-1)]).convert('RGB') for v in ('B53','B542')];w,h=ims[0].size
  C=Image.new('RGB',(w*2+6,h+56+34),(20,20,20));d=ImageDraw.Draw(C);t=i/10
  for k,(v,im) in enumerate(zip(('B53','B542'),ims)):
    x=k*(w+6);C.paste(im,(x,56));kk=K[v];j=int(np.argmin(abs(kk['t']-t)));sp=float(np.linalg.norm(kk['V'][j]))
    d.text((x+6,4),'B5.3 (rejected)' if v=='B53' else 'B5.4.2 (home pose)',fill=(255,120,120) if v=='B53' else (120,190,255),font=F1)
    d.text((x+6,30),f't={t:4.1f}s {sp:3.1f} m/s'+(' (held)' if t>kk['t'][-1] else ''),fill=(230,230,230),font=F2)
  d.text((6,56+h+3),'0.46 portrait · 10 fps real time · t=0 crossing-out · end = sailboat start (B5.4.2 f1131@30fps)',fill=(200,200,200),font=F2)
  d.text((6,56+h+18),'Blender EEVEE offline preview, NOT a Cocos capture; no audio',fill=(255,210,120),font=F2)
  C.save(f'{tmp}/{i:04d}.png')
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','10','-i',f'{tmp}/%04d.png','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p','-crf','18',out],check=True);print(out,n)
