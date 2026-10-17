import numpy as np,subprocess,sys,json
def dec(f,raw):
    a=['ffmpeg','-v','error']+(['-flags2','+skip_manual'] if raw else [])+['-i',f,'-f','f32le','-ac','2','-ar','44100','-']
    x=np.frombuffer(subprocess.run(a,capture_output=True).stdout,np.float32).reshape(-1,2); return x
def db(x): return 20*np.log10(np.sqrt(np.mean(x**2))+1e-12)
def meas(f,dur):
    S=44100;w=2205;out={}
    for raw in (0,1):
        m=dec(f,raw).mean(1); out['raw' if raw else 'gapless']=(db(m[-w:]),db(m[:w]),abs(db(m[-w:])-db(m[:w])))
    m=dec(f,1).mean(1); T0=int(round((dur-0.045-0.15-0.03)*S)); X=int(0.15*S)
    b=db(m[T0-w:T0]); a=db(m[X:X+w]); out['ingame']=(b,a,abs(a-b))
    # also full in-game rendered seam for click check
    th=np.linspace(0,np.pi/2,X); seg=m[T0:T0+X]*np.cos(th)+m[:X]*np.sin(th)
    r=np.concatenate([m[T0-S:T0],seg,m[X:X+S]]); d=np.abs(np.diff(r)); out['maxstep_seam']=float(d[S-50:S+X+50].max()); out['p999']=float(np.percentile(d,99.9))
    return out
for f in sys.argv[1:]:
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
    print(f,round(dur,6),{k:tuple(round(v,2) for v in x) if isinstance(x,tuple) else round(x,4) for k,x in meas(f,dur).items()})
