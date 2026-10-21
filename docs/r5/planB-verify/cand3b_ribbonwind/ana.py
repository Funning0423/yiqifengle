import json,sys,collections
base={(r['kind'],r['name'],r['f']):r for r in json.load(open(sys.argv[1]))}
K=['HxA','HxD','DxB','AxB','WxD','WxA','WxB','WxH','DxA']
bad=collections.defaultdict(lambda:collections.defaultdict(int))
for fn in sys.argv[2:]:
  for r in json.load(open(fn)):
    b=base[(r['kind'],r['name'],r['f'])]
    for k in K:
      zero_rule = k in ('HxA','HxD','WxD','WxA','WxB','WxH')
      v=r[k]
      if (zero_rule and v>0) or (not zero_rule and v>b[k]):
        bad[r['name']][k]=max(bad[r['name']][k],v)
for n,d in bad.items(): print(n,dict(d))
print('FAILS',len(bad))
