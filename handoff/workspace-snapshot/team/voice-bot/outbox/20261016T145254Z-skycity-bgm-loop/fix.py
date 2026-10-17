import numpy as np,wave
sr=44100;L=int(0.070*sr)
a=np.fromfile('sky48.raw',np.float32).reshape(-1,2).astype(np.float64)
n=len(a);print('samples',n,n/sr)
th=np.linspace(0,np.pi/2,L)[:,None]
b=a.copy();b[n-L:]=a[n-L:]*np.cos(th)+a[:L]*np.sin(th)
b=np.clip(b,-1,1);pcm=(b*32767).round().astype('<i2')
w=wave.open('sky_fixed.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes());w.close()
