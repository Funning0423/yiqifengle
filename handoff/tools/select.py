import os,sys,json
os.chdir('/workspace/wechat-game')
roots=['team','product','ui-audit','ui-design','art/regions/lakeside/ENGINE_COLOR_REFERENCE']
VID={'.mp4','.webm','.mov','.mkv','.avi'}
SRC={'.py','.json','.md','.txt','.log','.ts','.js','.cjs','.mjs','.sh','.csv','.yaml','.yml','.effect','.chunk','.toml','.cfg','.ini','.html','.css','.glsl','.tsv','.diff'}
SKIPD={'.git','node_modules','__pycache__','build','library','temp','.cache','.venv','venv'}
VIDEO_KEEP=('team/cinematic/outbox/','team/voice-bot/outbox/20261017T121502Z-r4-exit-footsteps/recording-yunjing/')
inc=[];exc=[]
for r in roots:
  for dp,dn,fn in os.walk(r):
    for d in list(dn):
      if d in SKIPD:
        p=os.path.join(dp,d); sz=sum(os.lstat(os.path.join(a,f)).st_size for a,_,fs in os.walk(p) for f in fs)
        exc.append((p+'/',sz,'dir:'+d)); dn.remove(d)
    for f in fn:
      p=os.path.join(dp,f)
      if os.path.islink(p): exc.append((p,0,'symlink')); continue
      s=os.lstat(p).st_size; e=os.path.splitext(f)[1].lower()
      why=None
      if p.startswith('team/voice-bot/outbox/patches/'): why='voice-bot outbox/patches (dup of voice/* branches)'
      elif 'NOT_FOR_SHIP' in p: why='NOT_FOR_SHIP BGM reference re-encodes (licensing; keep on box)'
      elif s>50_000_000: why='>50MB'
      elif e=='.bundle' or '.bundle.part' in f: why='git-bundle(dup of local branches)'
      elif e in('.blend1','.pyc') or f=='.DS_Store': why='backup/cache'
      elif e=='.patch' and s>5_000_000: why='large binary patch(>5MB; content in branches)'
      elif p.startswith('team/cinematic/work/') and (e not in SRC or s>5_000_000): why='cinematic work render/frame/binary'
      elif e in VID and not p.startswith(VIDEO_KEEP): why='video recording (kept on box)'
      elif f.startswith('._'): why='macOS AppleDouble ._ file'
      elif p.startswith('ui-audit/') and e in VID|{'.wav'}: why='ui-audit media (kept on box)'
      elif p.startswith('ui-audit/2026-10-15/') and e in ('.png','.jpg','.jpeg'): why='ui-audit 10-15 images dropped (size budget)'
      elif p.startswith('ui-audit/2026-10-16/') and e in ('.png','.jpg','.jpeg') and not p.startswith(('ui-audit/2026-10-16/milestone-09a1b8e/','ui-audit/2026-10-16/a3b-a17395c/','ui-audit/2026-10-16/result-screen-v2-b0020ed/')): why='ui-audit 10-16 images of superseded rounds dropped (size budget)'
      if why: exc.append((p,s,why))
      else: inc.append((p,s))
json.dump({'inc':inc,'exc':exc},open('/workspace/handoff-prep/sel.json','w'))
import collections
print('INCLUDED',len(inc),round(sum(s for _,s in inc)/1e6,1),'MB')
c=collections.Counter();n=collections.Counter()
for p,s,w in exc: c[w]+=s;n[w]+=1
for w in c: print('EXCL',w,n[w],round(c[w]/1e6,1),'MB')
t=collections.Counter()
for p,s in inc: t['/'.join(p.split('/')[:2])]+=s
for k,v in t.most_common(): print(f'  {k} {v/1e6:.1f}')
