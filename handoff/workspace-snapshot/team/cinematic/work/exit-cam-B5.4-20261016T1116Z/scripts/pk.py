import sys;sys.path.insert(0,'/tmp/b5');from kin import kin;import numpy as np
k=kin('/tmp/b5/frames_B5.json');sp=np.linalg.norm(k['V'],axis=1);print('T',round(k['t'][-1],2),'peak',round(sp.max(),2),round(k['t'][sp.argmax()],2),'end',np.round(k['P'][-1],1))
