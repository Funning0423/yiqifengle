exec(open('/workspace/shared/grok-takeover/character/actual_motion_branch/full_chain_preparation/screen_smoothed_hips.py').read().split('out=[]')[0])
uniroot=np.array([np.interp(uniform,t,root[:,j]) for j in range(3)]).T;uniyaw=np.interp(uniform,t,yaw);uri=np.array([ry(x) for x in uniyaw]);out=[]
for sigma in [.10,.12,.15]:
 rad=int(np.ceil(3*sigma*120));s=np.arange(-rad,rad+1)/120;w=np.exp(-.5*(s/sigma)**2);w/=w.sum();filtered=np.array([np.convolve(np.pad(u[:,j],rad,mode='edge'),w,'valid') for j in range(3)]).T
 for amplitude in [.4,.55,.7]:
  for drop in [0,.004,.008]:
   target=u.copy()
   for a,b in spans:
    mask=(uniform>=a)&(uniform<=b);ts=uniform[mask];phase=smooth((ts-a)/(b-a));ha=np.array([np.interp(a,t,h[:,j]) for j in range(3)]);hb=np.array([np.interp(b,t,h[:,j]) for j in range(3)]);hh=ha[None,:]*(1-phase[:,None])+hb[None,:]*phase[:,None];neutral=uniroot[mask]+K*np.einsum('nij,nj->ni',uri[mask],hh);weight=smooth((ts-a)/.18)*(1-smooth((ts-(b-.18))/.18));candidate=neutral+amplitude*(filtered[mask]-neutral);target[np.ix_(mask,[0,2])]+=(candidate[:,[0,2]]-u[np.ix_(mask,[0,2])])*weight[:,None];target[mask,1]-=drop*np.sin(np.pi*(ts-a)/(b-a))**2
   local=np.einsum('nji,nj->ni',RR,np.array([np.interp(t,uniform,target[:,j]) for j in range(3)]).T-root)/K;maxover=0;worst=None
   for side in 'LR':
    m=Z['matrices'][:,N.index('foot.'+side)];ankle=np.einsum('nij,j->ni',m[:,:3,:3],P['foot.'+side])+m[:,:3,3];hip=local+P['thigh.'+side]-P['hips'];length=np.linalg.norm(T['thigh.'+side]-P['thigh.'+side])+np.linalg.norm(T['shin.'+side]-P['shin.'+side]);over=np.linalg.norm(ankle-hip,axis=1)-length;i=over.argmax();
    if over[i]>maxover:maxover=float(over[i]);worst=[side,float(t[i])]
   vel=np.linalg.norm(np.diff(target[:,[0,2]],axis=0),axis=1)*120;row={'sigma':sigma,'amplitude':amplitude,'drop_m':drop,'max_leg_overrun_source':maxover,'worst':worst,'speeds':[[a,b,float(vel[(uniform[:-1]>=a)&(uniform[:-1]<b)].max())] for a,b in spans],'max_delta_m':float(np.linalg.norm(target-u,axis=1).max())};out.append(row)
   np.savez_compressed(O/f'natural_turn_hip_s{sigma:.2f}_a{amplitude:.2f}_d{drop:.3f}.npz',times=uniform,world=target,original=u)
(O/'natural_turn_hip_screen.json').write_text(json.dumps(out,indent=2));print(json.dumps(sorted(out,key=lambda x:(x['max_leg_overrun_source']>1e-6,x['drop_m'],max(y[2] for y in x['speeds'])))[:5],indent=2))
