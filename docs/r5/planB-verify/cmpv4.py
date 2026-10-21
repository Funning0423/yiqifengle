import json,sys
V=json.load(open('../sit-drape-stool/arm_seam/q5_v4.json'))
for fn in sys.argv[1:]:
  B=json.load(open(fn))
  for c in ('sit_down','stand_up'):
    for k in ('DRESSxBODY','DRESSxAPRON','APRONxBODY'):
      b=[r[k] for r in B if r['clip']==c];v=[r[k] for r in V if r['clip']==c]
      print(fn,c,k,'peak',max(b),max(v),'sum',sum(b),sum(v),'frames over',sum(x>y for x,y in zip(b,v)))
