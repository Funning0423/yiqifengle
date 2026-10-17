import json,sys,math,numpy as np
A=json.load(open(sys.argv[1])); B=json.load(open(sys.argv[2]))
def ang(q1,q2):
    d=abs(sum(x*y for x,y in zip(q1,q2))); return math.degrees(2*math.acos(min(1,d)))
out={}
for clip in ('cine_open_stand','cine_open_turn'):
    a,b=A[clip],B[clip]; bones=a[0]['bones'].keys()
    pos=max(np.linalg.norm(np.array(a[f]['bones'][k][:3])-np.array(b[f]['bones'][k][:3])) for f in range(len(a)) for k in bones)
    rot=max(ang(a[f]['bones'][k][3:],b[f]['bones'][k][3:]) for f in range(len(a)) for k in bones)
    def vel(S): return {k:[ang(S[f]['bones'][k][3:],S[f+1]['bones'][k][3:]) for f in range(len(S)-1)] for k in bones}
    va,vb=vel(a),vel(b)
    def acc(v): return max(abs(v[f+1]-v[f]) for f in range(len(v)-1))
    out[clip]={'max_bone_pos_diff_mm':round(pos*1000,3),'max_bone_rot_diff_deg':round(rot,4),
      'max_ang_vel_deg_per_frame':{'before':round(max(max(v) for v in va.values()),3),'after':round(max(max(v) for v in vb.values()),3)},
      'max_ang_accel_deg_per_frame2 (pop check)':{'before':round(max(acc(v) for v in va.values()),3),'after':round(max(acc(v) for v in vb.values()),3)},
      'per_bone_max_vel_after_minus_before':{k:round(max(vb[k])-max(va[k]),4) for k in bones if abs(max(vb[k])-max(va[k]))>0.01}}
print(json.dumps(out,indent=1))
