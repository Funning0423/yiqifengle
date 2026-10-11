import json,math,sys,numpy as np
def proj(s,pt,W=586,H=1266):
  x,y,z,w=s['rot'];q=np.array([x,y,z]);v=np.array(pt)-np.array(s['pos'])
  # inverse rotate
  qi=-q;l=v*(w*w-qi.dot(qi))+2*qi*(qi.dot(v))+2*w*np.cross(qi,v)
  th=math.tan(math.radians(s['fov'])/2);asp=W/H
  if l[2]>=0:return None
  nx=l[0]/(-l[2])/(th*asp);ny=l[1]/(-l[2])/th;return ((nx+1)/2*W,(1-ny)/2*H,-l[2])
if __name__=='__main__':
  for f in sys.argv[1:]:
    for s in json.load(open(f)):print(s['name'],[None if p is None else tuple(round(c,1) for c in p) for p in [proj(s,[0,1.2,0.05]),proj(s,[0,1.2,-3])]])
