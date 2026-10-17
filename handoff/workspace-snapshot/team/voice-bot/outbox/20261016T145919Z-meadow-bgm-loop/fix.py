import numpy as np,subprocess,sys,wave
S=44100; g_db=float(sys.argv[1])
x=np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i','m48.mp3','-f','f32le','-ac','2','-ar','44100','-'],capture_output=True).stdout,np.float32).reshape(-1,2).astype(np.float64)
n=len(x); a=x.copy()
# 1) smooth gain ramp (raised cosine) over [n-2.0s, n-0.30s] down to g_db, held to the end
r0,r1=n-int(2.0*S),n-int(0.30*S); g=np.ones(n); t=np.linspace(0,1,r1-r0)
G=10**(g_db/20); g[r0:r1]=1+(G-1)*(0.5-0.5*np.cos(np.pi*t)); g[r1:]=G; a*=g[:,None]
# 2) 70 ms equal-power end->start blend (as skycity)
L=int(0.07*S); th=np.linspace(0,np.pi/2,L)[:,None]; a[n-L:]=a[n-L:]*np.cos(th)+x[:L]*np.sin(th)
y=np.clip(np.round(a*32767),-32768,32767).astype('<i2')
w=wave.open('m_fixed.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(S); w.writeframes(y.tobytes()); w.close(); print(n)
