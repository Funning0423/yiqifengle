import json,sys,collections
for f in sys.argv[1:]:
  S=json.load(open(f));print('==',f)
  prev=None;seg=collections.OrderedDict();lt=None
  for r in S:
    t,dc,tr,d,tot,ph,st=r[:7];sun=tuple(r[11]) if r[11] else None
    if sun!=prev: print('  sun change t=%.0f st=%s ph=%s d=%.2f sun=%s'%(t,st,ph,d,sun));prev=sun
    key=st if st!='region-travel' else 'travel:'+str(ph)
    g=seg.setdefault(key,{'n':0,'dts':[],'dc':[]});g['n']+=1;g['dc'].append(dc)
    if lt is not None:g['dts'].append((t-lt,t))
    lt=t
  for k,g in seg.items():
    dts=sorted(g['dts'],reverse=True)[:3];dc=sorted(g['dc'])
    print('  %-16s n=%4d DC med %d max %d  top frames %s  >16.7:%d'%(k,g['n'],dc[len(dc)//2],dc[-1],[('%.1f'%a,int(b)) for a,b in dts],sum(1 for a,b in g['dts'] if a>16.7*1.05)))
