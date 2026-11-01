exec(open('arm_seam/brk.py').read().split('for c, f in')[0])
for c,f in (('sit_down',36),('sit_hold',0),('stand_up',0)):
    t=f/30; print('MOR',c,{k:round(interp(v,t),3) for k,v in MC[c].items()}, 'root',[round(x,3) for x in (lambda p:[STAND[i]+(SEAT[i]-STAND[i])*p for i in range(3)])(min(1,t/DUR[c]) if c=='sit_down' else (1-min(1,t/DUR[c]) if c=='stand_up' else 1))])
P=ORIG['sit_hold'][0]; Q=dict(P)
for c,f in (('sit_down',36),('stand_up',0)):
    Q=dict(ORIG[c][f]); Q.update({k:HOLD[k] for k in Q if k.startswith(ARMB)})
    setroot('sit_hold',0); morphs('sit_hold',0); arm.animation_data.action=None; setpose(Q); print('HOLDMORPH+',c,'body',brk())
