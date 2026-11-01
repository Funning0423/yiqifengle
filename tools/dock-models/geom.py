"""b19 dock models: tiny procedural low-poly kit (pure numpy). Coordinates are Cocos/glTF (+Y up, metres).
Every part is (V[n,3], F[m,3] int, UV[n,2]) with flat-shaded (unshared) vertices so the palette cell can change per face.
Palette pickers return a UV point (or a small UV rect for grain cells)."""
import numpy as np,math
class Mesh:
    def __init__(s):s.V=[];s.UV=[];s.F=[]
    def tri(s,a,b,c,ua,ub=None,uc=None):
        n=len(s.V);s.V+= [a,b,c];s.UV+=[ua,ub if ub is not None else ua,uc if uc is not None else ua];s.F.append([n,n+1,n+2])
    def quad(s,a,b,c,d,uv):  # a b c d counter-clockwise seen from outside; uv = point or 4 points
        if np.ndim(uv)==1:uv=[uv]*4
        s.tri(a,b,c,uv[0],uv[1],uv[2]);s.tri(a,c,d,uv[0],uv[2],uv[3])
    def add(s,o):
        n=len(s.V);s.V+=o.V;s.UV+=o.UV;s.F+=[[a+n,b+n,c+n] for a,b,c in o.F]
    def arrays(s):return np.array(s.V,float),np.array(s.F,int),np.array(s.UV,float)
    def ntris(s):return len(s.F)
def rotY(deg,p):c,s_=math.cos(math.radians(deg)),math.sin(math.radians(deg));p=np.asarray(p,float);return np.array([c*p[0]+s_*p[2],p[1],-s_*p[0]+c*p[2]])
def frame(axis):
    a=np.asarray(axis,float);a=a/np.linalg.norm(a);t=np.array([0,1,0.]) if abs(a[1])<.9 else np.array([1,0,0.]);u=np.cross(a,t);u/=np.linalg.norm(u);v=np.cross(a,u);return a,u,v
def box(m,c,size,yaw=0.0,uv_top=None,uv_side=None,uv_end=None,bottom=False,pitch=0.0,roll=0.0):
    """oriented box: centre c, size (sx,sy,sz) along local x/y/z, yaw about Y (deg), then pitch about local x, roll about local z."""
    sx,sy,sz=[v/2 for v in size];P=[]
    for x,y,z in [(-sx,-sy,-sz),(sx,-sy,-sz),(sx,sy,-sz),(-sx,sy,-sz),(-sx,-sy,sz),(sx,-sy,sz),(sx,sy,sz),(-sx,sy,sz)]:
        p=np.array([x,y,z],float)
        if roll:cr,sr=math.cos(math.radians(roll)),math.sin(math.radians(roll));p=np.array([cr*p[0]-sr*p[1],sr*p[0]+cr*p[1],p[2]])
        if pitch:cp,sp=math.cos(math.radians(pitch)),math.sin(math.radians(pitch));p=np.array([p[0],cp*p[1]-sp*p[2],sp*p[1]+cp*p[2]])
        P.append(rotY(yaw,p)+np.asarray(c,float))
    ut=uv_top;us=uv_side if uv_side is not None else ut;ue=uv_end if uv_end is not None else us
    m.quad(P[3],P[7],P[6],P[2],ut)            # top (+y)
    m.quad(P[4],P[5],P[6],P[7],us);m.quad(P[1],P[0],P[3],P[2],us)  # +z / -z
    m.quad(P[0],P[4],P[7],P[3],ue);m.quad(P[5],P[1],P[2],P[6],ue)  # -x / +x
    if bottom:m.quad(P[0],P[1],P[5],P[4],us)
    return P
def prism(m,a,b,r,n=6,uvs=None,cap_a=False,cap_b=True,twist=0.0,r_b=None):
    """n-gon prism from a to b (radius r, r_b at b). uvs: one UV for the sides (or callable(t0,t1)->uv)."""
    a=np.asarray(a,float);b=np.asarray(b,float);ax,u,v=frame(b-a);rb=r if r_b is None else r_b
    ring=lambda c,rr:[c+rr*(math.cos(2*math.pi*k/n+twist)*u+math.sin(2*math.pi*k/n+twist)*v) for k in range(n)]
    A=ring(a,r);B=ring(b,rb)
    for k in range(n):
        k2=(k+1)%n;m.quad(A[k],A[k2],B[k2],B[k],uvs)
    if cap_b:
        for k in range(1,n-1):m.tri(B[0],B[k],B[k+1],uvs)
    if cap_a:
        for k in range(1,n-1):m.tri(A[0],A[k+1],A[k],uvs)
def tube(m,pts,r,n=4,uvs=None,caps=False):
    """rope / cable: n-sided tube along a polyline (parallel-transported rings)."""
    pts=[np.asarray(p,float) for p in pts];rings=[]
    _,u,v=frame(pts[1]-pts[0])
    for i,p in enumerate(pts):
        t=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]);t/=np.linalg.norm(t);u=u-np.dot(u,t)*t;u/=np.linalg.norm(u);v=np.cross(t,u)
        rings.append([p+r*(math.cos(2*math.pi*k/n+math.pi/n)*u+math.sin(2*math.pi*k/n+math.pi/n)*v) for k in range(n)])
    for i in range(len(rings)-1):
        for k in range(n):k2=(k+1)%n;m.quad(rings[i][k],rings[i][k2],rings[i+1][k2],rings[i+1][k],uvs)
    if caps:
        for R in (rings[0],rings[-1][::-1]):
            for k in range(1,n-1):m.tri(R[0],R[k+1],R[k],uvs)
def catenary(a,b,sag,n=8):
    a=np.asarray(a,float);b=np.asarray(b,float);return [a+(b-a)*t+np.array([0,-4*sag*t*(1-t),0]) for t in np.linspace(0,1,n+1)]
def rock(m,c,r,h,uvs,n=6,seed=0,yaw=0):
    rng=np.random.default_rng(seed);c=np.asarray(c,float)
    base=[c+rotY(yaw+360*k/n,[r*(0.8+0.35*rng.random()),0,0]) for k in range(n)]
    mid=[c+rotY(yaw+360*(k+.5)/n,[r*(0.55+0.25*rng.random()),h*(0.55+0.2*rng.random()),0]) for k in range(n)]
    top=c+np.array([rng.normal()*r*.1,h,rng.normal()*r*.1])
    for k in range(n):
        k2=(k+1)%n;m.tri(base[k],mid[k],base[k2],uvs);m.tri(base[k2],mid[k],mid[k2],uvs);m.tri(mid[k],top,mid[k2],uvs)
def coil(m,c,r_out,r_rope,turns=2,n=8,uvs=None,y_step=None):
    """flat rope coil lying on a surface / wrapped on a post (centre c, axis +Y)."""
    pts=[];ys=y_step if y_step is not None else r_rope*1.7
    for k in range(int(n*turns)+1):
        a=2*math.pi*k/n;rr=r_out-(0 if y_step else r_rope*1.8*k/n);pts.append(np.asarray(c,float)+np.array([rr*math.cos(a),ys*k/n if y_step else 0,rr*math.sin(a)]))
    tube(m,pts,r_rope,4,uvs)
