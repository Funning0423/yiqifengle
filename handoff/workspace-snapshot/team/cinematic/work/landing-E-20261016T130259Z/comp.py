import json,os,subprocess,sys
from PIL import Image,ImageDraw,ImageFont
O=open('outdir').read().strip()
FN='/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc';BIG=ImageFont.truetype(FN,22);SM=ImageFont.truetype(FN,14)
E=json.load(open('E.json'));M=json.load(open('E_metrics.json'));A=json.load(open('/tmp/vid/LA.json'));AM=json.load(open('Ametrics.json'))
os.makedirs('xE',exist_ok=True);os.makedirs('sbs',exist_ok=True)
def label(im,lab,sub):
  g=ImageDraw.Draw(im);g.text((8,6),lab,font=BIG,fill=(255,235,120));g.text((60,12),sub,font=SM,fill=(255,255,255));return im
Af=[label(Image.open(f'/tmp/vid/f-LA/{p["i"]:04d}.png').convert('RGB'),'A',f'd {p["d"]:.1f} m') for p in A]
for j,p in enumerate(E):
  m=M[j];sub=f'd {p["d"]:.1f} m' if p['phase']=='walk' else f'{p["phase"]} +{(j-150)/15:.1f}s  cam {m["aboveFloor"]:+.1f} m vs plaza'
  e=label(Image.open(f'f-E/{p["i"]:04d}.png').convert('RGB'),'E',sub);e.save(f'xE/{j:04d}.png')
  a=Af[min(j,len(Af)-1)].copy()
  if j>=len(Af):ImageDraw.Draw(a).text((8,34),'(A ended – holding last frame)',font=SM,fill=(255,160,160))
  s=Image.new('RGB',(784,844));s.paste(a,(0,0));s.paste(e,(394,0));s.save(f'sbs/{j:04d}.png')
ff=lambda i,o:subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','15','-i',i,'-c:v','libx264','-pix_fmt','yuv420p','-crf','18',o],check=True)
ff('xE/%04d.png',O+'/landing_E.mp4');ff('sbs/%04d.png',O+'/sbs_A_vs_E.mp4')
def hx(lab):
  return (None,None)
def final(path,lab,h,top,left,vis,desc):
  im=Image.open(path).convert('RGB');g=ImageDraw.Draw(im);W,H=im.size
  px,py=left/100*W,top/100*H;g.ellipse((px-9,py-9,px+9,py+9),outline=(0,255,255),width=3);g.line((px-16,py,px+16,py),fill=(0,255,255),width=2);g.line((px,py-16,px,py+16),fill=(0,255,255),width=2)
  g.line((0,H/2,W,H/2),fill=(255,255,255),width=1);g.line((W/2,0,W/2,H),fill=(120,120,120),width=1)
  g.rectangle((0,0,W,118),fill=(0,0,0));g.text((W-30,6),lab,font=BIG,fill=(255,235,120))
  g.text((8,4),f'her height {h:.3f} of screen (~1/{1/h:.0f}, {round(h*844)} px @844)',font=SM,fill=(255,255,255))
  g.text((8,26),f'plaza centre: {left:.0f}% from left ({"centred" if abs(left-50)<6 else "off-centre"}), {top:.0f}% from top',font=SM,fill=(0,255,255))
  g.text((8,48),f'plaza ground visibility {vis:.2f} (25-pt ring, r≤6 m)',font=SM,fill=(0,255,120))
  fx,fy=hx(lab);g.ellipse((fx-14,fy-14,fx+14,fy+14),outline=(255,80,80),width=2) if fx else None
  for k,t in enumerate(desc):g.text((8,70+k*20),t,font=SM,fill=(200,200,200))
  return im
f=M[-1];fe=final(f'f-E/{E[-1]["i"]:04d}.png','E',f['h'],(1-f['py'])/2*100,(f['px']+1)/2*100,f['vis'],[f'cam {f["aboveFloor"]:.1f} m above plaza floor, {f["aboveHer"]:.1f} m above her','3.0 s crane (min-snap ease) + 0.5 s hold'])
fe.save(O+'/final_E.png')
fa=final(f'/tmp/vid/f-LA/{A[-1]["i"]:04d}.png','A',AM['h'],AM['fromTop'],AM['fromLeft'],AM['vis'],[f'cam {AM["aboveFloor"]:+.1f} m vs plaza floor (level view)','plaza floor hidden by its own edge wall/rubble'])
fa.save(O+'/final_A.png')
s=Image.new('RGB',(790,844),(20,20,20));s.paste(fa,(0,0));s.paste(fe,(400,0));s.save(O+'/final_A_vs_E.png')
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
t=[m['t'] for m in M];fig,ax=plt.subplots(5,1,figsize=(9,12),sharex=True)
for a,k,l in zip(ax,['aboveFloor','speed','acc','jerk','h'],['cam height vs plaza floor (m)','cam speed (m/s)','cam accel (m/s²)','cam jerk (m/s³)','her screen-height ratio']):
  a.plot(t,[m[k] for m in M]);a.set_ylabel(l,fontsize=8);a.axvline(150/15,color='r',ls='--',lw=.8);a.axvline(195/15,color='g',ls='--',lw=.8);a.grid(alpha=.3)
ax[0].plot(t,[m['aboveHer'] for m in M],label='vs her root');ax[0].legend(fontsize=7);ax[-1].set_xlabel('t (s)  red=she stops/crane start, green=crane end');fig.suptitle('Option E camera curves (dca9c30 scene, 15 fps)');fig.tight_layout();fig.savefig(O+'/curves_E.png',dpi=90)
