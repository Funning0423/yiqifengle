# worst-case level cascade mix: bgm_main x musicVolume 0.4 + match/combo chain + cheers (playCheer retires previous cheer)
import sys,subprocess,numpy as np
from scipy.signal import resample_poly
D=sys.argv[1]; SR=44100; C={}
def ld(n):
    if n not in C:
        raw=subprocess.run(['ffmpeg','-v','error','-i',f'{D}/{n}.mp3','-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout
        C[n]=np.frombuffer(raw,np.float32).astype(float)
    return C[n]
bgm=ld('bgm_main')*0.4
ev=[('sfx_match_normal',None),('sfx_combo_1','sfx_cheer_1_great'),('sfx_combo_2','sfx_cheer_2_excellent'),('sfx_combo_3','sfx_cheer_3_amazing'),('sfx_combo_3','sfx_cheer_4_unbelievable')]
worst=(-99,0,0)
for gap in (0.2,0.3,0.4,0.5,0.7,0.9):
  for off in np.arange(0,55,3.7):
    N=int((5*gap+2.2)*SR); y=bgm[int(off*SR):int(off*SR)+N].copy()
    cheers=[]
    for k,(a,b) in enumerate(ev):
      i=int(k*gap*SR); s=ld(a); L=min(len(s),N-i); y[i:i+L]+=s[:L]
      if b: cheers.append((i,b))
    for j,(i,b) in enumerate(cheers):
      end=cheers[j+1][0] if j+1<len(cheers) else N; s=ld(b); L=min(len(s),end-i); y[i:i+L]+=s[:L]
    tp=20*np.log10(np.abs(resample_poly(y,4,1)).max())
    if tp>worst[0]: worst=(tp,gap,off)
print(f'worst-case cascade TP {worst[0]:.2f} dBFS (gap {worst[1]} s, bgm offset {worst[2]:.1f} s)')
