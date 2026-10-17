import subprocess,sys,numpy as np
f,ss,t,reg=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4:]
W,H=375,812
raw=subprocess.run(['ffmpeg','-loglevel','error','-ss',ss,'-i',f,'-t',t,'-vf',f'fps=10,crop={W}:{H}:0:0,format=gray','-f','rawvideo','-'],capture_output=True).stdout
fr=np.frombuffer(raw,np.uint8).reshape(-1,H,W).astype(np.int16)
for r in reg:
  n,x,y,w,h=r.split(':');x,y,w,h=map(int,(x,y,w,h))
  d=[np.abs(fr[i+1,y:y+h,x:x+w]-fr[i,y:y+h,x:x+w]).mean() for i in range(len(fr)-1)]
  print(n,'mean=%.2f max=%.2f'%(np.mean(d),np.max(d)))
