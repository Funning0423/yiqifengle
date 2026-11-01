import sys,numpy as np
from lib import *
def meas(f):
    x=load(f).mean(1);n=int(.1*SR)
    r=max(np.sqrt((x[i:i+n]**2).mean()) for i in range(0,max(1,len(x)-n),SR//200))
    return round(20*np.log10(r+1e-12),1),round(20*np.log10(np.abs(x).max()+1e-12),1),round(len(x)/SR,2)
if __name__=='__main__':
    for f in sys.argv[1:]: print(f.split('/')[-1],meas(f))
