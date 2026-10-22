import json,sys,collections
new=json.load(open(sys.argv[1]));base=json.load(open(sys.argv[2]))
K=['S_FACE','S_CHIN','S_HAIR','S_HAT','S_ARM','S_TORSO','S_LEG','S_RIBBON','S_APRON','S_DRESS']
def agg(rows):
    g=collections.OrderedDict()
    for r in rows:
        k=(r['run'],r['clip']);a=g.setdefault(k,dict(n=0,deg=0,**{x:[0,0] for x in K}));a['n']+=1;a['deg']=max(a['deg'],r['scarf_deg'])
        for x in K:
            if r[x]:a[x][0]=max(a[x][0],r[x]);a[x][1]+=1
    return g
N=agg(new);Bb=agg(base);out=['| run | clip | 帧 | 围巾最大偏角° | '+' | '.join(K)+' | 结论 |','|'+'---|'*(len(K)+5)];bad=[]
for k,a in N.items():
    b=Bb.get(k);cells=[];ok=True
    for x in K:
        v=a[x];bv=b[x] if b else [0,0]
        cells.append('0' if v[1]==0 else '%d/%d (基线 %d/%d)'%(v[0],v[1],bv[0],bv[1]))
        if v[1]>bv[1] or v[0]>bv[0]:ok=False
    concl='通过(0)' if all(a[x][1]==0 for x in K) else ('不劣于基线' if ok else '**比基线差**')
    if not ok:bad.append(k)
    out.append('| %s | %s | %d | %.1f | %s | %s |'%(k[0],k[1],a['n'],a['deg'],' | '.join(cells),concl))
print('\n'.join(out));print('\nBAD',bad,'rows',len(new),len(base))
