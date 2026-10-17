import json,matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
V=[('v2g','probe/measure_v2g.json','probe/cloth_v2g.json',None,'tab:red','before v2g (pass2b)'),
   ('src','probe/measure_src.json','probe/cloth_src.json','pipe/probe/check_src.json','tab:orange','pass2c SRC (per-frame knots)'),
   ('cs2','probe/measure_cs2.json','probe/cloth_cs2.json','probe/check_cs2.json','tab:green','v3 constrained-smooth cs2')]
fig,ax=plt.subplots(4,1,figsize=(13,15),sharex=True)
def ser(d,key):
    xs=[];ys=[]
    for r in d['frames']:
        if r['clip'] not in ('cine_open_stand','cine_open_turn') or key not in r: continue
        xs.append(r['frame'] if r['clip']=='cine_open_stand' else 90+r['frame']); ys.append(r[key]['depth_mm'])
    return xs,ys
for tag,mj,cj,kj,c,lab in V:
    m=json.load(open(mj))
    for p,ls in (('legL','-'),('legR','--')):
        x,y=ser(m,f'{p}x dress[mid]'); ax[0].plot(x,y,ls,color=c,label=f'{lab} {p}×dress')
        x,y=ser(m,f'{p}x apron[mid]'); ax[0].plot(x,y,ls,color=c,lw=0.7,alpha=0.6)
    cl=json.load(open(cj))
    for o,ls in (('G2_DRESS_R5G2','-'),('G2_APRON_R5G2','--')):
        y=cl['cine_open_stand'][o]['per_frame_max_accel']+cl['cine_open_turn'][o]['per_frame_max_accel']
        x=list(range(1,90))+list(range(92,92+len(cl['cine_open_turn'][o]['per_frame_max_accel'])))
        ax[1].plot(x,y,ls,color=c,label=f'{lab} {o[3:8].lower()}')
    if kj:
        k=json.load(open(kj))
        for key,ls,axi in (('garment[visible]:apronxdress','-',2),('thin_sheet:dress_self','--',2),('garment[visible]:torsoxdress',':',3),('garment[visible]:legLxdress','-.',3)):
            xs=[];ys=[]
            for clip,off in (('cine_open_stand',0),('cine_open_turn',90)):
                for r in k['clips'][clip]: xs.append(r['frame']+off); ys.append(r['pairs'].get(key,{}).get('tri_pairs',0))
            ax[axi].plot(xs,ys,ls,color=c,label=f'{lab} {key}')
ax[0].set_ylim(-15,125); ax[0].axhline(0,color='k',lw=.8); ax[0].set_title('legs × dress / apron, signed depth mm (+ = penetration; game midsurface; thin = apron)'); ax[0].legend(fontsize=6,ncol=3)
ax[1].axhline(10,color='k',ls=':',lw=1); ax[1].set_ylim(0,100); ax[1].set_title('cloth max vertex acceleration per frame, mm/frame² (target ≤ ~10)'); ax[1].legend(fontsize=7,ncol=3)
ax[2].set_title('triangle overlaps per frame: apron×dress (0.8 mm shells) and dress self-intersection (midsurface)'); ax[2].legend(fontsize=7)
ax[3].set_title('triangle overlaps per frame: torso×dress, legL×dress (shell)'); ax[3].legend(fontsize=7)
for a_ in ax:
    for lo,hi in ((36,41),(76,82)): a_.axvspan(lo,hi,color='grey',alpha=0.15)
ax[3].set_xlabel('frame (stand 0-90, turn 1-45 as 91-135); grey = game-camera shimmer windows f36-41, f76-82')
plt.tight_layout(); plt.savefig('evidence/curves_v3_penetration_accel_overlaps.png',dpi=100); print('saved')
