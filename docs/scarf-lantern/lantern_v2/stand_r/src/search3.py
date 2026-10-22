# 参数搜索：在代表帧上测三项穿入深度，坐标下降
import itertools,time
from mathutils.bvhtree import BVHTree as BV
def depth_sub(iv,it,ov_,ot,ctr):
    TI=BV.FromPolygons(iv,it);TO=BV.FromPolygons(ov_,ot);ov=TI.overlap(TO)
    if not ov:return 0.0,0
    sub=sorted({b for _,b in ov});TS=BV.FromPolygons(ov_,[ot[b] for b in sub]);mx=0.0
    for k in {k for a,_ in ov for k in it[a]}:
        v=iv[k];h=TS.find_nearest(v)
        if h[0] is None:continue
        n=h[1]
        if n.dot(h[0]-ctr)<0:n=-n
        mx=max(mx,(v-h[0]).dot(n))
    return mx*1000,len(ov)
def m3():
    bv,bt=wm(Bo);lt=[x for x,pi in bt if PC2[pi]=='LEG'];C={}
    for k in ('DRESS','APRON'):v,t=wm(M[k]);C[k]=(v,[x for x,_ in t])
    ctr=arm.matrix_world@PB['hips'].head;r={}
    for a,b,(iv,it) in (('LEG','DRESS',(bv,lt)),('LEG','APRON',(bv,lt)),('DRESS','APRON',C['DRESS'])):r[a+'_'+b]=depth_sub(iv,it,C[b][0],C[b][1],ctr)
    hits=0;pv,pt=wm(PLAT);TP=BV.FromPolygons(pv,[x for x,_ in pt])
    TC=[BV.FromPolygons(*C[k]) for k in C]
    for g_ in ('HANDR','ARMR','HANDL','ARML'):
        TG=BV.FromPolygons(bv,[x for x,pi in bt if PC2[pi]==g_]);hits+=sum(len(TG.overlap(t)) for t in TC)
    hits+=sum(len(TP.overlap(t)) for t in TC);r['other']=(hits,0)
    return r
FR=[('lantern_pick_up_stand',f) for f in (10,12,14,16,18,21,24,31,40,44,48)]+[('lantern_put_down_stand',f) for f in (14,16,18,24,30,44,52,56)]
def evalp(d):
    set_drape(d);out=[]
    for c,f in FR:
        P,Wm=pose(c,f);HOLD_ON=0;apply(P,Wm);out.append(m3())
    return out
def cost(res,d):
    BND={'skirt.front':(-30,0),'skirt.front.mid':(-8,0),'skirt.front.low':(-10,15),'skirt.front.low.mid':(-10,10),'side_x':(-20,20),'side_z':(-15,15),'gamma':(1,2)}
    if any(not(BND[k][0]<=v<=BND[k][1]) for k,v in d.items()):return (1e9,0,0)
    TG=float(os.environ.get('TGT','12'));pk=max(max(r[k][0] for k in r if k!='other') for r in res);oh=sum(r['other'][0] for r in res)
    ang=sum(abs(v) for k,v in d.items() if k!='gamma')
    return ang+20*max(0,pk-TG)+float(os.environ.get('OHW','0.5'))*oh,pk,oh
if os.environ.get('SIGN'):
    for b in ('skirt.front','skirt.front.mid','skirt.front.low','skirt.front.low.mid'):
        set_drape({b:30.0});P,Wm=pose('lantern_pick_up_stand',24);apply(P,Wm)
        t=arm.matrix_world@PB[b].tail;set_drape({b:0.0});P,Wm=pose('lantern_pick_up_stand',24);apply(P,Wm);t0=arm.matrix_world@PB[b].tail
        print('SIGN',b,'tail delta (blender, -Y = 前)',[round(x,3) for x in t-t0],flush=True)
    raise SystemExit
d=json.loads(os.environ.get('START','{"skirt.front":0,"skirt.front.mid":0,"skirt.front.low":0,"skirt.front.low.mid":0}'))
t0=time.time();res=evalp(d);best=cost(res,d);print('BASE',d,best,[{k:v[0] for k,v in r.items()} for r in res],round(time.time()-t0,1),flush=True)
for step in json.loads(os.environ.get('STEPS','[16,8,4,2]')):
    improved=True
    while improved:
        improved=False
        for b in list(d):
            for sg in (1,-1):
                d2=dict(d);d2[b]+=sg*(step/8 if b=='gamma' else step)
                c2=cost(evalp(d2),d2)
                if c2[0]<best[0]-1e-3:d,best,improved=d2,c2,True;print('IMP',d,best,flush=True)
print('BEST',json.dumps(d),best,flush=True)
res=evalp(d);print('DETAIL',[(FR[i],{k:v for k,v in r.items()}) for i,r in enumerate(res)],flush=True)
