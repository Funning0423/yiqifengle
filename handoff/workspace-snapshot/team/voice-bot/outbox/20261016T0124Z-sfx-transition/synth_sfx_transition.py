# 自制原创 — sfx_transition_island_to_meadow, numpy only. seed fixed.
import numpy as np, json, sys
SR=44100; FPS=30; N=int(round(5.2*SR)); t=np.arange(N)/SR
rng=np.random.default_rng(20261015)
def f2s(f): return f/FPS
def lp(x,a):  # one-pole lowpass, a in (0,1) per-sample (array or scalar)
    a=np.broadcast_to(a,x.shape); y=np.empty_like(x); s=0.0
    for i in range(len(x)): s+=a[i]*(x[i]-s); y[i]=s
    return y
def coef(fc): return 1-np.exp(-2*np.pi*np.asarray(fc)/SR)
def env(points):
    xs,ys=zip(*points); return np.interp(t,xs,ys)
def smooth(e,ms=30): k=int(SR*ms/1000); return np.convolve(e,np.ones(k)/k,'same')
w=rng.standard_normal(N)
# body wind: bandpassed noise with moving cutoff (rises toward cover)
fc=env([(0,500),(f2s(66),700),(f2s(78),2200),(f2s(84),2400),(f2s(96),900),(5.2,600)])
lo=lp(w,coef(fc)); body=lo-lp(lo,coef(120))
gust=1+0.25*np.sin(2*np.pi*0.7*t)+0.15*np.sin(2*np.pi*1.3*t+1)
body*=smooth(env([(0,0.30),(0.4,0.42),(f2s(66),0.45),(f2s(78),1.0),(f2s(84),1.0),(f2s(96),0.42),(4.0,0.33),(5.2,0.30)]),40)*gust
# airy whoosh: high band, peaks under full cover
hi=w-lp(w,coef(env([(0,2500),(f2s(78),3500),(f2s(96),5000),(5.2,5000)])))
hi=lp(hi,coef(9000))
whoosh=hi*smooth(env([(0,0),(f2s(66),0.02),(f2s(78),0.55),(f2s(84),0.55),(f2s(96),0.05),(5.2,0)]),20)
# sail flap + creak near set-sail (frame 12)
flap=np.zeros(N)
for st,amp in [(0.42,1.0),(0.58,0.6),(0.71,0.35)]:
    i=int(st*SR); L=int(0.09*SR); n=lp(rng.standard_normal(L),coef(1400))
    flap[i:i+L]+=amp*n*np.exp(-np.arange(L)/SR/0.025)
flap*=0.9
ct=t-0.30; cm=(ct>0)&(ct<0.35)
creak=np.zeros(N); ph=2*np.pi*np.cumsum(np.where(cm,180+60*np.sin(2*np.pi*3*ct),0))/SR
pulses=(np.sin(2*np.pi*38*ct)>0.85).astype(float)
creak[cm]=(np.sin(ph)*pulses*np.sin(np.pi*ct/0.35))[cm]*0.12
# shimmer as meadow is revealed (frames 84-110)
sh=np.zeros(N)
for k,f in enumerate([1568,1976,2349,2637,3136]):
    s0=f2s(84)+k*0.07; m=t>=s0; tau=t-s0
    sh+=np.where(m,np.sin(2*np.pi*f*tau)*np.exp(-tau/0.6)*(1-np.exp(-tau/0.02)),0)*0.05
x=body+whoosh+flap+creak+sh
# tail: settle to steady breeze for blending into amb_wind loop; tiny 5 ms edge ramps (no leading silence)
r=int(0.005*SR); x[:r]*=np.linspace(0,1,r); x[-r:]*=np.linspace(1,0.3,r)
np.save(sys.argv[1],x.astype(np.float32))
