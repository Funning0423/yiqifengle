import sys,numpy as np
exec(open('glbcmp.py').read().split('def anims')[0])
A=load(sys.argv[1]);B=load(sys.argv[2])
na={m['name']:m for m in A[0]['meshes']};nb={m['name']:m for m in B[0]['meshes']}
for n in sorted(set(na)|set(nb)):
  if 'G2' not in n: continue
  if n not in na or n not in nb: print(n,'missing');continue
  for pa,pb in zip(na[n]['primitives'],nb[n]['primitives']):
    r={}
    for k in ('POSITION','JOINTS_0','WEIGHTS_0'):
      x,y=acc(A,pa['attributes'][k]),acc(B,pb['attributes'][k]); r[k]='same' if x.shape==y.shape and np.abs(x-y).max()==0 else f'diff {x.shape} vs {y.shape}'
    print(n,r,'targets',len(pa.get('targets',[])),len(pb.get('targets',[])))
