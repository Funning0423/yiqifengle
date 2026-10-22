import json,sys
r=json.load(open(sys.argv[1]));IGN={'L_HANDR_grip','ARML_TORSO'}
agg={}
for x in r:
    for k,v in x.items():
        if isinstance(v,int) and k!='f' and v>0 and k not in IGN:agg.setdefault(k,[0,0,None]);agg[k][0]+=1;agg[k][1]=max(agg[k][1],v);agg[k][2]=agg[k][2] or (x['clip'],x['f'])
print('hits',agg)
for k in ('L_floor_mm','DRESS_floor_mm','APRON_floor_mm','BODY_floor_mm'):print(k,min(x.get(k,9e9) for x in r))
print('ARML_TORSO max',max(x.get('ARML_TORSO',0) for x in r),'lean max',max(x['lean_deg'] for x in r),'abd max',max(x['abd'] for x in r),'wrist_twist max',max(x['wrist_twist'] for x in r))
