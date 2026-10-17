import subprocess,numpy as np,sys
def lum(t,a,b,W,H):
  r=subprocess.run(['ffmpeg','-loglevel','error','-ss',str(a),'-i',f'raw/{t}.webm','-t',str(b-a),'-vf','scale=%d:%d,format=gray'%(W//4,H//4),'-vsync','0','-f','rawvideo','-'],capture_output=True).stdout
  w,h=W//4,H//4;n=len(r)//(w*h);fr=np.frombuffer(r[:n*w*h],np.uint8).reshape(n,h,w)
  return fr.mean(axis=(1,2))
t,a,b=sys.argv[1],float(sys.argv[2]),float(sys.argv[3])
y=lum(t,a,b,390,844)
fps=25
for i,v in enumerate(y):print(round(a+i/fps,2),round(v,1))
