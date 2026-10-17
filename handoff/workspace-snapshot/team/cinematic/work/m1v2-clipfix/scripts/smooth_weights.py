"""temporal smoothing of the pass2c per-frame corrective schedule (one independently solved knot per frame -> vertex jitter).
W'_f = sum_j g(f-j) W_j / sum_j g(f-j), j in clip range, Gaussian sigma (frames); optional per-frame sigma override 'f:sigma,...'.
usage: python3 smooth_weights.py <in_sidecar.json> <out_sidecar.json> <sigma> [overrides]"""
import json,sys,math
src,dst,sig=sys.argv[1],sys.argv[2],float(sys.argv[3]); ov={int(a.split(':')[0]):float(a.split(':')[1]) for a in sys.argv[4].split(',')} if len(sys.argv)>4 and sys.argv[4] else {}
d=json.load(open(src)); W={int(k):v for k,v in d['cine_open_stand_weights'].items()}; F=sorted(W); out={}
for f in F:
    s=ov.get(f,sig)
    if s<=0: out[str(f)]=W[f]; continue
    r=int(math.ceil(3*s)); acc={}; tot=0
    for j in range(f-r,f+r+1):
        if j not in W: continue
        g=math.exp(-0.5*((f-j)/s)**2); tot+=g
        for k,v in W[j].items(): acc[k]=acc.get(k,0)+g*v
    out[str(f)]={k:round(v/tot,6) for k,v in acc.items() if v/tot>1e-6}
d['cine_open_stand_weights']=out; d['clipfix_smoothing']={'sigma_frames':sig,'overrides':ov,'note':'运镜bot clipfix: Gaussian temporal blend of the per-frame corrective knots (dress, apron, bow tails); bones unchanged'}
json.dump(d,open(dst,'w'),indent=1); print('wrote',dst)
