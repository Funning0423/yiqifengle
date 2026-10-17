import json,subprocess,numpy as np,sys
def frames(t,a,b,W=375,H=812):
  r=subprocess.run(['ffmpeg','-loglevel','error','-ss',str(a),'-i',f'raw/{t}.webm','-t',str(b-a),'-vf',f'crop={W}:{H}:0:0,format=gray','-vsync','0','-f','rawvideo','-'],capture_output=True).stdout
  pts=subprocess.run(['ffprobe','-v','error','-read_intervals',f'{a}%{b}','-select_streams','v','-show_entries','frame=pts_time','-of','csv=p=0',f'raw/{t}.webm'],capture_output=True,text=True).stdout.split()
  pts=[float(x) for x in pts if x and a<=float(x)<b]
  n=len(r)//(W*H);fr=np.frombuffer(r[:n*W*H],np.uint8).reshape(n,H,W)
  return pts[:n],fr[:len(pts)]
