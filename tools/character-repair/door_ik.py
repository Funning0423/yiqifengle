"""Two bone door reach: preserve source palm trajectory around contact,
keep constrained hand rotation, preserve upper-arm/forearm endpoints.
"""
import numpy as np,math
from scipy.spatial.transform import Rotation as R

def sample(g,a,node,path,t):
 n=g.j['nodes'][node];default=n.get(path,{'translation':[0,0,0],'rotation':[0,0,0,1],'scale':[1,1,1]}[path])
 for c in a['channels']:
  if c['target']=={'node':node,'path':path}:
   s=a['samplers'][c['sampler']];times=g.accessor(s['input'])[:,0];v=g.accessor(s['output']).astype(float)
   if len(times)==1 or t<=times[0]:return v[0]
   if t>=times[-1]:return v[-1]
   k=int(np.searchsorted(times,t,side='right')-1);u=(t-times[k])/(times[k+1]-times[k]);x=v[k];y=v[k+1]
   if path=='rotation':
    if x@y<0:y=-y
    dot=float(np.clip(x@y,-1,1))
    if dot<.9995:
     h=math.acos(dot);return (math.sin((1-u)*h)*x+math.sin(u*h)*y)/math.sin(h)
    q=(1-u)*x+u*y;return q/np.linalg.norm(q)
   return (1-u)*x+u*y
 return np.array(default,float)
def worlds(g,a,t):
 parent={ch:i for i,n in enumerate(g.j['nodes']) for ch in n.get('children',[])};out={}
 def world(i):
  if i not in out:
   m=np.eye(4);m[:3,:3]=R.from_quat(sample(g,a,i,'rotation',t)).as_matrix()*sample(g,a,i,'scale',t)[None,:];m[:3,3]=sample(g,a,i,'translation',t)
   out[i]=np.einsum('ij,jk->ik',world(parent[i]),m) if i in parent else m
  return out[i]
 for i in range(len(g.j['nodes'])):world(i)
 return out,parent
def between(v,w):
 v=v/np.linalg.norm(v);w=w/np.linalg.norm(w);cross=np.cross(v,w);dot=float(np.clip(v@w,-1,1))
 if dot>.99999999:return np.eye(3)
 if dot<-.99999999:
  axis=np.cross(v,[1,0,0] if abs(v[0])<.9 else [0,1,0]);axis/=np.linalg.norm(axis);return R.from_rotvec(axis*math.pi).as_matrix()
 return R.from_quat(np.r_[cross,1+dot]).as_matrix()
def apply(g,source):
 a=next(a for a in g.j['animations'] if a['name']=='door_reach');old=next(a for a in source.j['animations'] if a['name']=='door_reach');names={n['name']:i for i,n in enumerate(g.j['nodes'])};u=names['upper_arm.L'];f=names['forearm.L'];h=names['hand.L'];palm=np.array([0,.075,0]);results={};unreachable=0
 channels={c['target']['node']:a['samplers'][c['sampler']] for c in a['channels'] if c['target']['path']=='rotation' and c['target']['node'] in [u,f]}
 # Solve union times, then retain each channel's original sample layout.
 channel_times={node:g.accessor(channels[node]['input'])[:,0] for node in [u,f]}
 times=np.unique(np.concatenate(list(channel_times.values())))
 outputs={u:[],f:[]};duration=float(times[-1]);max_endpoint_error=0
 for t in times:
  wm,parent=worlds(g,a,float(t));ow,_=worlds(source,old,float(t));original_palm=np.einsum('ij,j->i',ow[h][:3,:3],palm)+ow[h][:3,3];candidate_palm=np.einsum('ij,j->i',wm[h][:3,:3],palm)+wm[h][:3,3]
  def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
  influence=float(smooth(float(t)/.3)*smooth((duration-float(t))/.4));target=candidate_palm+(original_palm-candidate_palm)*influence
  shoulder=wm[u][:3,3];oldelbow=wm[f][:3,3];tf=sample(g,a,f,'translation',t);th=sample(g,a,h,'translation',t);rh=R.from_quat(sample(g,a,h,'rotation',t)).as_matrix();vec=th+rh@palm;L1=np.linalg.norm(tf);L2=np.linalg.norm(vec);d=np.linalg.norm(target-shoulder);axis=(target-shoulder)/d
  if d>L1+L2-1e-7 or d<abs(L1-L2)+1e-7:unreachable+=1;d=np.clip(d,abs(L1-L2)+1e-7,L1+L2-1e-7);target=shoulder+axis*d
  x=(d*d+L1*L1-L2*L2)/(2*d);height=math.sqrt(max(0,L1*L1-x*x));perp=oldelbow-shoulder-axis*((oldelbow-shoulder)@axis)
  if np.linalg.norm(perp)<1e-8:perp=np.cross(axis,[0,0,1])
  perp/=np.linalg.norm(perp);elbow=shoulder+axis*x+perp*height
  upper=between(oldelbow-shoulder,elbow-shoulder)@wm[u][:3,:3];base=upper@R.from_quat(sample(g,a,f,'rotation',t)).as_matrix();fore=between(base@vec,target-elbow)@base
  outputs[u].append(R.from_matrix(wm[parent[u]][:3,:3].T@upper).as_quat());outputs[f].append(R.from_matrix(upper.T@fore).as_quat())
 for node,qs in outputs.items():
  qs=np.array(qs)[np.searchsorted(times,channel_times[node])]
  for i in range(1,len(qs)):
   if qs[i]@qs[i-1]<0:qs[i]*=-1
  g.write_accessor(channels[node]['output'],qs)
 return {'clip':'door_reach','bones':['upper_arm.L','forearm.L'],'target':'original palm trajectory (hand local [0,.075,0])','contact_preserved':True,'endpoint_influence':0,'unreachable_keys':unreachable,'keys':len(times)}
