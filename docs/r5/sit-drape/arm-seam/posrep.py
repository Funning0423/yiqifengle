import os, json
exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
PB = arm.pose.bones; MW = arm.matrix_world; setclip('sit_hold'); place('sit_hold', 0); r = {}
for s in 'LR':
    r['wrist' + s] = list(MW @ PB['hand.' + s].head); r['handtip' + s] = list(MW @ PB['hand.' + s].tail)
    for b in ('thigh', 'shin', 'foot'):
        v = (MW @ PB[b + '.' + s].tail - MW @ PB[b + '.' + s].head).normalized(); r[b + s + '_pitch_deg'] = math.degrees(math.asin(-v.z)); r[b + s + '_dir'] = list(v)
t = {c: {k: interp(v, (1.2 if c == 'sit_down' else 0)) for k, v in MC[c].items()} for c in ('sit_down', 'sit_hold', 'stand_up')}
ks = set().union(*[set(x) for x in t.values()]); r['morph_diff'] = {k: [round(t[c].get(k, 0), 4) for c in ('sit_down', 'sit_hold', 'stand_up')] for k in sorted(ks) if len(set(round(t[c].get(k, 0), 4) for c in t)) > 1}
json.dump(r, open(os.environ['ROUT'], 'w'), indent=1); print('POS', json.dumps(r))
