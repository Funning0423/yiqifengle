import json,struct,sys
b=open(sys.argv[1],'rb').read();n=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+n])
T={m['name']:m['extras']['targetNames'] for m in j['meshes'] if m.get('extras',{}).get('targetNames')}
A=json.load(open(sys.argv[2]))
used=set(k for c in A['clips'].values() for k in ((c.get('morph') or {}).get('curves') or {}))
ok=True
for mesh,names in T.items():
  mt=A['morph']['meshes'].get(mesh,{}).get('targets')
  if mt is None: print(mesh,'NOT LISTED; curve keys:',[x for x in names if x in used]);ok=False;continue
  bad=[(k,v,names[v] if v<len(names) else None) for k,v in mt.items() if v>=len(names) or names[v]!=k]
  miss=[(x,i) for i,x in enumerate(names) if x not in mt and x in used]
  nocurve=[x for x in names if x not in used]
  print(mesh,'n',len(names),'bad',bad,'unlisted-with-curve',miss,'keys-without-curve',nocurve); ok&=not bad and not miss
orph=[k for k in used if not any(k in v.get('targets',{}) for v in A['morph']['meshes'].values())]
print('curves with no registered target:',orph);print('PASS' if ok and not orph else 'FAIL')
