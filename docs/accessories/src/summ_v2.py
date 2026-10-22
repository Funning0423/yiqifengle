import json,collections,os
os.chdir(os.path.dirname(os.path.abspath(__file__))+'/../qa/v2')
K=['L_LEG','L_DRESS','L_APRON','L_TORSO','L_BOW','L_SCARF','C_DRESSxBODY','C_APRONxBODY','C_DRESSxAPRON']
out=['| 姿态 | 片段 | 帧 | '+' | '.join(f'{k} 关→开' for k in K)+' |','|'+'---|'*(len(K)+3)]
for mode in ('hang','rigid','swing'):
  a=json.load(open(f'off_{mode}.json'));b=json.load(open(f'on_{mode}.json'))
  ga=collections.OrderedDict();gb=collections.defaultdict(list)
  for x in a: ga.setdefault(x['clip'],[]).append(x)
  for x in b: gb[x['clip']].append(x)
  f=lambda v,k:(lambda l:'0' if max(l)==0 else f'{max(l)}/{sum(i>0 for i in l)}')([r[k] for r in v])
  for c,v in ga.items():
    w=gb[c];out.append(f'| {mode} | {c} | {len(v)} | '+' | '.join(f'{f(v,k)}→{f(w,k)}' for k in K)+' |')
open('QA_v2.md','w').write('\n'.join(out));print('\n'.join(out))
