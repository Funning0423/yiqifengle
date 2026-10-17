import json,sys,collections
for f in sys.argv[1:]:
  S=json.load(open(f));seg=collections.OrderedDict()
  for t,dc,tr,d,tot,ph,st,heap,tex,buf in S:
    key=(st if st not in('region-travel',) else 'travel:'+str(ph))
    g=seg.setdefault(key,{'n':0,'dc':[],'heap':0,'tex':0,'buf':0,'d0':d,'d1':d,'t0':t,'t1':t})
    g['n']+=1;g['dc'].append(dc);g['heap']=max(g['heap'],heap or 0);g['tex']=max(g['tex'],tex or 0);g['buf']=max(g['buf'],buf or 0);g['d1']=d;g['t1']=t
  print('==',f.split('/')[-1])
  for k,g in seg.items():
    dc=sorted(g['dc']);dur=(g['t1']-g['t0'])/1000
    print('  %-18s frames %4d %5.1fs fps %4.1f dist %s→%s  DC med %d max %d | heap max %.1f MB tex max %.1f MB buf %.1f MB'%(k,g['n'],dur,(g['n']-1)/dur if dur>0 else 0,g['d0'],g['d1'],dc[len(dc)//2],dc[-1],g['heap']/1048576,g['tex']/1048576,g['buf']/1048576))
