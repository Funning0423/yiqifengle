import json,collections,os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','qa','v2'))
def grp(p):
    g=collections.OrderedDict()
    for r in json.load(open(p)): g.setdefault(r['clip'] if not r['clip'].startswith('xf:') else 'xfade×14',[]).append(r)
    return g
def cell(v,k):
    l=[r.get(k) or 0 for r in v];return '0' if max(l)==0 else f'{max(l)}/{sum(i>0 for i in l)}'
out=[]
SK=['S_FACE','S_CHIN','S_HAIR','S_HAT','S_ARM','S_HANDR','S_TORSO','S_APRON','S_RIBBON','S_DRESS','B_HAIRxTORSO']
for f in ('full_scarf_W0.json','full_scarf_W1.json'):
    out.append(f'\n### 围巾复核 {f}\n| 片段 | 帧 | '+' | '.join(SK)+' |\n|'+'---|'*(len(SK)+2))
    for c,v in grp(f).items(): out.append(f'| {c} | {len(v)} | '+' | '.join(cell(v,k) for k in SK)+' |')
    xf=[r for r in json.load(open(f)) if r['clip'].startswith('xf:')];bad=sorted({r['clip'] for r in xf if any((r[k] or 0)>0 for k in SK if k!='B_HAIRxTORSO')})
    out.append(f'过渡中有围巾命中的：{bad or "无"}')
LK=['L_LEG','L_DRESS','L_APRON','L_TORSO','L_ARM','L_BOW','L_SCARF','G_HAND','C_DRESSxBODY','C_APRONxBODY','C_DRESSxAPRON']
for mode in ('hang','rigid','swing'):
    a=grp(f'full_off_{mode}.json');b=grp(f'full_on_{mode}.json')
    out.append(f'\n### 提灯 {mode}（右臂 0.65；关→开 = tuck_R+hold_R 0→1）\n| 片段 | 帧 | '+' | '.join(LK)+' | 握把最小间隙 mm 关→开 |\n|'+'---|'*(len(LK)+3))
    for c in a:
        v,w=a[c],b[c];out.append(f'| {c} | {len(v)} | '+' | '.join(f'{cell(v,k)}→{cell(w,k)}' for k in LK)+f" | {min(r['G_clear_mm'] for r in v)}→{min(r['G_clear_mm'] for r in w)} |")
    xf=[r for r in json.load(open(f'full_on_{mode}.json')) if r['clip'].startswith('xf:')]
    out.append('开形变时过渡中灯×裙/围裙有命中的：'+str(sorted({r['clip'][3:] for r in xf if r['L_DRESS'] or r['L_APRON']})))
open('QA_full.md','w').write('\n'.join(out));print('\n'.join(out))
