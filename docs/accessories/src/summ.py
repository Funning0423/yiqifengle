import json,sys,collections
def load(p): return json.load(open(p))
out=[]
def tab(rows,keys,title):
    out.append(f'\n### {title}\n| run | clip | 帧 | '+' | '.join(keys)+' |\n|'+'---|'*(len(keys)+3))
    g=collections.OrderedDict()
    for r in rows: g.setdefault((r['run'],r['clip']),[]).append(r)
    for (run,c),x in g.items():
        cells=[]
        for k in keys:
            v=[r[k] for r in x if k in r]
            cells.append('—' if not v else (f'{max(v)}/{sum(a>0 for a in v)}' if max(v) else '0'))
        out.append(f'| {run} | {c} | {len(x)} | '+' | '.join(cells)+' |')
SK=['S_FACE','S_CHIN','S_HAIR','S_HAT','S_ARM','S_TORSO','S_APRON','S_RIBBON','S_DRESS']
LK=['L_LEG','L_DRESS','L_APRON','L_TORSO','L_BOW','L_SCARF']
BK=['B_HAIRxTORSO','B_CHINxTORSO']
b=load('qa_base.json');w=load('qa_wind.json');l=load('qa_limits.json');rg=load('qa_rigid.json')
tab(b,BK,'基线（ribbonwind，无配件）：原有头发/下巴×躯干')
tab([r for r in w if r['run']=='W0'],SK+BK,'围巾 W=0 全片段')
tab([r for r in w if r['run']!='W0'],SK,'围巾 风 0.5/1.0（顶风=后摆，顺风=前摆）')
tab(l,SK,'围巾 摆幅上限静态偏置（叠在动画上）')
tab([r for r in w if r['run']=='W0' and 'L_LEG' in r],LK,'提灯 竖直下垂（钟摆静止位），吊环 6cm，socket 按规格')
tab(rg,LK,'提灯 刚性跟手（参考）')
open('QA_TABLES.md','w').write('\n'.join(out));print('\n'.join(out))
