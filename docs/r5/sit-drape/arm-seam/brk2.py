exec(open('arm_seam/brk.py').read().split('for c, f in')[0])
for c,f in (('sit_down',36),('stand_up',0)):
    P=ORIG[c][f]
    d=sorted(((math.degrees(P[k][1].rotation_difference(HOLD[k][1]).angle) if True else 0, (P[k][0]-HOLD[k][0]).length*1000, k) for k in P), reverse=True)[:8]
    print('DIFF',c,[(round(a,1),round(l,1),k) for a,l,k in d])
    Q=dict(P); Q.update({k:HOLD[k] for k in P if k.startswith(ARMB)})
    setroot(c,f); morphs(c,f); arm.animation_data.action=None; setpose(Q); print('BRKQ',c,f,brk())
