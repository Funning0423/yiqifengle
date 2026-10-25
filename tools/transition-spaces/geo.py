import json,numpy as np
def load(p):
    d=json.load(open(p));return {k:np.array(v).reshape(-1,3,3) for k,v in d.items()}
def cat(d,keys=None):
    T=[v for k,v in d.items() if keys is None or any(s in k for s in keys)];return np.concatenate(T) if T else np.zeros((0,3,3))
def heights(T,x,z):
    """all surface y values at (x,z) (barycentric)"""
    a,b,c=T[:,0],T[:,1],T[:,2]
    m=(np.minimum(np.minimum(a[:,0],b[:,0]),c[:,0])<=x)&(np.maximum(np.maximum(a[:,0],b[:,0]),c[:,0])>=x)&(np.minimum(np.minimum(a[:,2],b[:,2]),c[:,2])<=z)&(np.maximum(np.maximum(a[:,2],b[:,2]),c[:,2])>=z)
    out=[]
    for A,B,C in T[m]:
        v0=C-A;v1=B-A;d00=v0[0]*v0[0]+v0[2]*v0[2];d01=v0[0]*v1[0]+v0[2]*v1[2];d11=v1[0]*v1[0]+v1[2]*v1[2]
        den=d00*d11-d01*d01
        if abs(den)<1e-12:continue
        px,pz=x-A[0],z-A[2];d20=px*v0[0]+pz*v0[2];d21=px*v1[0]+pz*v1[2]
        u=(d11*d20-d01*d21)/den;v=(d00*d21-d01*d20)/den
        if u>=-1e-6 and v>=-1e-6 and u+v<=1+1e-6:out.append(A[1]+u*v0[1]+v*v1[1])
    return sorted(out)
def floor(T,x,z,ref,up=0.45):
    h=[y for y in heights(T,x,z) if y<=ref+up];return max(h) if h else None
def body_hits(T,p,r=0.17,lo=0.2,hi=1.5):
    """triangles intersecting her body column (square r) from foot+lo to foot+hi; returns count and names."""
    x,y,z=p;mn=np.array([x-r,y+lo,z-r]);mx=np.array([x+r,y+hi,z+r])
    tmin=T.min(1);tmax=T.max(1);m=np.all(tmin<=mx,1)&np.all(tmax>=mn,1)
    # refine: sample-test triangle against box by clipping points (conservative via SAT on box axes + tri normal)
    hits=0
    for t in T[m]:
        c=(mn+mx)/2;h=(mx-mn)/2;v=t-c;n=np.cross(v[1]-v[0],v[2]-v[0])
        if np.linalg.norm(n)<1e-12:continue
        if abs(np.dot(n,v[0]))>np.dot(h,np.abs(n)):continue
        ok=True
        e=[v[1]-v[0],v[2]-v[1],v[0]-v[2]]
        for ei in e:
            for ax in np.eye(3):
                a=np.cross(ax,ei)
                if np.linalg.norm(a)<1e-12:continue
                pr=v@a;rad=np.dot(h,np.abs(a))
                if pr.min()>rad or pr.max()<-rad:ok=False;break
            if not ok:break
        if ok:hits+=1
    return hits
