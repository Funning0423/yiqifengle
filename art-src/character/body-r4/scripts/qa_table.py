# python3 qa_table.py <qa_clash.json> [--md]  -> per clip: non-zero overlaps and gaps below 6 mm (apron->dress below 8 mm)
import json,sys
d=json.load(open(sys.argv[1])); md='--md' in sys.argv
SIT=('sit_down','sit_hold','stand_up')
rows=[]
for clip,v in d.items():
    ov=v.get('overlap_max',v.get('overlap',{})); gp=v.get('min_gap_mm',{})
    o={k:(x[0] if isinstance(x,list) else x) for k,x in ov.items()}; o={k:x for k,x in o.items() if x}
    g={k:(x[0] if isinstance(x,list) else x) for k,x in gp.items()}
    low={k:x for k,x in g.items() if k not in('apron->dress_max','belt->dress') and x<(8 if k=='apron->dress' else 6)}
    mins={k:g.get(k) for k in ('sleeve_L->apron','sleeve_R->apron','hand_L->apron','hand_R->apron','hand_L->dress','hand_R->dress','legs->dress','apron->dress','collar->skull','hat->torso')}
    rows.append((clip,o,low,mins))
if md:
    print('| 片段 | 最小间隙 mm：袖→围裙 L/R | 手→围裙 L/R | 手→裙 L/R | 腿→裙 | 围裙→裙 | 领→颅 | 穿插三角对 |'); print('|---|---|---|---|---|---|---|---|')
    for clip,o,low,m in rows:
        ostr=', '.join(f'{k} {x}' for k,x in o.items()) or '0'
        print(f"| {clip} | {m['sleeve_L->apron']} / {m['sleeve_R->apron']} | {m['hand_L->apron']} / {m['hand_R->apron']} | {m['hand_L->dress']} / {m['hand_R->dress']} | {m['legs->dress']} | {m['apron->dress']} | {m['collar->skull']} | {ostr} |")
else:
    for clip,o,low,m in rows: print(clip,'\n   OVERLAP',o,'\n   LOW',low)
