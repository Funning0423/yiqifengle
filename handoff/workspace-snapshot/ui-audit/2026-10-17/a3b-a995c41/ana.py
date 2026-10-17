import sys,re,json;sys.path.insert(0,'/workspace/wechat-game/ui-audit/2026-10-16/fixes-511953e/logs');from aud import *
import numpy as np
def db(x):return 20*np.log10(x+1e-12)
def rms(a):return np.sqrt(np.mean(a**2)+1e-24)
def run(base,tag,logname):
  a,sr=load(f'{base}/audio/{tag}.wav')
  lg=open(f'{base}/logs/{logname}').read().split('\n')
  fm=int(re.search(r'"firstMs":(\d+)',[l for l in lg if 'audioSaved' in l][0]).group(1))
  off=fm/1000-first(a,sr)
  tap=[float(l.split()[1]) for l in lg if ' tapHome ' in l][0]
  wl=open(f'{base}/raw/{tag}_worldFlowLog.txt').read().split('\n')
  h=[float(l.split('\t')[0]) for l in wl if '"event":"state:home"' in l and float(l.split('\t')[0])>60][0]
  S=lambda t0,t1:a[max(0,int((t0-off)*sr)):int((t1-off)*sr)]
  w=S(tap-0.2,tap+0.2)
  bg=S(tap-1.2,tap-0.2)
  # click: strongest 30ms window in tap..tap+150ms
  seg=S(tap,tap+0.15);n=int(0.03*sr);best=max(range(0,len(seg)-n,int(0.005*sr)),key=lambda i:rms(seg[i:i+n]))
  cl=seg[best:best+n]
  post=S(h,h+3)
  print(f'{base.split("/")[-1]:14s} {tag:14s} tap@{tap:.2f} home@{h:.2f}(+{h-tap:.2f}) | tap±200ms peak {np.abs(w).max():.3f} ({db(np.abs(w).max()):.1f} dBFS) n>=.999 {(np.abs(w)>=.999).sum()} n>=.98 {(np.abs(w)>=.98).sum()} | whole peak {np.abs(a).max():.3f} n>=.999 {(np.abs(a)>=.999).sum()}')
  print(f'    click 30ms rms {db(rms(cl)):.1f} dB @+{best/sr*1000:.0f}ms, peak {np.abs(cl).max():.3f} | bed(tap-1.2..-0.2) rms {db(rms(bg)):.1f} dB peak {np.abs(bg).max():.3f} | click-bed {db(rms(cl))-db(rms(bg)):+.1f} dB rms, {db(np.abs(cl).max())-db(np.abs(bg).max()):+.1f} dB peak | post-home 0-3s peak {np.abs(post).max():.3f}')
  r=['%.0f'%db(rms(S(h+k,h+k+0.1))) for k in np.arange(-0.6,2.5,0.1)]
  print('    rms100ms home-0.6..+2.4:',' '.join(r))
  for l in wl:
    try:x=float(l.split('\t')[0])
    except:continue
    if tap-0.3<x<h+3.2 and ('QF_AUDIO' in l) and any(k in l for k in ('waves','home-duck','transition','track','bgm')):print('    %+.3f'%(x-tap),re.search(r'\{.*',l).group(0)[:150])
base=sys.argv[1];tags=sys.argv[2:] or ['ib_day_390:recday.log','ib_night_390:recnight.log']
for t in tags:
  tag,log=t.split(':')
  try:run(base,tag,log)
  except Exception as e:print(tag,'ERR',repr(e))
