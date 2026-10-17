# Side-by-side preview video, 24 fps: FALLBACK (default follow lens, held after the stop) | NEW (Landing A lakeside -> 1 s
# landing->board blend -> board camera). Journey frames rendered every 2nd plan frame (each shown twice); the last 2 s of the
# walk, the blend and the board hold are rendered every frame. Blender EEVEE previews of the committed maths, NOT in-game.
import os,sys,json,subprocess
from PIL import Image,ImageDraw,ImageFont
D=sys.argv[1];out=sys.argv[2];sha=sys.argv[3];tmp='/workspace/tmp-lkcam/vid';os.makedirs(tmp,exist_ok=True)
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',15);f2=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
plan=json.load(open(D+'/scripts/plan.json'));frames=plan['frames']
have={v:sorted(int(n[1:6]) for n in os.listdir(D+'/renders/'+v) if n.endswith('.png') and not n.endswith('.tmp.png')) for v in ('new','fallback')}
def pick(v,i):
  c=[k for k in have[v] if k<=i];return c[-1] if c else None
n=0
for fr in frames:
  i=fr['i'];a=pick('fallback',i);b=pick('new',i)
  if a is None or b is None:continue
  A=Image.open(D+'/renders/fallback/f%05d.png'%a).convert('RGB');B=Image.open(D+'/renders/new/f%05d.png'%b).convert('RGB')
  o=Image.new('RGB',(A.width+B.width+8,A.height+44),(20,20,20));o.paste(A,(0,44));o.paste(B,(A.width+8,44));d=ImageDraw.Draw(o)
  d.text((8,4),'FALLBACK (default follow, hold)',font=F,fill=(240,150,120));ph={'journey':'journey','blend':'landing→board blend 1 s','board':'board camera'}[fr['phase']]
  d.text((A.width+16,4),'NEW %s: %s'%(sha,ph),font=F,fill=(130,190,240))
  d.text((8,24),'t %.2f s  s %.2f m  17 s S-curve walk  |  Blender preview, not in-game'%(fr['t'],fr['s']),font=f2,fill=(200,200,200))
  o.save(tmp+'/v%05d.png'%n);n+=1
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(plan['fps']),'-i',tmp+'/v%05d.png','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',out],check=True)
subprocess.run(['rm','-rf',tmp]);print('frames',n,'->',out)
