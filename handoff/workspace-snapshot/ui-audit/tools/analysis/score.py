import subprocess,numpy as np,sys
t,a,b,W,H,x0,x1,y0,y1=sys.argv[1],float(sys.argv[2]),float(sys.argv[3]),*map(int,sys.argv[4:10])
r=subprocess.run(['ffmpeg','-loglevel','error','-ss',str(a),'-i',f'raw/{t}.webm','-t',str(b-a),'-vf','format=gray','-vsync','0','-f','rawvideo','-'],capture_output=True).stdout
n=len(r)//(W*H);fr=np.frombuffer(r[:n*W*H],np.uint8).reshape(n,H,W)
for i in range(n):
  reg=fr[i,y0:y1,x0:x1]<90
  rows=np.where(reg.sum(1)>8)[0]
  print(round(a+i/25,2), (y0+rows.min(), y0+rows.max()) if len(rows) else None)
