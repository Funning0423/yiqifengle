exec(open('search.py').read().split('res=[]')[0])
res=[]
def inarea(qb,a=.75):
  x0,x1,y0,y1=max(qb[0],-a),min(qb[1],a),max(qb[2],-1),min(qb[3],1);return max(0,x1-x0)*max(0,y1-y0)/(2*a*2)
for x,y,z,tx,ty,tz,fov in itertools.product(np.arange(-22,-5,1.0),(10,11,12),np.arange(-2,24,1.0),np.arange(-4,1,1.0),(1.5,2.5,3.5),np.arange(-1,6,1.0),(48,52,56)):
  c=np.array([x,y,z]);t=np.array([tx,ty,tz])
  if c[0]-ROOT[0]>-0.5: continue
  H,_=proj(her,c,t,fov);hb=box(H)
  if abs((hb[0]+hb[1])/2)>0.2: continue
  L,_=proj(LH,c,t,fov);lb=box(L);m=.05
  inside=lambda b,a:b[0]>-a+m and b[1]<a-m and b[2]>-1+m and b[3]<1-m
  if not(inside(hb,.46) and inside(lb,.46)):continue
  bad=False;areas={}
  for nm,Pp in (('PT',PT),('P1',P1),('PL',PL),('PS',PS)):
    Q,zz=proj(Pp,c,t,fov)
    if (zz<0.5).any(): bad=True;break
    qb=box(Q)
    if ov(qb,hb): bad=True;break
    if nm=='PT' and ov(qb,lb): bad=True;break
    areas[nm]=round(inarea(qb),3)
  if bad: continue
  res.append((round(areas['PT'],3),round(hb[3]-hb[2],3),[x,y,z],[tx,ty,tz],fov,[round(v,2) for v in hb],[round(v,2) for v in lb],areas))
print(len(res));res.sort(key=lambda r:r[0]*2-r[1])
for r in res[:12]:print(r)
