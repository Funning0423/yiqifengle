import json,sys,numpy as np
def kin(fn):
    F=json.load(open(fn))['frames'];t=np.array([f['t'] for f in F]);P=np.array([f['pos'] for f in F]);R=np.array([f['root'] for f in F])
    dt=np.gradient(t);V=np.gradient(P,t,axis=0);A=np.gradient(V,t,axis=0);J=np.gradient(A,t,axis=0)
    return dict(t=t,P=P,R=R,V=V,A=A,J=J,F=F)
if __name__=='__main__':
  for fn in sys.argv[1:]:
    k=kin(fn);sp=np.linalg.norm(k['V'],axis=1);a=np.linalg.norm(k['A'],axis=1);j=np.linalg.norm(k['J'],axis=1)
    print(fn,'T',k['t'][-1],'maxspeed %.2f maxacc %.2f maxjerk %.1f maxvy %.2f'%(sp.max(),a.max(),j.max(),k['V'][:,1].max()))
    for i in range(0,len(sp),30): print('%.2f sp %.2f a %.2f j %.1f y %.2f vy %.2f'%(k['t'][i],sp[i],a[i],j[i],k['P'][i,1],k['V'][i,1]))
