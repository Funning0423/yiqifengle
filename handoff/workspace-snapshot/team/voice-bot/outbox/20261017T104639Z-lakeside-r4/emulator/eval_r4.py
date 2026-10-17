import sys,json;sys.path.insert(0,'.')
from fit_r4 import *
base=copy.deepcopy(R3);base['vc_linear']=True
x=json.load(open(sys.argv[1] if len(sys.argv)>1 else 'fit_r4.json'))['x']
import fit_r4b as FB
V=FB.r4Vz(np.array(x),base) if len(x)==30 else r4V(np.array(x),base)
im=shade_sparse(V)
mx=0
for n in B:
  v=np.median(sample(im,n).reshape(-1,3),0);e=v-TG[n];mx=max(mx,abs(e).max())
  print('%-18s r4 %s tgt %s err %s'%(n,np.round(v).astype(int),np.round(TG[n]).astype(int),np.round(e).astype(int)))
for n in BX:
  v=np.median(sample(im,n).reshape(-1,3),0);print('  land %-12s r4 %s tgt %s'%(n,np.round(v).astype(int),np.round(TX[n]).astype(int)))
print('stripe',round(float(sample(im,'_stripe').mean(1).std(0).mean()),2),'maxerr',round(mx,1))
