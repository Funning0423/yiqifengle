# r2 island fit check (run with python3; needs trimesh+numpy). Samples the REAL island meshes in
# creator-project/assets/firstslice/combined_visual_m.glb (env_island_main, env_island_props_merged) under the coast
# walk surfaces placed by T=(-0.6,-0.845,21.5), yaw 180, and the island walk segments exit_path_17 -> ramp start -> S0.
import numpy as np,math,os
exec(open(os.path.join(os.path.dirname(__file__),'island_probe.py')).read().split("if __name__")[0])
CX,ROOTY,Z0=-0.6,-0.845,9.4            # corridor centre x, coast local-0 world y, S0 world z
def coast_y(z):
  if z<Z0-1.0:return None
  if z<Z0:return 0.0-0.245*(z-(Z0-1.0))/1.0      # ramp 0 -> -0.245
  k=int((z-Z0)/0.4);return ROOTY+0.6-0.2*k if k<3 else ROOTY
bad=[]
for z in np.arange(Z0-1.0,Z0+13.5,0.1):
  cy=coast_y(z)
  for dx in np.arange(-1.3,1.31,0.13):
    x=CX+dx
    for nm in ['env_island_main','env_island_props_merged']:
      h=hgt(nm,x,z)
      if h is not None and h>cy+0.03:bad.append((round(h-cy,3),nm,round(x,2),round(z,2)))
bad.sort(reverse=True);print('island above coast walk surface (>3 cm), samples:',len(bad),bad[:6])
gap=[]
for z in np.arange(Z0-1.0,Z0,0.1):
  h=hgt('env_island_main',CX,z);gap.append(round(coast_y(z)-h,3))
print('ramp minus island sand on centreline (m):',gap)
V=M['env_island_props_merged'].vertices;pts=V[:,[0,2]];hi=V[:,1]>0.08
def segd(p,a,b):
  a=np.array(a);b=np.array(b);ab=b-a;t=np.clip(((p-a)@ab)/(ab@ab),0,1);return np.linalg.norm(p-(a+np.outer(t,ab)),axis=1)
for a,b in [((-2.11,5.28),(CX,Z0-1.0)),((CX,Z0-1.0),(CX,Z0))]:
  print('prop clearance',a,'->',b,'min m',round(segd(pts[hi],a,b).min(),3),'len',round(math.dist(a,b),3))
