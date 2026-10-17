import sys,json;sys.path.insert(0,'.')
from opt_land import *
K5=['near_water_L','bridge_deck','grass_L','far_trees','roof']
def ev(v,water=WA,img=None):
  img=emu.shade(G,P_of(v,water)) if img is None else img
  for k in K5+['bridge_side','near_water_R','mid_water']:
    m=np.array(regions.med(img,regions.R[k]),float);t=np.array(regions.med(ref,regions.R[k]),float)
    print('%-13s emu %-13s r5h3 %-13s luma %.2f'%(k,'/'.join(map(str,m.astype(int))),'/'.join(map(str,t.astype(int))),lum(m)/lum(t)))
  return img
if __name__=='__main__': ev(json.loads(sys.argv[1]))
