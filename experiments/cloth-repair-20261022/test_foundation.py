import unittest
from exact_foundation import *
def triangle(z=0):return tuple(vec(p) for p in [(-2,-2,z),(2,-2,z),(0,2,z)])
def old_mixed(p0,p1,d1):
 d=abs(p0-d1)
 if d==0:raise ValueError('Old normal undefined')
 n=(p0-d1)/d
 return d-min(d,F(1,20))+n*(p1-p0)
class FoundationTests(unittest.TestCase):
 def test_old_false_negative_common_outward(self):
  self.assertEqual(old_mixed(F(1),F(3),F(2)),F(-21,20));self.assertEqual(oriented_face_side(vec((0,0,3)),triangle(2))['status'],PASS)
 def test_old_false_positive_reversed(self):
  self.assertEqual(old_mixed(F(1),F(1),F(2)),F(19,20));self.assertEqual(oriented_face_side(vec((0,0,1)),triangle(2))['status'],FAIL)
 def test_unsigned_not_order(self):
  self.assertEqual(finite_triangle_pair(triangle(1),triangle(2))['status'],PASS);self.assertEqual(finite_triangle_pair(triangle(3),triangle(2))['status'],PASS)
 def test_twenty_microns_not_fifty(self):
  self.assertEqual(finite_triangle_pair(triangle(),triangle(F(1,50)))['status'],PASS);self.assertEqual(finite_triangle_pair(triangle(),triangle(F(1,50)),F(1,20))['status'],FAIL);self.assertEqual(oriented_face_side(vec((0,0,F(1,50))),triangle())['status'],FAIL)
 def test_threshold_equality_no_epsilon(self):
  self.assertEqual(finite_triangle_pair(triangle(),triangle(F(1,200)))['status'],PASS);self.assertEqual(finite_triangle_pair(triangle(),triangle(F(1,200)-F(1,10**20)))['status'],FAIL)
 def test_transverse_intersection(self):
  t=tuple(vec(p) for p in [(0,0,-1),(0,0,1),(0,1,1)]);self.assertEqual(finite_triangle_pair(triangle(),t)['distance_squared_mm2'],'0')
 def test_coplanar_overlap_and_disjoint(self):
  self.assertEqual(finite_triangle_pair(triangle(),triangle())['status'],FAIL);far=tuple(add(p,vec((10,0,0))) for p in triangle());self.assertEqual(finite_triangle_pair(triangle(),far)['status'],PASS)
 def test_orientation_rigid_transform(self):
  def rigid(p):return add((p[0],-p[2],p[1]),vec((2,3,4)))
  self.assertEqual(oriented_face_side(rigid(vec((0,0,1))),tuple(rigid(p) for p in triangle()))['status'],PASS)
 def test_degenerate(self):
  t=(vec((0,0,0)),)*3;self.assertEqual(oriented_face_side(vec((0,0,1)),t)['status'],UNRESOLVED);self.assertEqual(finite_triangle_pair(t,triangle())['status'],UNRESOLVED)
 def test_feature_ties(self):
  self.assertEqual(combine_feature_ties([PASS,PASS]),PASS);self.assertEqual(combine_feature_ties([PASS,FAIL]),UNRESOLVED);self.assertEqual(combine_feature_ties([]),UNRESOLVED)
 def test_boundary_is_not_inside_certificate(self):
  self.assertEqual(oriented_face_side(vec((0,2,1)),triangle())['status'],UNRESOLVED);self.assertEqual(oriented_face_side(vec((3,0,1)),triangle())['status'],UNRESOLVED)
 def test_temporal_and_correction_endpoint_trap(self):
  g=lambda s:1-8*s*(1-s)
  self.assertEqual(g(F(0)),1);self.assertEqual(g(F(1)),1);self.assertEqual(g(F(1,2)),-1);self.assertLess(g(F(1,4)),0) # polynomial continuity proves a zero in (0,1/4)
 def test_open_boundary_escape_requires_domain_guard(self):
  # Square [-1,1]^2 at z=0; each segment stays >=1mm away, but endpoints swap side.
  path=[vec(p) for p in [(0,0,1),(2,0,1),(2,0,-1),(0,0,-1)]]
  self.assertTrue(path[0][2]>0 and path[-1][2]<0)
  self.assertTrue(path[1][0]>1 and path[2][0]>1)
  self.assertEqual(oriented_face_side(path[1],triangle())['status'],UNRESOLVED)
 def test_protected_exact(self):
  q=[(0,0,0)]*195;self.assertEqual(protected_offsets(q),PASS);q[-1]=(0,0,F(1,10**30));self.assertEqual(protected_offsets(q),FAIL);self.assertEqual(protected_offsets(q[:-1]),UNRESOLVED)
 def test_malformed_protected_offsets_unresolved(self):
  self.assertEqual(protected_offsets([()]*195),UNRESOLVED);self.assertEqual(protected_offsets([(0,0,None)]*195),UNRESOLVED)
 def test_fail_not_hidden_by_missing_obligations(self):
  self.assertEqual(acceptance_status({'body_finite':FAIL}),FAIL)
 def test_reversed_winding_changes_side_not_distance(self):
  t=triangle();rev=(t[0],t[2],t[1]);self.assertEqual(oriented_face_side(vec((0,0,1)),rev)['status'],FAIL);self.assertEqual(finite_triangle_pair(t,triangle(1)),finite_triangle_pair(rev,triangle(1)))
 def test_negative_thresholds_rejected(self):
  with self.assertRaises(ValueError):finite_triangle_pair(triangle(),triangle(1),F(-1))
  with self.assertRaises(ValueError):oriented_face_side(vec((0,0,1)),triangle(),F(-1))
 def test_missing_real_mesh_obligations_not_pass(self):
  self.assertEqual(acceptance_status({'body_finite':PASS,'layer_finite':PASS}),NOT_RUN)
if __name__=='__main__':unittest.main(verbosity=2)
