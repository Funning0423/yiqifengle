#!/usr/bin/env python3
# Voice Bot r4.1: per-step levels from a recording of the game's master output (运镜bot's in-page AudioWorklet tap).
# Read-only on the recording. For every step in <rec>/<clip>/steps.csv (onset_video_t_s, name, vol from the game log):
#   step  = decoded step_<surface>_<n>.mp3 x vol (the game's own play() volume; 运镜bot's fitted gain_in_mix ~= vol),
#           placed at the onset refined by +-5 ms cross-correlation;
#   bed   = mix - step;
#   both measured as ITU-R BS.1770 K-weighted momentary loudness over one 400 ms window from onset-70 ms
#   (the same window as mix_preview.py: centre = step + 0.13 s). underDb = bed - step.
# usage: recording_levels.py <recording-yunjing dir> <A_exit|B_return> <out.json>
import sys,csv,json,subprocess,math,os,numpy as np
from scipy.signal import lfilter
SR=44100
STEPS=os.path.join(os.path.dirname(__file__),'..','..','creator-build-project/assets/bundles/region_island/audio_steps')
def kw(x):
    G_,Q,fc=3.99984385397,0.7071752369554193,1681.9744509555319; K=math.tan(math.pi*fc/SR); Vh=10**(G_/20); Vb=Vh**0.4996667741545416
    a0=1+K/Q+K*K; b=[(Vh+Vb*K/Q+K*K)/a0,2*(K*K-Vh)/a0,(Vh-Vb*K/Q+K*K)/a0]; a=[1,2*(K*K-1)/a0,(1-K/Q+K*K)/a0]; y=lfilter(b,a,x)
    Q2,fc2=0.5003270373253953,38.13547087613982; K=math.tan(math.pi*fc2/SR); a0=1+K/Q2+K*K
    return lfilter([1,-2,1],[1,2*(K*K-1)/a0,(1-K/Q2+K*K)/a0],y)
def M(x): y=kw(x)**2; return -0.691+10*np.log10(y.mean()+1e-20)
def dec(p): return np.frombuffer(subprocess.run(['ffmpeg','-loglevel','error','-i',p,'-vn','-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True,check=True).stdout,np.float32).astype(float)
def file_lufs():
    out={}
    for su in ['wood','rug','stone','path','grass']:
        v=[]
        for i in range(1,5):
            x=dec(os.path.join(STEPS,f'step_{su}_{i}.mp3')); z=np.zeros(int(0.4*SR)); o=int(0.07*SR); z[o:o+len(x)]=x[:len(z)-o]; v.append(round(M(z),1))
        out[su]=v
    return out
if __name__=='__main__':
    rec,clip,outp=sys.argv[1:4]; mix=dec(os.path.join(rec,clip,clip+'.mp4')); out=[]
    for r in csv.DictReader(open(os.path.join(rec,clip,'steps.csv'))):
        x=dec(os.path.join(STEPS,r['name']+'.mp3')); g=float(r['vol']); a=int(round(float(r['onset_video_t_s'])*SR)); best=(0,-1e9)
        for d in range(-220,221,2):
            seg=mix[a+d:a+d+len(x)]; c=np.dot(seg,x)/(np.linalg.norm(x)*np.linalg.norm(seg)+1e-12)
            if c>best[1]: best=(d,c)
        a+=best[0]; w0=a-int(0.07*SR); w1=w0+int(0.4*SR)
        stp=np.zeros(w1-w0); stp[a-w0:a-w0+len(x)]=g*x[:w1-a]; bed=mix[w0:w1]-stp
        out.append({'n':int(r['n']),'t':float(r['t_from_anchor_s']),'state':r['state'],'surface':r['surface'],'name':r['name'],'vol':g,'corr':round(best[1],3),
                    'stepM':round(M(stp),1),'bedM':round(M(bed),1),'underDb':round(M(bed)-M(stp),1)})
    json.dump({'clip':clip,'method':'400 ms K-weighted momentary, window onset-70ms..+330ms, step = file x game vol','fileLUFS':file_lufs(),'steps':out},open(outp,'w'),indent=1)
    for o in out: print(o['n'],o['surface'],o['stepM'],o['bedM'],o['underDb'])
