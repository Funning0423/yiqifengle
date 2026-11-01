exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
PB = arm.pose.bones
def pose(c, f):
    setclip(c); sc.frame_set(f); return {b.name: (b.rotation_quaternion.copy(), b.location.copy()) for b in PB}
A = pose('sit_down', 36); B = pose('sit_hold', 0); C = pose('stand_up', 0)
for nm, X in (('sit_down_end_vs_hold', A), ('stand_up_f0_vs_hold', C)):
    d = sorted(((round(math.degrees(X[k][0].rotation_difference(B[k][0]).angle), 2), round((X[k][1] - B[k][1]).length * 1000, 2), k) for k in B), reverse=True)[:8]
    print('SEAM', nm, d)
