import json,sys,matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
B=json.load(open(sys.argv[1])); A=json.load(open(sys.argv[2])); out=sys.argv[3]
def series(d,key):
    xs=[];ys=[]
    for r in d['frames']:
        if r['clip'] not in ('cine_open_stand','cine_open_turn'): continue
        x=r['frame'] if r['clip']=='cine_open_stand' else 90+r['frame']
        if key in r: xs.append(x); ys.append(r[key]['depth_mm'])
    return xs,ys
pairs=[('legs x dress','dress'),('legs x apron','apron')]
fig,ax=plt.subplots(3,1,figsize=(12,11),sharex=True)
for i,(title,g) in enumerate(pairs):
    for p,ls in (('legL','-'),('legR','--')):
        for d,lab,c in ((B,'before (v2g, pass2b base)','tab:red'),(A,'after (pass2c SRC + true-size correctives)','tab:green')):
            for mode,lw in (('mid',2.0),('shell_bound',0.8)):
                x,y=series(d,f'{p}x {g}[{mode}]'); ax[i].plot(x,y,ls,color=c,lw=lw,label=f'{lab} {p} {"game midsurface" if mode=="mid" else "0.8 mm shell bound"}')
    ax[i].axhline(0,color='k',lw=0.8); ax[i].axhline(3,color='orange',lw=0.8,ls=':'); ax[i].set_ylabel('signed depth mm (+ = penetration)'); ax[i].set_title(title); ax[i].set_ylim(-15,125)
    ax[i].legend(fontsize=6,ncol=2,loc='upper right')
for k,lab,c in (('legLx chair_back_proxy','legL x chair-back proxy','tab:blue'),('legRx chair_back_proxy','legR x chair-back proxy','tab:cyan'),('bodyx chair_back_proxy','whole body incl. bow x chair-back proxy (info)','tab:purple'),('hairx chair_back_proxy','hair x chair-back proxy (info)','tab:brown'),('bodyx chair_back_real','body x REAL backrest mesh','k')):
    for d,ls,tag in ((B,'--','before'),(A,'-','after')):
        x,y=series(d,k); ax[2].plot(x,y,ls,color=c,label=f'{tag}: {lab}')
ax[2].axhline(0,color='k',lw=0.8); ax[2].set_ylim(-100,60); ax[2].set_title('chair back: col_int_chair_back proxy box (not rendered) and real backrest'); ax[2].set_ylabel('signed depth mm'); ax[2].legend(fontsize=6,ncol=2)
ax[2].set_xlabel('frame (stand f0-90, then turn f1-45 as 91-135; 30 fps)')
plt.tight_layout(); plt.savefig(out,dpi=110); print('saved',out)
