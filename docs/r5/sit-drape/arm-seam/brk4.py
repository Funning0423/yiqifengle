exec(open('arm_seam/brk.py').read().split('for c, f in')[0])
P=ORIG['sit_down'][36]
for k in P:
    a=P[k][1]; b=HOLD[k][1]; ang=math.degrees(2*math.acos(min(1,abs(a.dot(b))))); l=(P[k][0]-HOLD[k][0]).length*1000
    if ang>.2 or l>.2: print('D',k,round(ang,2),round(l,2))
for name,sel in (('arms+skirt',lambda k:k.startswith(ARMB+('skirt',))),('arms+torso',lambda k:k.startswith(ARMB+('spine','chest','neck','head'))),('arms+skirt+torso',lambda k:k.startswith(ARMB+('skirt','spine','chest','neck','head'))),('all_but_legs_hips',lambda k:not k.startswith(('thigh','shin','foot','hips','root')))):
    Q=dict(P); Q.update({k:HOLD[k] for k in P if sel(k)})
    setroot('sit_down',36); morphs('sit_down',36); arm.animation_data.action=None; setpose(Q); print('T',name,brk())
