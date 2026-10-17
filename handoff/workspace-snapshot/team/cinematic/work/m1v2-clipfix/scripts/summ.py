import json,sys,collections
d=json.load(open(sys.argv[1]))
M=collections.OrderedDict()
for r in d['frames']:
    for k,v in r.items():
        if not isinstance(v,dict): continue
        m=M.setdefault(k,{'max':-1e9,'at':None,'pen_frames':[], 'pairs_frames':[]})
        if v['depth_mm']>m['max']: m['max']=v['depth_mm']; m['at']=(r['clip'],r['frame'],v.get('worst_loc'))
        if v['depth_mm']>0: m['pen_frames'].append(f"{r['clip'][9:]}{r['frame']}")
        if v.get('tri_pairs',0)>0: m['pairs_frames'].append(r['frame'])
for k,m in M.items():
    pf=m['pen_frames']; print(f"{k:28s} max {m['max']:8.2f} mm at {m['at'][0]} f{m['at'][1]}  pen-frames {len(pf)} {pf[:3]}..{pf[-2:] if pf else ''} triPairFrames {len(m['pairs_frames'])}")
