import sys;sys.path.insert(0,'/tmp');from proj import *
def need(w,h,top,bot,m=8):
    D=8.0
    while D<60:
        rt=proj(w,h,D,0,.15,-3.95)[1]; rb=proj(w,h,D,0,.15,3.95)[1]; xl=proj(w,h,D,-3.95,.15,3.95)[0]
        if rt>=top+m and rb<=bot-m and xl>=m: return D
        D+=0.001
for name,w,h,top0,bot0,top1,bot1 in [('320x568',320,568,194,422,131,474),('390x520',390,520,171.7,374,131,426)]:
  for tag,t,b in [('before',top0,bot0),('top only',top1,bot0),('after',top1,bot1)]:
    D=need(w,h,t,b);fh,fw=farcell(w,h,D);nh=proj(w,h,D,0,.12,3.5)[1]-proj(w,h,D,0,.12,2.5)[1]
    print(name,tag,'band',round(b-t,1),'D',round(D,3),'far h×w',round(fh,1),round(fw,1),'near h',round(nh,1),'rimtop',round(proj(w,h,D,0,.15,-3.95)[1],1),'rimbot',round(proj(w,h,D,0,.15,3.95)[1],1),'xl',round(proj(w,h,D,-3.95,.15,3.95)[0],1))
print('--variants 320')
for lab,hx,m in [('rim m4',3.95,4),('grid edge m8',3.5,8),('rim m0',3.95,0)]:
    D=8.0
    while True:
        if proj(320,568,D,0,.15,-3.95)[1]>=139 and proj(320,568,D,0,.15,3.95)[1]<=466 and proj(320,568,D,-hx,.15,3.95)[0]>=m: break
        D+=0.001
    print(lab,round(D,3),[round(v,1) for v in farcell(320,568,D)])
