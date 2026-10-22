import unittest
import numpy as np
from material_checker import check_material

def grid():
 p=np.array([(x,y,0.) for y in range(5) for x in range(5)]);f=[]
 for y in range(4):
  for x in range(4):
   a=y*5+x;f.extend([[a,a+1,a+6],[a,a+6,a+5]])
 return p,np.array(f)
def hinge(degrees):
 p=np.array([[0.,0,0],[1,0,0],[0,1,0],[0,-1,0]]);q=p.copy();a=np.deg2rad(degrees);q[3]=[0,-np.cos(a),-np.sin(a)]
 return p,q,np.array([[0,1,2],[1,0,3]])
class Tests(unittest.TestCase):
 def test_identity(self):
  p,f=grid();r=check_material(p,p,f);self.assertEqual(r['edge']['failed_edge_ids'],[]);self.assertEqual(r['orientation']['failed_face_ids'],[]);self.assertEqual(r['orientation']['unresolved_face_ids'],[])
 def test_rigid_invariance(self):
  p,f=grid();R=np.array([[0,0,1],[0,1,0],[-1,0,0]]);r=check_material(p,p@R.T+[12,7,2],f)
  self.assertEqual(r['orientation']['failed_face_ids'],[]);self.assertTrue(np.allclose(r['orientation']['ratio_range'],[1,1]));self.assertEqual(r['bend']['failed_edge_ids'],[])
 def test_stretch(self):
  p,f=grid();self.assertTrue(check_material(p,p*1.09,f)['edge']['failed_edge_ids'])
 def test_local_flip(self):
  p,f=grid();q=p.copy();i=10;q[[f[i,0],f[i,1]]]=q[[f[i,1],f[i,0]]];self.assertIn(i,check_material(p,q,f)['orientation']['failed_face_ids'])
 def test_signed_bend_boundaries(self):
  for sign in [-1,1]:
   p,q,f=hinge(sign*(25-1e-5));self.assertEqual(check_material(p,q,f)['bend']['failed_edge_ids'],[])
   p,q,f=hinge(sign*25);self.assertTrue(check_material(p,q,f)['bend']['failed_edge_ids'])
   p,q,f=hinge(sign*(25+1e-5));r=check_material(p,q,f);self.assertTrue(r['bend']['failed_edge_ids']);self.assertAlmostEqual(abs(r['bend']['rows'][0]['signed_change_rad']),np.deg2rad(25+1e-5))
 def test_degenerate_unresolved(self):
  p=np.zeros((3,3));self.assertEqual(check_material(p,p,[[0,1,2]])['status'],'UNRESOLVED')
 def test_area_collapse_fail(self):
  p,f=grid();q=p.copy();q[:,1]=0;r=check_material(p,q,f);self.assertTrue(r['area']['failed_face_ids']);self.assertTrue(r['orientation']['unresolved_face_ids'])
 def test_local_identity_does_not_need_full_component_identity(self):
  p,f=grid();q=p.copy();q[12,2]=.001;r=check_material(p,q,f)
  self.assertGreater(len(r['orientation']['local_identity_transport_faces']),0)
  self.assertEqual(r['orientation']['unresolved_face_ids'],[])
 def test_moved_insufficient_frame_not_identity(self):
  p=np.array([[0.,0,0],[1,0,0],[0,1,0]]);q=p+np.array([1.,2,3]);r=check_material(p,q,[[0,1,2]])
  self.assertEqual(r['orientation']['unresolved_face_ids'],[0]);self.assertEqual(r['orientation']['identity_transport_faces'],[])
 def test_unchanged_face_moved_outer_patch_not_identity(self):
  p,f=grid();q=p.copy();q[7,2]=.001;r=check_material(p,q,f)
  # Face 0 itself unchanged but its edge-adjacent outer vertex 7 changed.
  self.assertNotIn(0,r['orientation']['local_identity_transport_faces'])
 def test_source_not_reset(self):
  p,f=grid();q=p*1.09;self.assertTrue(check_material(p,q,f)['edge']['failed_edge_ids']);self.assertFalse(check_material(q,q,f)['edge']['failed_edge_ids'])
if __name__=='__main__':unittest.main(verbosity=2)
