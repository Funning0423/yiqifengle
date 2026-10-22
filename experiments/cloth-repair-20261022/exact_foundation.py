"""Exact rational micro-geometry foundation, not a production mesh/CCD validator.
Units: mm. Triangle winding is supplied material orientation, never query-flipped.
Open-domain order and whole-path certificates are intentionally not inferred.
"""
from fractions import Fraction as F
PASS, FAIL, UNRESOLVED, NOT_RUN = 'PASS','FAIL','UNRESOLVED','NOT_RUN'
def vec(p): return tuple(F(x) for x in p)
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def add(a,b): return tuple(x+y for x,y in zip(a,b))
def mul(a,s): return tuple(x*s for x in a)
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def normal(t): return cross(sub(t[1],t[0]),sub(t[2],t[0]))
def proj_bary(p,t):
 u,v,w=sub(t[1],t[0]),sub(t[2],t[0]),sub(p,t[0]);a,b,c=dot(u,u),dot(u,v),dot(v,v);den=a*c-b*b
 if den==0:return None
 d,e=dot(w,u),dot(w,v);s,r=(d*c-e*b)/den,(e*a-d*b)/den
 return (1-s-r,s,r)
def point_segment_d2(p,a,b):
 u,w=sub(b,a),sub(p,a);den=dot(u,u);s=max(F(0),min(F(1),dot(w,u)/den)) if den else F(0);d=sub(p,add(a,mul(u,s)));return dot(d,d)
def point_triangle_d2(p,t):
 n=normal(t);nn=dot(n,n);bc=proj_bary(p,t)
 if bc is not None and min(bc)>=0:return dot(sub(p,t[0]),n)**2/nn
 return min(point_segment_d2(p,t[i],t[(i+1)%3]) for i in range(3))
def segment_segment_d2(a,b,c,d):
 u,v,w=sub(b,a),sub(d,c),sub(a,c);aa,bb,cc,dd,ee=dot(u,u),dot(u,v),dot(v,v),dot(u,w),dot(v,w);den=aa*cc-bb*bb
 candidates=[point_segment_d2(a,c,d),point_segment_d2(b,c,d),point_segment_d2(c,a,b),point_segment_d2(d,a,b)]
 if den:
  s,t=(bb*ee-cc*dd)/den,(aa*ee-bb*dd)/den
  if 0<=s<=1 and 0<=t<=1:
   q=sub(add(a,mul(u,s)),add(c,mul(v,t)));candidates.append(dot(q,q))
 return min(candidates)
def segment_pierces_triangle(a,b,t):
 n=normal(t);den=dot(sub(b,a),n)
 if not den:return False
 s=dot(sub(t[0],a),n)/den
 if not 0<=s<=1:return False
 bc=proj_bary(add(a,mul(sub(b,a),s)),t)
 return bc is not None and min(bc)>=0

def finite_triangle_pair(a,b,threshold=F(1,200)):
 a,b=tuple(map(vec,a)),tuple(map(vec,b));threshold=F(threshold)
 if threshold<0:raise ValueError('Negative threshold forbidden')
 if dot(normal(a),normal(a))==0 or dot(normal(b),normal(b))==0:return dict(status=UNRESOLVED,reason='Degenerate triangle')
 if any(segment_pierces_triangle(t[i],t[(i+1)%3],other) for t,other in [(a,b),(b,a)] for i in range(3)):d2=F(0)
 else:d2=min([point_triangle_d2(p,b) for p in a]+[point_triangle_d2(p,a) for p in b]+[segment_segment_d2(a[i],a[(i+1)%3],b[j],b[(j+1)%3]) for i in range(3) for j in range(3)])
 return dict(status=PASS if d2>=threshold**2 else FAIL,distance_squared_mm2=str(d2),threshold_mm=str(threshold),scope='One nondegenerate finite triangle pair only; no ordering or time proof')

def oriented_face_side(p,t,spacing=F(1,20)):
 """Certified side for a unique known material face with strict interior projection.
 Does NOT establish nearest-face uniqueness, patch ownership, topology or continuity.
 """
 p,t,spacing=vec(p),tuple(map(vec,t)),F(spacing)
 if spacing<0:raise ValueError('Negative spacing forbidden')
 n=normal(t);nn=dot(n,n);bc=proj_bary(p,t)
 if not nn:return dict(status=UNRESOLVED,reason='Degenerate material triangle')
 if min(bc)<=0:return dict(status=UNRESOLVED,reason='Boundary/outside projection requires valid chart and ownership proof')
 signed=dot(sub(p,t[0]),n)
 return dict(status=PASS if signed>=0 and signed*signed>=spacing*spacing*nn else FAIL,signed_numerator=str(signed),normal_squared=str(nn),projection_barycentric=list(map(str,bc)),scope='Conditional unique interior material-face side, not global open-surface inside')
def combine_feature_ties(statuses):
 if not statuses or NOT_RUN in statuses or UNRESOLVED in statuses:return UNRESOLVED
 if all(s==PASS for s in statuses):return PASS
 if all(s==FAIL for s in statuses):return FAIL
 return UNRESOLVED

def protected_offsets(offsets,expected_count=195):
 # Conditional offset-only check; material vertex identities need separate evidence.
 try:
  if len(offsets)!=expected_count or any(isinstance(row,(str,bytes)) or len(row)!=3 for row in offsets):return UNRESOLVED
  values=[F(c) for row in offsets for c in row]
 except (TypeError,ValueError,ZeroDivisionError,OverflowError):return UNRESOLVED
 return PASS if all(c==0 for c in values) else FAIL

def acceptance_status(obligations):
 """Only a completeness ledger; callers must provide independently valid evidence."""
 required={'input_identity','topology_orientation','legal_initial_state','body_finite','layer_finite','layer_order','layer_domain','source_material','protected','correction_path','actual_time_path','visual'}
 if FAIL in obligations.values():return FAIL
 if required-set(obligations):return NOT_RUN
 if UNRESOLVED in obligations.values():return UNRESOLVED
 if NOT_RUN in obligations.values():return NOT_RUN
 return PASS if all(s==PASS for s in obligations.values()) else UNRESOLVED
