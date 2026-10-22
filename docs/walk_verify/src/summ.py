import json
def rng(fs):
    fs=sorted(fs);out=[];s=p=None
    for f in fs:
        if s is None:s=p=f
        elif f==p+1:p=f
        else:out.append((s,p));s=p=f
    if s is not None:out.append((s,p))
    return ','.join(f'f{a}' if a==b else f'f{a}-{b}' for a,b in out) or '—'
S={}
for tag in ('base','current'):
    R=json.load(open(f'out/{tag}.json'));S[tag]={}
    for c in dict.fromkeys(r['clip'] for r in R):
        rr=[r for r in R if r['clip']==c];d={}
        for k in ('LEG_DRESS','LEG_APRON','DRESS_APRON'):
            hit=[r['f'] for r in rr if r[k+'_tris']>0];w=max(rr,key=lambda r:r[k+'_depth_mm'])
            d[k]=dict(frames=rng(hit),n=len(hit),peak_mm=w[k+'_depth_mm'],peak_f=w['f'],tris_max=max(r[k+'_tris'] for r in rr))
        S[tag][c]=dict(N=len(rr),**d)
json.dump(S,open('summary.json','w'),ensure_ascii=False,indent=1)
same=all(S['base'][c]==S['current'][c] for c in S['base'])
print('base==current',same)
for c,d in S['base'].items():print(c,d['N'],{k:(v['frames'],v['peak_mm'],'@f%d'%v['peak_f'],v['tris_max']) for k,v in d.items() if k!='N'})
