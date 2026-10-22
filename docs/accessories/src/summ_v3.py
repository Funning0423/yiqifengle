import json,collections,os,csv
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','qa','v3'))
K=['L_LEG','L_TORSO','L_DRESS','L_APRON','L_BOW','L_ARM','C_DRESSxBODY','C_APRONxBODY','G_HAND','G_inside_verts','G_inside_depth_mm','G_clear_mm']
def grp(p):
    g=collections.OrderedDict()
    for r in json.load(open(p)): g.setdefault('xfade×14' if r['clip'].startswith('xf:') else r['clip'],[]).append(r)
    return g
def c(v,k):
    l=[(r.get(k) or 0) for r in v]
    if k=='G_clear_mm': return str(min(l))
    if k=='G_inside_depth_mm': return str(max(l))
    return '0' if max(l)==0 else f'{max(l)}/{sum(i>0 for i in l)}'
out=[]
for mode in ('hang','rigid','swing'):
    for mo in ('on','off'):
        out.append(f'\n### {mode}，hold_R={"1" if mo=="on" else "0"}\n| 片段 | 帧 | '+' | '.join(K)+' |\n|'+'---|'*(len(K)+2))
        for cl,v in grp(f'v3_{mo}_{mode}.json').items(): out.append(f'| {cl} | {len(v)} | '+' | '.join(c(v,k) for k in K)+' |')
open('QA_v3.md','w').write('\n'.join(out));print('\n'.join(out))
