import sys,json,numpy as np
from lib import *
from scipy.ndimage import median_filter
OUT='/workspace/yiqifengle/previews/Voice-bot/v2-scene-audio'
P=json.load(open(OUT+'/previews.json'))
for p in P:
    x=load(OUT+'/'+p['file']).mean(1);h=hp(x,7000,4);n=int(.005*SR)
    e=20*np.log10(np.sqrt((h[:len(h)//n*n].reshape(-1,n)**2).mean(1))+1e-9);loc=median_filter(e,201)
    d=e-loc;seams=sorted(set(sum([v for k,v in p.items() if 'seam' in k and isinstance(v,list)],[])))
    near=[round(float(d[max(0,int(s/0.005)-4):int(s/0.005)+4].max()),1) for s in seams]
    print(p['file'],'seams',seams,'max dHF@seam',near,'file p99.9',round(float(np.percentile(d,99.9)),1))
