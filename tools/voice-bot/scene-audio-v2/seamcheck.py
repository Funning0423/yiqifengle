import sys,json,numpy as np
from lib import *
def check(name):
    info=json.load(open(f'out/{name}.json'));L=info['loopS'];D=info['dupS']
    y=load(f'out/{name}.mp3',ch=2)
    # find encoder delay by aligning start with wav source
    w=load(f'wav/{name}.wav',ch=2)
    a=w[:SR//2,0];best=(0,-1)
    from scipy.signal import correlate
    cc=correlate(y[:len(a)+4000,0],a,mode='valid');d0=int(np.argmax(cc))
    best=(d0,float(cc[d0]/(np.linalg.norm(a)*np.linalg.norm(y[d0:d0+len(a),0])+1e-12)))
    d=best[0];y=y[d:]
    nL=int(L*SR);nD=int(D*SR*0.9)
    c=np.corrcoef(y[:nD,0],y[nL:nL+nD,0])[0,1]
    # click detector on x3 wav: HP 6k energy in 5ms windows around seams vs median
    x3=load(f'wav/{name}_x3.wav',ch=2).mean(1);h=hp(x3,6000,4);n=int(.005*SR)
    e=np.sqrt((h[:len(h)//n*n].reshape(-1,n)**2).mean(1));med=np.median(e)
    sp=[]
    for k in (1,2):
        i=int(k*nL/n);sp.append(20*np.log10(e[i-3:i+3].max()/med))
    loc=20*np.log10(np.percentile(e,99.9)/med)
    print(json.dumps(dict(name=name,enc_delay_samples_48k=d,align_corr=round(best[1],3),dup_vs_head_corr=round(float(c),3),seam_hf_peak_db=[round(s,1) for s in sp],file_hf_p99_9_db=round(float(loc),1))))
for n in sys.argv[1:]: check(n)
