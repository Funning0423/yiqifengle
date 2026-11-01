# Voice Bot: offline preview of the exit (leaveHome t=0 .. island settle) at in-game levels, and a loudness check.
# usage: python3 mix_preview.py align.json outdir
#   align.json = footstep_align.cjs --json (60 fps sim: flow states, wind strength, room-light weight, steps with surfaces).
# Layers (game formulas, see GameAudio / WindAudio / AmbienceAudio):
#   BGM bgm_main x musicVolume 0.4 x wind duck (-4 dB x smoothstep(0.2,1,s), tau 0.5 s); s = wind smoothed tau 0.25 s
#   wind soft/strong loops x softGain(s) / strongGain(s) (bed = slider/0.4 = 1)
#   waves loop x max(0.55*(1-roomLight), 0.35*smoothstep(0.1,0.6,s)) x (1-0.25*smoothstep(0.3,1,s)), smoothed (4/s)
#   exit track sfx_exit_outbound (NEW, no baked steps) x 1 from 'crossing-out'
#   steps: the files GameAudio plays (variant picker: no immediate repeat), at stepBaseVolume = STEP_GAIN x outdoor variant
#   trim x outdoor wind lift (align.json "levels"), jitter +-1.5 dB in / +-0.75 dB out, fired at the step times
#   of the simulation. Not included: random/exit gulls (they sit above the bed anyway), UI clicks.
# Writes exit_preview_mix.wav/.mp3, exit_preview_steps_only.wav, exit_preview_spectrogram.png, loudness.json/.md.
import sys,os,json,subprocess,numpy as np
from scipy.signal import lfilter
A=json.load(open(sys.argv[1])); OUT=sys.argv[2]; os.makedirs(OUT,exist_ok=True)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..')); AS=os.path.join(ROOT,'creator-build-project/assets')
SR=44100
def dec(p): return np.frombuffer(subprocess.run(['ffmpeg','-loglevel','error','-i',p,'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True,check=True).stdout,np.float32).astype(np.float64)
fr=A['frames']; T0=0.0; T1=fr[-1]['t']+1.0; N=int(T1*SR); t=np.arange(N)/SR
ft=np.array([f['t'] for f in fr]); wind=np.interp(t,ft,[f['wind'] for f in fr]); rl=np.interp(t,ft,[f['roomLight'] for f in fr])
def smooth(x,tau=None,rate=None):
    y=np.zeros_like(x); v=0.0; dt=1/SR
    k=1-np.exp(-dt/tau) if tau else 1-np.exp(-dt*rate)
    for i in range(0,len(x),64):
        v+= (x[i]-v)*(1-(1-k)**64); y[i:i+64]=v
    return y
ss=lambda a,b,x: (lambda u: u*u*(3-2*u))(np.clip((x-a)/(b-a),0,1))
s=smooth(wind,tau=0.25)
loop=lambda x: np.resize(x,N)
bgm=loop(dec(os.path.join(AS,'bundles/audio_bgm_island/audio/bgm_main.mp3')))*0.4*10**(-4*smooth(ss(0.2,1,s),tau=0.5)/20)
soft=loop(dec(os.path.join(AS,'resources/audio_amb/amb_wind_soft_loop.mp3')))*np.minimum(1,s/0.08)*(0.35+0.40*s)
strong=loop(dec(os.path.join(AS,'resources/audio_amb/amb_wind_strong_loop.mp3')))*ss(0.3,1,s)
wv=np.maximum(0.55*(1-rl),0.35*ss(0.1,0.6,wind))*(1-0.25*ss(0.3,1,wind)); waves=loop(dec(os.path.join(AS,'resources/audio_amb/amb_waves_loop.mp3')))*smooth(wv,rate=4)
exit_=np.zeros(N); ch=[c for c in A['changes'] if c['state']=='crossing-out']; xt=dec(os.path.join(AS,'bundles/region_island/audio_cine/sfx_exit_outbound.mp3'))
if ch: a=int(ch[0]['t']*SR); exit_[a:a+len(xt)]=xt[:N-a]
G=A['gains']; rng=np.random.default_rng(17); last={}; steps=np.zeros(N); placed=[]
for r in A['rows']:
    if r['stepT'] is None: continue
    su=r['surface']; prev=last.get(su); i=int(rng.random()*(4 if prev is None else 3)); i+= 1 if prev is not None and i>=prev else 0; last[su]=i
    LV=A.get('levels') or {'indoor':['wood','rug'],'jitterIn':1.5,'jitterOut':1.5,'trim':{},'windLift':{'from':0.4,'to':0.8,'db':0}}
    indoor=su in LV['indoor']; wl=LV['windLift']; ws=float(np.interp(r['stepT'],ft,[f['wind'] for f in fr]))
    lift=0 if indoor else wl['db']*ss(wl['from'],wl['to'],ws); trim=0 if indoor else (LV['trim'].get(su) or [0,0,0,0])[i]
    g=G[su]*10**((trim+lift+(rng.random()*2-1)*(LV['jitterIn'] if indoor else LV['jitterOut']))/20); x=dec(os.path.join(AS,f'bundles/region_island/audio_steps/step_{su}_{i+1}.mp3'))*g
    a=int(r['stepT']*SR); steps[a:a+len(x)]+=x[:max(0,N-a)]; placed.append({'t':r['stepT'],'surface':su,'file':f'step_{su}_{i+1}','gain':round(g,3),'wind':round(ws,2),'state':r['state']})
bed=bgm+soft+strong+waves+exit_; mix=bed+steps
# --- ITU-R BS.1770 K-weighting (pyloudnorm coefficients re-derived for SR) + momentary 400 ms
def kw(x):
    import math
    G_,Q,fc=3.99984385397,0.7071752369554193,1681.9744509555319; K=math.tan(math.pi*fc/SR); Vh=10**(G_/20); Vb=Vh**0.4996667741545416
    a0=1+K/Q+K*K; b=[(Vh+Vb*K/Q+K*K)/a0,2*(K*K-Vh)/a0,(Vh-Vb*K/Q+K*K)/a0]; a=[1,2*(K*K-1)/a0,(1-K/Q+K*K)/a0]; y=lfilter(b,a,x)
    Q2,fc2=0.5003270373253953,38.13547087613982; K=math.tan(math.pi*fc2/SR); a0=1+K/Q2+K*K
    return lfilter([1,-2,1],[1,2*(K*K-1)/a0,(1-K/Q2+K*K)/a0],y)
def momentary(x):
    y=kw(x)**2; w=int(0.4*SR); c=np.r_[0,np.cumsum(y)]; hop=int(0.01*SR); idx=np.arange(w,len(y),hop)
    return idx/SR-0.2,-0.691+10*np.log10((c[idx]-c[idx-w])/w+1e-20)
def integrated(x):
    tt,m=momentary(x); m=m[m>-70]; g=-0.691+10*np.log10(np.mean(10**((m+0.691)/10))); m2=m[m>g-10]; return float(-0.691+10*np.log10(np.mean(10**((m2+0.691)/10))))
tb,mb=momentary(bed); tsx,ms=momentary(steps); tm,mm=momentary(mix)
per=[]
for p in placed:
    j=np.searchsorted(tsx,p['t']+0.13); per.append({**p,'stepM':round(float(ms[j]),1),'bedM':round(float(mb[j]),1),'stepUnderBedDb':round(float(mb[j]-ms[j]),1)})
def zone(fn): v=[x['stepUnderBedDb'] for x in per if fn(x)]; return {'n':len(v),'minDb':min(v) if v else None,'meanDb':round(float(np.mean(v)),1) if v else None}
peak=lambda x: round(float(20*np.log10(np.abs(x).max()+1e-12)),1)
rep={'stepsPlaced':len(placed),'integratedLUFS':{'mix':round(integrated(mix),1),'bed':round(integrated(bed),1),'bgm':round(integrated(bgm),1),'steps':round(integrated(steps),1)},
  'samplePeakDbfs':{'mix':peak(mix),'steps':peak(steps),'bed':peak(bed)},
  'stepUnderBed':{'room(standing..opening-door)':zone(lambda x:x['state']!='crossing-out'),'outside(crossing-out)':zone(lambda x:x['state']=='crossing-out'),'all':zone(lambda x:True)},
  'oldBakedTrackForComparison':None,'perStep':per}
# old A1 file (baked steps) at the same place, for comparison
old=os.path.join(OUT,'..','old_sfx_exit_outbound.mp3')
if len(sys.argv)>3 and os.path.exists(sys.argv[3]):
    ox=dec(sys.argv[3]); oe=np.zeros(N); a=int(ch[0]['t']*SR); oe[a:a+len(ox)]=ox[:N-a]; obed=bgm+soft+strong+waves
    to,mo=momentary(oe); tob,mob=momentary(obed)
    stp=json.load(open(sys.argv[4]))['steps_sec'] if len(sys.argv)>4 else []
    d=[float(mob[np.searchsorted(tob,ch[0]['t']+x+0.13)]-mo[np.searchsorted(to,ch[0]['t']+x+0.13)]) for x in stp]
    rep['oldBakedTrackForComparison']={'stepUnderBedDb_min':round(min(d),1),'stepUnderBedDb_mean':round(float(np.mean(d)),1),'samplePeakDbfs':peak(oe),'note':'negative = steps LOUDER than BGM+wind+waves'}
    import soundfile as sf; sf.write(os.path.join(OUT,'exit_preview_OLD_baked_steps.wav'),np.clip(obed+oe,-1,1).astype(np.float32),SR,subtype='PCM_16')
json.dump(rep,open(os.path.join(OUT,'loudness.json'),'w'),indent=1)
import soundfile as sf
sf.write(os.path.join(OUT,'exit_preview_mix.wav'),np.clip(mix,-1,1).astype(np.float32),SR,subtype='PCM_16')
sf.write(os.path.join(OUT,'exit_preview_steps_only.wav'),np.clip(steps*4,-1,1).astype(np.float32),SR,subtype='PCM_16')
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',os.path.join(OUT,'exit_preview_mix.wav'),'-c:a','libmp3lame','-b:a','128k',os.path.join(OUT,'exit_preview_mix.mp3')],check=True)
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig,ax=plt.subplots(3,1,figsize=(14,9),sharex=True)
ax[0].specgram(mix,NFFT=2048,Fs=SR,noverlap=1536,cmap='magma',vmin=-110); ax[0].set_ylim(0,12000); ax[0].set_ylabel('Hz (mix)'); ax[0].axhline(4500,color='c',lw=.6,ls='--')
ax[1].specgram(steps+np.random.default_rng(1).standard_normal(N)*1e-7,NFFT=1024,Fs=SR,noverlap=768,cmap='magma',vmin=-140); ax[1].set_ylim(0,12000); ax[1].set_ylabel('Hz (steps only)'); ax[1].axhline(4500,color='c',lw=.6,ls='--')
ax[2].plot(tb,mb,label='bed: BGM+wind+waves+exit track (momentary LUFS)'); ax[2].plot(tsx,ms,label='steps only'); ax[2].plot(tm,mm,label='mix',alpha=.5)
for c in A['changes']:
    if c['t']<=T1 and c['state'] not in ('loading','home'): ax[2].axvline(c['t'],color='k',lw=.4); ax[2].text(c['t'],-18,c['state'],rotation=90,fontsize=7,va='top')
for p in placed: ax[2].plot(p['t'],-58,'v',ms=4,color={'wood':'saddlebrown','rug':'purple','stone':'gray','path':'goldenrod','grass':'green'}[p['surface']])
ax[2].set_ylim(-60,-15); ax[2].set_ylabel('LUFS (400 ms)'); ax[2].legend(fontsize=7,loc='lower right'); ax[2].set_xlabel('s from leaveHome (markers: steps, colour = surface)')
plt.tight_layout(); plt.savefig(os.path.join(OUT,'exit_preview_spectrogram.png'),dpi=90)
print(json.dumps({k:v for k,v in rep.items() if k!='perStep'},indent=1))
