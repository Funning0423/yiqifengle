"""Before/after table: v1 check json vs v2 check json. Sum of counts over frames, max per frame, nonzero frame range."""
import json,sys
A=json.load(open(sys.argv[1])); B=json.load(open(sys.argv[2])); out=sys.argv[3]
def n(v): return v.get('tri_pairs',v.get('verts_inside',v.get('verts_below',0)))
def stats(d):
    S={}
    for clip,frames in d['clips'].items():
        for fr in frames:
            for p,v in fr['pairs'].items():
                if p.startswith('self:legLxlegL_ctrl'): continue
                k=n(v)
                if not k: continue
                s=S.setdefault((clip,p),{'sum':0,'max':0,'f':[],'depth':0.0})
                s['sum']+=k; s['max']=max(s['max'],k); s['f'].append(fr['frame']); s['depth']=max(s['depth'],v.get('depth_mm') or 0.0)
    return S
a,b=stats(A),stats(B)
rows=[]
for key in sorted(set(a)|set(b)):
    x=a.get(key); y=b.get(key)
    fmt=lambda s:'-' if not s else f"max {s['max']} sum {s['sum']} f{min(s['f'])}-{max(s['f'])} d{s['depth']:.2f}mm"
    rows.append(f"{key[0]:20s} {key[1]:42s} | v1: {fmt(x):45s} | v2: {fmt(y)}")
open(out,'w').write('\n'.join(rows)+'\n'); print('\n'.join(rows))
