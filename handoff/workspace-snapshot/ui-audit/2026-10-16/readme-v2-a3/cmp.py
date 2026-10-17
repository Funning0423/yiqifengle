import sys,re;sys.path.insert(0,'/workspace/wechat-game/ui-audit/2026-10-16/fixes-511953e/logs');from aud import *
import numpy as np
def ld(base,tag,logname):
  a,sr=load(f'{base}/audio/{tag}.wav')
  fm=int(re.search(r'"firstMs":(\d+)',[l for l in open(f'{base}/logs/{logname}') if 'audioSaved' in l][0]).group(1))
  off=fm/1000-first(a,sr)
  wl=open(f'{base}/raw/{tag}_worldFlowLog.txt').read().split('\n')
  h=[float(l.split('\t')[0]) for l in wl if '"event":"state:home"' in l and float(l.split('\t')[0])>60][0]
  return a,sr,off,h
for tag,log in [('ib_day_390','recday.log'),('ib_night_390','recnight.log'),('ib_day_390_vis3000','recvis3.log')]:
  for b in ['milestone-09a1b8e','readme-v2-a3']:
    try:a,sr,off,h=ld(b,tag,log)
    except Exception as e:print(b,tag,'ERR',e);continue
    idx=np.where(np.abs(a)>=0.98)[0]
    rel=sorted(set(['%.2f'%((i/sr+off)-h) for i in idx]))
    r=['%.0f'%(10*np.log10(np.mean(a[int((h+k-off)*sr):int((h+k+0.1-off)*sr)]**2)+1e-24)) for k in np.arange(-0.3,2.5,0.1)]
    print(f'{b[:12]:12s} {tag:20s} clip(>=.98) t-home: {rel[:12]}')
    print('   rms100ms home-0.3..+2.4:',' '.join(r))
print('--- peak per 50ms, home-0.6..-0.1 ; and peak home+0..+3')
for tag,log in [('ib_day_390','recday.log'),('ib_night_390','recnight.log'),('ib_day_390_vis3000','recvis3.log')]:
  for b in ['milestone-09a1b8e','readme-v2-a3']:
    a,sr,off,h=ld(b,tag,log)
    p=['%.2f'%np.abs(a[int((h+k-off)*sr):int((h+k+0.05-off)*sr)]).max() for k in np.arange(-0.6,-0.1,0.05)]
    post=np.abs(a[int((h-off)*sr):int((h+3-off)*sr)])
    print(f'{b[:12]:12s} {tag:20s}',' '.join(p),f'| post-home peak {post.max():.3f} n>=.98 {(post>=.98).sum()}')
