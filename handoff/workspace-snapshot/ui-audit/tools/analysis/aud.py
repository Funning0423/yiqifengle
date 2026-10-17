import numpy as np,wave,sys
def load(p):
  w=wave.open(p);a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(float)/32768;return a,w.getframerate()
def first(a,sr):
  i=np.argmax(np.abs(a)>1e-3);return i/sr
def db(a,sr,t0,t1):
  s=a[int(t0*sr):int(t1*sr)];return 10*np.log10(np.mean(s*s)+1e-24)
