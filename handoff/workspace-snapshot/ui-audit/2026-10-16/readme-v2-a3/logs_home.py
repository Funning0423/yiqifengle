import sys,re,json;sys.path.insert(0,'/workspace/wechat-game/ui-audit/2026-10-16/fixes-511953e/logs');from aud import *
import numpy as np
def run(base,tag,logname):
  a,sr=load(f'{base}/audio/{tag}.wav')
  fm=int(re.search(r'"firstMs":(\d+)',[l for l in open(f'{base}/logs/{logname}') if 'audioSaved' in l][0]).group(1))
  off=fm/1000-first(a,sr)
  wl=open(f'{base}/raw/{tag}_worldFlowLog.txt').read().split('\n')
  homes=[float(l.split('\t')[0]) for l in wl if '"event":"state:home"' in l and float(l.split('\t')[0])>60]
  h=homes[0]
  s=a[int((h-2-off)*sr):int((h+6-off)*sr)]
  wp=[l.split('\t')[0]+' '+re.search(r'\{.*',l).group(0)[:110] for l in wl if 'QF_AUDIO' in l and ('waves-play' in l or 'waves-level' in l) and h-1.1<float(l.split('\t')[0])<h+3.2]
  # 100ms rms dB around home
  rms=['%.0f'%(10*np.log10(np.mean(a[int((h+k-off)*sr):int((h+k+0.25-off)*sr)]**2)+1e-24)) for k in np.arange(-0.5,3.0,0.25)]
  print(f'{base.split("/")[-1]} {tag}: home@{h:.2f} peak {np.abs(s).max():.3f} n>=0.999 {(np.abs(s)>=0.999).sum()} n>=0.98 {(np.abs(s)>=0.98).sum()} | whole-file peak {np.abs(a).max():.3f} n>=0.999 {(np.abs(a)>=0.999).sum()}')
  print('   rms(0.25s) home-0.5..+2.75:',' '.join(rms))
  for x in wp:print('   ',x)
base=sys.argv[1]
for tag,log in [('ib_day_390','recday.log'),('ib_night_390','recnight.log'),('ib_day_390_vis3000','recvis3.log')]:
  try:run(base,tag,log)
  except Exception as e:print(tag,'ERR',e)
