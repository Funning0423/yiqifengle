import json,math,sys
F=[dict(f,h=(f['hT'] if f.get('hT') is not None else f['top']-f['yMin'])) for f in json.load(open('/workspace/tmp-exp/dec/props_clusters.json'))]
F=[f for f in F if f['r']<2 and f['h']>0.3 and not any(w in f['label'] for w in('rock','bench','fence'))]
for fn in sys.argv[1:]:
  print(fn)
  for e in json.load(open(fn))['island']['edges']:
    hits=[]
    for i,p in enumerate(e['path']):
      for f in F:
        d=math.hypot(p[0]-f['x'],p[2]-f['z'])-(f['r']+.15)
        if d<0:hits.append((i,p,f['label'],f['x'],f['z'],f['r'],round(f['h'],2),round(d,3)))
    print(' ',e['a']+'-'+e['b'],len(e['path']),hits)
