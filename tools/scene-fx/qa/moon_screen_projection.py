# QA only: projects the moon / camera-track islandIdlePose to screen (python3)
import json,math
T=json.load(open('/workspace/yiqifengle/previews/运镜bot/camera-track.e3863fb.json'))
def qrot(q,v):
    x,y,z,w=q; vx,vy,vz=v
    tx=2*(y*vz-z*vy);ty=2*(z*vx-x*vz);tz=2*(x*vy-y*vx)
    return [vx+w*tx+(y*tz-z*ty),vy+w*ty+(z*tx-x*tz),vz+w*tz+(x*ty-y*tx)]
def proj(f,p,aspect=T['aspect']):
    q=f['rotation'];c=f['position'];d=[p[i]-c[i] for i in range(3)]
    r=qrot(q,[1,0,0]);u=qrot(q,[0,1,0]);fw=qrot(q,[0,0,-1])
    z=sum(d[i]*fw[i] for i in range(3))
    if z<=0: return None
    t=math.tan(math.radians(f['fovVerticalDeg'])/2)
    x=sum(d[i]*r[i] for i in range(3))/z/(t*aspect);y=sum(d[i]*u[i] for i in range(3))/z/t
    return ((x+1)/2,(1-y)/2,z)  # 0..1 from top-left
