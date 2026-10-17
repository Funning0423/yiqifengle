import sys,subprocess,numpy as np
from scipy.signal import resample_poly
for f in sys.argv[1:]:
    raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-f','f32le','-'],capture_output=True).stdout
    ch=int(subprocess.run(['ffprobe','-v','error','-show_entries','stream=channels,sample_rate','-of','csv=p=0',f],capture_output=True,text=True).stdout.strip().split(',')[1]) if False else None
    info=subprocess.run(['ffprobe','-v','error','-show_entries','stream=sample_rate,channels,bit_rate','-of','csv=p=0',f],capture_output=True,text=True).stdout.strip()
    sr,c,br=info.split(','); x=np.frombuffer(raw,np.float32).reshape(-1,int(c))
    sp=np.abs(x).max(); tp=np.abs(resample_poly(x,4,1,axis=0)).max()
    print(f"{f}\t{sr}\t{c}\t{br}\tSP {20*np.log10(sp):.2f}\tTP {20*np.log10(tp):.2f}\tn>=0.999 {(np.abs(x)>=0.999).sum()}")
