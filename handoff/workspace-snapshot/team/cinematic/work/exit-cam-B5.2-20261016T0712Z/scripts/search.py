import json,numpy as np,itertools
B=json.load(open('bbox.json'))
def corners(b): (a,c)=b; return np.array([[x,y,z] for x in (a[0],c[0]) for y in (a[1],c[1]) for z in (a[2],c[2])])
ROOT=np.array([-2.1135,0,5.2814]);her=corners([[ROOT[0]-.35,0,ROOT[2]-.35],[ROOT[0]+.35,1.75,ROOT[2]+.35]])
LH=corners(B['env_lighthouse_ext']);PT=corners(B['beach_palm_tall']);P1=corners(B['env_prop_palm_tall_01']);PL=corners(B['env_prop_palm_lean_01']);PS=corners(B['beach_palm_short'])
def proj(p,c,t,fov):
  f=t-c;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);d=p-c;z=d@f;th=np.tan(np.radians(fov)/2)
  return np.stack([(d@r)/z/th,(d@u)/z/th],1),z   # x in units of vertical half-height
def box(P):return P[:,0].min(),P[:,0].max(),P[:,1].min(),P[:,1].max()
def ov(a,b):return not(a[1]<b[0] or b[1]<a[0] or a[3]<b[2] or b[3]<a[2])
res=[]
for x,y,z,tx,ty,tz,fov in itertools.product(np.arange(-22,-5,1.0),(10,11,12),np.arange(-2,24,1.0),(-3,-2,-1,0),(1.5,2.5,3.5),(-1,0.5,2,3.5),(44,48,52,56)):
  c=np.array([x,y,z]);t=np.array([tx,ty,tz]);
  if c[0]-ROOT[0]>-0.5: continue
  H,_=proj(her,c,t,fov);L,_=proj(LH,c,t,fov);hb=box(H);lb=box(L)
  a46=.46;m=.06  # margin in vertical half units
  inside=lambda b,a:b[0]>-a+m and b[1]<a-m and b[2]>-1+m and b[3]<1-m
  if not(inside(hb,a46) and inside(lb,a46)):continue
  ok=True
  for Pp in (PT,P1,PL,PS):
    Q,zz=proj(Pp,c,t,fov)
    if (zz<0.5).any(): ok=False;break
    qb=box(Q)
    if ov(qb,hb): ok=False;break
    if Pp is PT and ov(qb,(-.75,.75,-1,1)): ok=False;break
  if not ok: continue
  dist=np.linalg.norm(c-ROOT);hh=hb[3]-hb[2];lh=lb[3]-lb[2]
  res.append((hh,lh,dist,[x,y,z],[tx,ty,tz],fov,[round(v,2) for v in hb],[round(v,2) for v in lb]))
res.sort(key=lambda r:-r[0]);print(len(res))
for r in res[:15]:print(r)
