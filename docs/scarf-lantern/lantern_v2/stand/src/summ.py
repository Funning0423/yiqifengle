import json,sys
r=json.load(open(sys.argv[1]));IGN={'L_HANDR_grip','ARML_TORSO'}
agg={}
for x in r:
    for k,v in x.items():
        if isinstance(v,int) and k!='f' and v>0 and k not in IGN:agg.setdefault(k,[0,0,None]);agg[k][0]+=1;agg[k][1]=max(agg[k][1],v);agg[k][2]=agg[k][2] or (x['clip'],x['f'])
print('hits',agg)
for k in ('L_floor_mm','DRESS_floor_mm','APRON_floor_mm','BODY_floor_mm'):print(k,min(x.get(k,9e9) for x in r))
print('ARML_TORSO max',max(x.get('ARML_TORSO',0) for x in r),'lean max',max(x['lean_deg'] for x in r),'abd max',max(x['abd'] for x in r),'wrist_twist max',max(x['wrist_twist'] for x in r))

print('cloth_plat_gap min',min(x.get('cloth_plat_gap_mm',9e9) for x in r),'L_above_top min',min(x.get('L_above_top_mm',9e9) for x in r))
print('hand_vs_ground@attach',[ (x['clip'],x['f'],x.get('hand_vs_ground_deg'),x.get('sock_vs_T_mm')) for x in r if x['run']=='W0' and x['f'] in (30,31,32,33,34,35)])
print('grip_rel max',max((x.get('grip_rel_deg') or 0) for x in r),'pend max',max(abs(x.get('pend_deg') or 0) for x in r))
