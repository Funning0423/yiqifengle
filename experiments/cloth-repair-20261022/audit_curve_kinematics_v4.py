"""Outward ideal Hermite source acceleration and speed bounds; not world/step acceptance."""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
from polynomial_interval_foundation import I,sub,add,mul,div,dot,sqrt
np.seterr(over='raise',invalid='raise',divide='raise',under='ignore')
p=argparse.ArgumentParser();p.add_argument('--curve',required=True);args=p.parse_args();cp=Path(args.curve);z=np.load(cp);rows=[];common=z['times_s'];assert common.ndim==1 and len(common)>=2 and np.isfinite(common).all() and np.all(np.diff(common)>0)
def norm_upper(v):
 assert np.isfinite(v[0]).all() and np.isfinite(v[1]).all();a=np.maximum(abs(v[0]),abs(v[1]));ss=dot(I(a),I(a));return sqrt((np.maximum(ss[0],0),ss[1]))[1]
for short in ['apron','dress']:
 ts=z[short+'_times_s']if short+'_times_s'in z.files else z['times_s'];P=z[short+'_D_m'];V=z[short+'_V_mps'];assert ts.ndim==1 and len(ts)>=2 and ts[0]==common[0] and ts[-1]==common[-1] and set(common).issubset(set(ts));assert P.shape==V.shape==(len(ts),P.shape[1],3) and np.isfinite(P).all() and np.isfinite(V).all() and np.isfinite(ts).all() and np.all(np.diff(ts)>0)
 for i in range(len(ts)-1):
  h=sub(I(ts[i+1]),I(ts[i]));d=sub(I(P[i+1]),I(P[i]));q=div(mul(I(6),d),mul(h,h));a0=sub(q,div(add(mul(I(4),I(V[i])),mul(I(2),I(V[i+1]))),h));a1=sub(div(add(mul(I(2),I(V[i])),mul(I(4),I(V[i+1]))),h),q);aa=np.array([norm_upper(a0),norm_upper(a1)]);vm=sub(div(mul(I(3),d),h),add(I(V[i]),I(V[i+1])));vv=np.array([norm_upper(I(V[i])),norm_upper(vm),norm_upper(I(V[i+1]))]);assert np.isfinite(aa).all() and np.isfinite(vv).all();rows.append(dict(mesh=short,interval=i,times_s=ts[i:i+2].tolist(),source_A_upper_mps2=float(aa.max()),worst_acceleration_side_vertex=list(map(int,np.unravel_index(np.argmax(aa),aa.shape))),source_speed_upper_mps=float(vv.max())))
r=dict(code_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),curve_sha256=hashlib.sha256(cp.read_bytes()).hexdigest(),source_A_status='CERTIFIED_IDEAL_SOURCE_A1000'if max(x['source_A_upper_mps2']for x in rows)<=1000 else'FAIL',source_A_upper_mps2=max(x['source_A_upper_mps2']for x in rows),source_speed_upper_mps=max(x['source_speed_upper_mps']for x in rows),intervals=rows,definition='Exact real Hermite from stored binary64 nodes/times/shared velocities; acceleration is affine, norm bounded at both endpoints with outward arithmetic. Speed bounded by quadratic Bezier derivative controls, not claimed exact maximum.',scope='No world A/C1, correction-step, float evaluator, material or collision acceptance. Speed is reported, not a fabricated hard cap.');(cp.parent/'KINEMATICS_V4.json').write_text(json.dumps(r,indent=2));print(r['source_A_status'],r['source_A_upper_mps2'],r['source_speed_upper_mps'])
