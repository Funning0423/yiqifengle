from pathlib import Path
import json,gzip,numpy as np,math
B=Path('/workspace/shared/grok-takeover/character');O=B/'actual_motion_branch/REALSCENE-FULLCHAIN-R22';Z=np.load(O/'pose_matrices.npz');r=json.load(open(O/'pose_metrics.json'));D=json.load(gzip.open(B/'base/runtime-editable-source.json.gz'));N=list(Z['bone_names']);K=1.0611643605259733;P={n:np.array(v['head']) for n,v in D['restBones'].items()};T={n:np.array(v['tail']) for n,v in D['restBones'].items()};t=Z['times'];h=np.array([x['hip_local_source'] for x in r]);root=np.array([x['root_world_game_m'] for x in r]);yaw=np.array([x['yaw'] for x in r]);ry=lambda a:np.array([[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]]);RR=np.array([ry(a) for a in yaw]);world=root+K*np.einsum('nij,nj->ni',RR,h);uniform=np.arange(3961)/120;u=np.array([np.interp(uniform,t,world[:,j]) for j in range(3)]).T;spans=[(3,4.5),(14.3,16),(17.5,18.5),(18.5,21.5),(21.5,23.2),(27.7,29.2)]
def smooth(v):v=np.clip(v,0,1);return v*v*(3-2*v)
out=[]
for sigma in [.06,.08,.10,.12,.15]:
 rad=int(np.ceil(3*sigma*120));s=np.arange(-rad,rad+1)/120;w=np.exp(-.5*(s/sigma)**2);w/=w.sum();filtered=np.array([np.convolve(np.pad(u[:,j],rad,mode='edge'),w,'valid') for j in range(3)]).T;weights=np.zeros(len(uniform))
 for a,b in spans:weights=np.maximum(weights,smooth((uniform-a)/.18)*(1-smooth((uniform-(b-.18))/.18)))
 target=u.copy();target[:,[0,2]]+=(filtered[:,[0,2]]-u[:,[0,2]])*weights[:,None];local=np.einsum('nji,nj->ni',RR,np.array([np.interp(t,uniform,target[:,j]) for j in range(3)]).T-root)/K;maxover=0;worst=None
 for side in 'LR':
  m=Z['matrices'][:,N.index('foot.'+side)];ankle=np.einsum('nij,j->ni',m[:,:3,:3],P['foot.'+side])+m[:,:3,3];hip=local+P['thigh.'+side]-P['hips'];length=np.linalg.norm(T['thigh.'+side]-P['thigh.'+side])+np.linalg.norm(T['shin.'+side]-P['shin.'+side]);over=np.linalg.norm(ankle-hip,axis=1)-length;i=over.argmax();
  if over[i]>maxover:maxover=float(over[i]);worst=[side,float(t[i])]
 vel=np.linalg.norm(np.diff(target[:,[0,2]],axis=0),axis=1)*120;out.append({'sigma':sigma,'max_leg_overrun_source':maxover,'worst':worst,'speeds':[[a,b,float(vel[(uniform[:-1]>=a)&(uniform[:-1]<b)].max())] for a,b in spans],'max_delta_m':float(np.linalg.norm(target-u,axis=1).max())});np.savez_compressed(O/f'smooth_hip_sigma_{sigma:.2f}.npz',times=uniform,world=target,original=u,weights=weights)
(O/'smooth_hip_screen.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
