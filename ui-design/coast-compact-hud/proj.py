import math
th=math.radians(63.148); t=math.tan(math.radians(25))
def proj(w,h,D,x,y,z):
    f=(0,-math.sin(th),-math.cos(th)); C=(0,D*math.sin(th),-0.05+D*math.cos(th)); u=(0,math.cos(th),-math.sin(th))
    v=(x-C[0],y-C[1],z-C[2]); dep=sum(a*b for a,b in zip(v,f)); ys=sum(a*b for a,b in zip(v,u))
    s=(h/2)/t; return (w/2+x/dep*s, h/2-ys/dep*s)
def farcell(w,h,D):
    # far row cell: z from -3.5 to -2.5 at slab top y .12 ; width at centre
    a=proj(w,h,D,0,.12,-3.5)[1]; b=proj(w,h,D,0,.12,-2.5)[1]
    xl=proj(w,h,D,-.5,.12,-3)[0]; xr=proj(w,h,D,.5,.12,-3)[0]; return b-a, xr-xl
def rimtop(w,h,D): return proj(w,h,D,0,0.15+0.0,-3.95)[1]
def piecetop(w,h,D): return proj(w,h,D,0,0.11+0.6,-3.0)[1]  # rough piece top in far row
def rimbot(w,h,D): return proj(w,h,D,0,0.15,3.95)[1]
if __name__=='__main__':
    print(proj(320,568,19.387,-3,.1,-3),proj(320,568,19.387,0,.1,3),proj(390,520,18.1335,0,.1,-3))
