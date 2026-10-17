# Offline numpy port of resources/world/glass-sign.effect (运镜bot). Premultiplied sRGB output, same math per pixel.
import numpy as np
C=np.array([140.,50.])
def sdcap(px,py,hx,hy,r):
    qx=np.abs(px-140)-hx+r; qy=np.abs(py-50)-hy+r
    return np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)-r
def phi(x): return 1/(1+np.exp(1.702*x))
def over(top,under): return top+under*(1-top[...,3:4])
def topline(qx,qy):
    R=47.8; out=np.empty_like(qx)
    mid=(qx>=50)&(qx<=230); out[mid]=(np.abs(qy-2.2)+np.maximum(qy-50,0)*4)[mid]
    for left in (True,False):
        m=(qx<50) if left else (qx>230)
        cx=50. if left else 230.; vx=qx-cx; vy=qy-50; a=np.arctan2(vy,vx)
        lo=-np.pi+0.15707963 if left else -1.5707963; hi=-1.5707963 if left else -0.15707963
        if left: a=np.where(a>0,-np.pi,a)
        a=np.clip(a,lo,hi); d=np.hypot(qx-(cx+R*np.cos(a)),qy-(50+R*np.sin(a))); out[m]=d[m]
    return out
def render(H,W,box,params,dpr=2.0):
    """box=(l,t,r,b) device px (y down). params: dict p0,p1,p2,(p3,p4 night). Returns HxWx4 premult."""
    ys,xs=np.mgrid[0:H,0:W].astype(float)+0.5
    if len(box)==4:
        l,t,r,b=box; px=(xs-l)/(r-l)*280; py=(ys-t)/(b-t)*100
    else:  # affine: (cx,cy,ux,uy,vx,vy) = centre and full card axes in device px
        cx,cy,ux,uy,vx,vy=box; M=np.linalg.inv(np.array([[ux,vx],[uy,vy]]))
        dx=xs-cx; dy=ys-cy; px=(M[0,0]*dx+M[0,1]*dy+0.5)*280; py=(M[1,0]*dx+M[1,1]*dy+0.5)*100
    p0,p1,p2=params['p0'],params['p1'],params['p2']; p3=params.get('p3',(1,1,1,0)); p4=params.get('p4',(1,1,1,1))
    sc=p1[0]; qx=140+(px-140)/sc; qy=50+(py-50)/sc
    dq=sdcap(qx,qy,140,50,50); d0=sdcap(px,py,140,50,50)
    gy_,gx_=np.gradient(dq); g=np.maximum(np.hypot(gx_,gy_),1e-4)
    gy0,gx0=np.gradient(d0); g0=np.maximum(np.hypot(gx0,gy0),1e-4)
    w=(np.abs(gx_)+np.abs(gy_))*0.75
    col=np.zeros((H,W,4))
    ds=sdcap(px,py-10,140,50,50); sh=0.22*phi(ds/12)*np.clip(d0/g0+0.5,0,1)
    col=over(np.stack([0*sh,0*sh,0*sh,sh],-1),col)
    def smooth(e0,e1,x): tt=np.clip((x-e0)/(e1-e0),0,1); return tt*tt*(3-2*tt)
    cover=1-smooth(-w,w,dq)
    tt=np.clip(((qx-140)*0.34202+(qy-50)*0.93969)/189.76+0.5,0,1)
    fa=np.where(tt<0.55,0.34+(0.10-0.34)*(tt/0.55),0.10+(0.18-0.10)*((tt-0.55)/0.45))+0.08
    glow=0.12*(1-phi(sdcap(qx,qy+6,140,50,50)/7))
    ca=(fa+glow*(1-fa))*cover
    nw=p2[1]; k=1+(p3[0]-1)*nw; ca=ca*k
    tint=np.array([1+(p4[i]-1)*nw for i in range(3)])
    col=over(np.concatenate([ca[...,None]*tint,ca[...,None]],-1),col)
    rd=np.abs(dq+0.75)/g; rim=p0[0]*np.clip(p0[2]*0.5+0.5-rd,0,1)*(1+(p3[1]-1)*nw)
    td=topline(qx,qy)/g; u=np.clip((qx-2.79)/274.42,0,1); fade=np.minimum(np.minimum(u/0.15,(1-u)/0.15),1)
    top=0.8*fade*np.clip(p0[1]*0.5+0.5-td,0,1)*(1+(p3[2]-1)*nw)
    rc=np.array([1+(p4[3]-1)*nw*0+ (0) for _ in range(3)])
    rimtint=np.array([1.0,1+(params.get('rimTint',(1,1,1))[1]-1)*nw,1+(params.get('rimTint',(1,1,1))[2]-1)*nw])
    col=over(np.concatenate([rim[...,None]*rimtint,rim[...,None]],-1),col)
    col=over(np.stack([top,top,top,top],-1),col)
    return col*p0[3]
