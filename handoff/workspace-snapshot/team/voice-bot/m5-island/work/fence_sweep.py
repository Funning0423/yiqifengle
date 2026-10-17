import sys; sys.path.insert(0,'scripts')
from m5_common import *
R=routes_2d()
print({k:len(v) for k,v in R.items()})
for yend in [-2.349,-2.2,-2.1,-2.0,-1.95,-1.9,-1.85,-1.8,-1.7]:
    H=hull2d([(-1.712,yend),(-1.61,yend),(-1.712,-0.246),(-1.61,-0.246)])
    r=min_clear(R,H); m=min(r.values(),key=lambda x:x[0])
    print(yend, round(m[0],3), m[1], {k:round(v[0],3) for k,v in r.items()})
# alt: move fence in -x by dx, full length
for dx in [0.05,0.1,0.15,0.2]:
    H=hull2d([(-1.712-dx,-2.349),(-1.61-dx,-2.349),(-1.712-dx,-0.246),(-1.61-dx,-0.246)])
    r=min_clear(R,H); m=min(r.values(),key=lambda x:x[0]); print('dx',dx,round(m[0],3),m[1])
