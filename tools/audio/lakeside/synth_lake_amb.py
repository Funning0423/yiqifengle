#!/usr/bin/env python3
"""Lakeside ambience: gentle lake water + soft wind + sparse pentatonic wind chimes. Fully synthesized (numpy), deterministic.
Circular construction: every layer is periodic in N samples (FFT-shaped noise, periodic envelopes, chime tails wrapped), so
the loop is seamless by construction. The file then carries a TAIL_S duplicate of its own start so a two-source cross-loop
(start partner at duration - MP3_PADDING_S - LOOP_XFADE_S) overlaps identical audio."""
import numpy as np, sys, json, subprocess, os
SR=24000; LOOP_S=19.0; N=int(SR*LOOP_S); TAIL_S=0.15; SEED=20261017
rng=np.random.default_rng(SEED); t=np.arange(N)/SR
def shaped_noise(lo,hi,tilt):
    X=np.fft.rfft(rng.standard_normal(N)); f=np.fft.rfftfreq(N,1/SR)
    g=np.where((f>lo)&(f<hi),1.0,0.0)*(np.maximum(f,1)/1000.0)**tilt
    g*=np.clip((f-lo)/(0.3*lo+1),0,1)*np.clip((hi-f)/(0.3*hi),0,1)
    y=np.fft.irfft(X*g,N); return y/np.std(y)
def periodic_env(parts):  # sum of sinusoids with integer cycles per loop -> exactly periodic
    e=np.zeros(N)
    for k,a in parts: e+=a*np.sin(2*np.pi*k*t/LOOP_S+rng.uniform(0,2*np.pi))
    return e
# lake lapping: low noise, slow irregular swells (cycles 5,7,9,11 per loop ~2-4.6 s laps)
lap=shaped_noise(80,1400,-1.0)
lapenv=np.clip(0.55+periodic_env([(5,.25),(7,.18),(9,.12),(13,.08)]),0.15,None)**1.6
water=lap*lapenv*0.55
# small water plips (deterministic, wrapped)
plip=np.zeros(N)
for _ in range(26):
    s=rng.integers(0,N); f0=rng.uniform(700,1500); d=rng.uniform(.03,.07); n=int(d*SR); tt=np.arange(n)/SR
    w=np.sin(2*np.pi*(f0*tt+ f0*1.8*tt*tt/d))*np.exp(-tt/(d/4))*rng.uniform(.04,.1)
    idx=(s+np.arange(n))%N; plip[idx]+=w
# soft wind: band noise with very slow swell (2,3 cycles)
wind=shaped_noise(250,3000,-0.6)*np.clip(0.5+periodic_env([(2,.3),(3,.15)]),0.1,None)*0.18
# chimes: C major pentatonic C6..A6 (+ E7/G6 low weight), tubular-chime partials, exp decay. Strikes in small gust clusters,
# kept clear of the loop seam (first 0.6 s / last 4.0 s) so no fresh strike sits on the boundary; tails wrap circularly.
notes=[1046.5,1174.7,1318.5,1568.0,1760.0,2093.0]
partials=[(1.0,1.0,1.0),(2.76,.35,.55),(5.40,.12,.3),(8.93,.04,.18)]
chime=np.zeros(N); strikes=[]
gusts=[1.6,5.8,9.9,13.6]
for g in gusts:
    for j in range(rng.integers(2,5)):
        at=g+j*rng.uniform(.18,.55)+rng.uniform(0,.08)
        if at<0.6 or at>LOOP_S-4.0: continue
        nf=notes[rng.integers(0,len(notes))]; amp=rng.uniform(.05,.11); dec=rng.uniform(2.0,3.2)
        n=int(SR*dec*2.2); tt=np.arange(n)/SR; w=np.zeros(n)
        for r,a,dk in partials:
            fr=nf*r
            if fr>SR*0.45: continue
            w+=a*np.sin(2*np.pi*fr*tt+rng.uniform(0,6.28))*np.exp(-tt/(dec*dk))
        w*=np.minimum(1,tt/0.002)*amp
        idx=(int(at*SR)+np.arange(n))%N; chime[idx]+=w; strikes.append({'t':round(at,3),'hz':nf,'amp':round(amp,3)})
x=water+plip+wind+chime
# loudness target (EBU R128 via ffmpeg loudnorm measurement), linear gain only
TARGET=float(os.environ.get('LAKE_LUFS','-22'))
def write_wav(path,y):
    import wave; y16=np.clip(y*32767,-32768,32767).astype('<i2')
    with wave.open(path,'wb') as w: w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(y16.tobytes())
x/=np.max(np.abs(x))*1.6
write_wav('/tmp/amb/_m.wav',np.tile(x,2))
out=subprocess.run(['ffmpeg','-nostats','-i','/tmp/amb/_m.wav','-af','ebur128','-f','null','-'],capture_output=True,text=True).stderr
I=float([l for l in out.splitlines() if l.strip().startswith('I:')][-1].split()[1])
x*=10**((TARGET-I)/20)
assert np.max(np.abs(x))<0.89,'peak'
full=np.concatenate([x,x[:int(TAIL_S*SR)]])
write_wav('/tmp/amb/lake_amb_circ.wav',x); write_wav('/tmp/amb/lake_amb_file.wav',full)
json.dump({'sr':SR,'loopS':LOOP_S,'tailS':TAIL_S,'seed':SEED,'strikes':strikes,'peak':float(np.max(np.abs(x))),'measuredPreGainLUFS':I,'targetLUFS':TARGET},open('/tmp/amb/synth_meta.json','w'),indent=1)
print('ok',len(strikes),'strikes; peak',round(float(np.max(np.abs(x))),3))
