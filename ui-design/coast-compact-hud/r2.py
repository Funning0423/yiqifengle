import sys;sys.path.insert(0,'/tmp');from proj import *
def solve(w,h,top=131,bot=None):
    bot=bot or (h-94);D=8.0
    while True:
        if proj(w,h,D,0,.15,-3.95)[1]>=top+8 and proj(w,h,D,0,.15,3.95)[1]<=bot-8 and proj(w,h,D,-3.5,.12,3.5)[0]>=8: return D
        D+=0.001
def zcross(w,h,D,hx):
    # z at which edge x=-hx projects to screen x=0 (search)
    zs=[z/1000 for z in range(-3950,3951)]
    c=[z for z in zs if proj(w,h,D,-hx,.15,z)[0]<0]; return (min(c),max(c)) if c else None
for w,h in [(320,568),(390,520)]:
    D=solve(w,h);fh,fw=farcell(w,h,D)
    print(w,h,'D',round(D,3),'far',round(fh,1),round(fw,1),'near h',round(proj(w,h,D,0,.12,3.5)[1]-proj(w,h,D,0,.12,2.5)[1],1),
      'rimtop',round(proj(w,h,D,0,.15,-3.95)[1],1),'rimbot',round(proj(w,h,D,0,.15,3.95)[1],1),
      'outer near x',round(proj(w,h,D,-3.95,.15,3.95)[0],1),'outer far x',round(proj(w,h,D,-3.95,.15,-3.95)[0],1),
      'gridnear x',round(proj(w,h,D,-3.5,.12,3.5)[0],1),'cut outer z',zcross(w,h,D,3.95),'cut inner z',zcross(w,h,D,3.49),
      'cut y', [round(proj(w,h,D,-3.95,.15,z)[1],1) for z in (zcross(w,h,D,3.95) or (0,0))])
print('---')
for D in (15.735,15.97):
    w,h=320,568
    xs=[x/1000 for x in range(-3950,0)];c=[x for x in xs if proj(w,h,D,x,.15,3.95)[0]<0]
    zo=zcross(w,h,D,3.95)
    print(D,'far',[round(v,1) for v in farcell(w,h,D)],'side cut z from',zo[0] if zo else None,'near-edge cut x',max(c) if c else None,
      'gridnear x',round(proj(w,h,D,-3.5,.12,3.5)[0],1),'outer near x',round(proj(w,h,D,-3.95,.15,3.95)[0],1),'rimtop',round(proj(w,h,D,0,.15,-3.95)[1],1),'rimbot',round(proj(w,h,D,0,.15,3.95)[1],1),
      'side cut y',round(proj(w,h,D,-3.95,.15,zo[0])[1],1) if zo else None,'near cut y',round(proj(w,h,D,max(c),.15,3.95)[1],1) if c else None)
