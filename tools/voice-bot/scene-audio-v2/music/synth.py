import numpy as np,sys
sys.path.insert(0,'/workspace/v2amb')
from lib import *
from scipy.signal import lfilter
MAJ=[0,2,4,5,7,9,11]
def deg(tonic,d,octv=0):
    d0=d-1;o=d0//7;return tonic*2**((MAJ[d0%7]+12*(o+octv))/12)
def adsr(n,a,r,sr=SR):
    e=np.ones(n);na=max(1,int(a*sr));nr=max(1,int(r*sr));e[:na]=np.linspace(0,1,na)**1.5
    e[-nr:]*=np.linspace(1,0,nr)**2;return e
rng=np.random.default_rng(7)
def pluck(f,dur,bright=3000,decay=1.5,tail=1.5):
    n=int((dur+tail)*SR);D=max(2,int(round(SR/f)))
    exc=np.zeros(n);burst=rng.standard_normal(D);burst=lp(burst[:,None],bright,2)[:,0] if D>12 else burst;exc[:D]=burst
    g=np.exp(-D/(decay*SR))
    a=np.zeros(D+2);a[0]=1;a[D]=-g/2;a[D+1]=-g/2
    y=lfilter([1],a,exc);y*=adsr(n,0.002,0.25);return y/ (np.abs(y).max()+1e-9)
def additive(f,dur,amps,att,rel,vib=0,trem=0,tail=0.3,decay=None,inh=0.0):
    n=int((dur+tail)*SR);t=np.arange(n)/SR;y=np.zeros(n)
    ph=2*np.pi*f*t
    if vib: ph=ph+ (vib*f/5.0)*np.sin(2*np.pi*5.0*t)*np.minimum(1,t/0.4)*2*np.pi/ (2*np.pi)
    for k,a in enumerate(amps,1):
        if f*k>9000:break
        kk=k*np.sqrt(1+inh*k*k);env=np.exp(-t/(decay/(1+0.35*(k-1)))) if decay else 1
        y+=a*np.sin(kk*ph)*env
    e=adsr(n,att,rel);y*=e
    if trem:y*=1-trem*0.5*(1+np.sin(2*np.pi*5.5*t))
    return y/(np.abs(y).max()+1e-9)
def piano(f,dur,v=1):
    return additive(f,dur,[1/k**1.4 for k in range(1,11)],0.003,0.35,tail=1.8,decay=2.6*(220/f)**0.35,inh=0.0004)
def harp(f,dur): return pluck(f,dur,bright=1800,decay=2.2,tail=2.0)*0.9
def guitar(f,dur): return pluck(f,dur,bright=2600,decay=1.6,tail=1.5)
def uke(f,dur): return pluck(f,dur,bright=3400,decay=0.7,tail=0.8)
def flute(f,dur):
    y=additive(f,dur,[1,.22,.08,.03],0.07,0.18,vib=0.004,tail=0.25)
    n=len(y);br=rng.standard_normal(n);br=lp(hp(br[:,None],f*0.8,2),f*3,2)[:,0];br/= (np.abs(br).max()+1e-9)
    return y+0.035*br*adsr(n,0.07,0.18)
def reed(f,dur):  # soft harmonica-like
    y=additive(f,dur,[1/k**1.1 for k in range(1,9)],0.05,0.15,trem=0.08,vib=0.003,tail=0.2)
    return lp(y[:,None],2400,2)[:,0]
def strings(f,dur):
    y=sum(additive(f*2**(c/1200),dur,[1/k for k in range(1,13)],0.9,1.0,tail=1.0) for c in (-7,0,7))
    return lp(y[:,None],2000,2)[:,0]/3
def bass(f,dur): return additive(f,dur,[1,.35,.1],0.06,0.4,tail=0.8,decay=1.8)
class Score:
    def __init__(s,N): s.N=N;s.buf=np.zeros((N,2))
    def add(s,t0,y,vol,pan=0.0):
        th=(pan+1)*np.pi/4;idx=(int(t0*SR)+np.arange(len(y)))%s.N
        np.add.at(s.buf,idx,np.stack([y*np.cos(th),y*np.sin(th)],1)*vol)
def circ_reverb(x,wet_db,rt,lpf=3500,pre=0.03):
    h=ir(rt,lpf=lpf,pre=pre);N=len(x);y=np.zeros_like(x)
    for c in range(2): y[:,c]=np.fft.irfft(np.fft.rfft(x[:,c])*np.fft.rfft(h[:,c],N),N)
    return x+y*10**(wet_db/20)
def master(x,target=-17.0):
    x3=np.vstack([x,x,x]);x3=hp(x3,40,2);x3=deharsh(x3,-1.5);x3=lp(x3,10000,2);x=x3[len(x):2*len(x)]
    return norm_to(x,target,tp_max=-1.5)
