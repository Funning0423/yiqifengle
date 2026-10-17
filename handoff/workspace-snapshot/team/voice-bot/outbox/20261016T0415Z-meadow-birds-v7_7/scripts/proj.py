import sys,os,numpy as np
os.environ['GLB']=sys.argv[1];sys.path.insert(0,'/tmp/b77')
import projlib as L
W,H=float(sys.argv[2]),float(sys.argv[3])
pr=L.cam([0,24,45],[0,4,4],49.42635311494791,W,H)
names=[f'meadow_bird_0{i}{s}' for i in range(5) for s in ('','_wing_L','_wing_R')]
mx=[];out=[]
for t in np.arange(0,20,0.25):
  try:x0,y0,x1,y1,z=L.bbox(names,t,pr,W,H)
  except Exception as e:continue
  vis=x1>0 and x0<W and z>0
  out.append((t,x0,y0,x1,y1,z,vis))
  if vis:mx.append((y0,y1,x1-x0))
for o in out[::8]:print('%.2f %6.0f %6.0f %6.0f %6.0f z%.0f %s'%o)
a=np.array(mx);print('visible frames',len(a),'ymin',a[:,0].min(),'ymax',a[:,1].max(),'width px',a[:,2].min(),a[:,2].max())
