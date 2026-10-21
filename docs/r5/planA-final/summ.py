import json,sys
K=['DRESSxStool','APRONxStool','BOWxStool','BODYxStool','DRESSxBODY','APRONxBODY','DRESSxAPRON','HANDxAPRON','HANDxDRESS','HANDxBODY']
for p in sys.argv[1:]:
  R=json.load(open(p));print('#',p.split('/')[-1])
  for c in ['sit_down','sit_hold','stand_up']:
    r=[x for x in R if x['clip']==c];print(c,' '.join(f"{k}={max(x[k] for x in r)}/{sum(x[k] for x in r)}" for k in K))
