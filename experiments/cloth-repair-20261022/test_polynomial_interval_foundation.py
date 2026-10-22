import unittest,numpy as np
from fractions import Fraction as F
from polynomial_interval_foundation import *
class Tests(unittest.TestCase):
 def test_positive_inside_minimum(self):self.assertEqual(certify(I(np.array([[.3,-1,1.]])))['status'],'CERTIFIED_IDEAL_POLYNOMIAL')
 def test_negative_inside(self):self.assertEqual(certify(I(np.array([[.2,-1,1.]])),max_depth=10)['status'],'FAIL')
 def test_negative_endpoint(self):self.assertEqual(certify(I(np.array([[-.01,1.]])),max_depth=10)['status'],'FAIL')
 def test_zero_not_pass(self):self.assertEqual(certify(I(np.array([[0.]])),max_depth=3)['status'],'UNRESOLVED')
 def test_rational_enclosures(self):
  for q in[F(1,3),F(1,10),F(-1,3),F(10**30,3)]:
   l,h=rat(q);self.assertLessEqual(F(float(l)),q);self.assertGreaterEqual(F(float(h)),q)
 def test_bernstein_and_split(self):
  rng=np.random.default_rng(18)
  for degree in range(1,13):
   p=rng.normal(size=(5,degree+1));b=bernstein(I(p));left,right=split(b)
   for k in range(5):
    for u in[F(0),F(1,7),F(1,2),F(4,7),F(1)]:
     v=sum(F(float(c))*u**i for i,c in enumerate(p[k]));cell=left if u<=F(1,2)else right;self.assertLessEqual(F(float(cell[0][k].min())),v);self.assertGreaterEqual(F(float(cell[1][k].max())),v)
 def test_cos_threshold(self):
  l,h=cos25_interior();v=np.cos(np.deg2rad(25)-1e-10);self.assertLess(abs(float(l)-v),1e-15);self.assertLess(abs(float(h)-v),1e-15);self.assertLessEqual(l,h)
 def test_pmul_exact_points(self):
  a=I(np.array([[.1,.2,.3]]));b=I(np.array([[.4,-.5]]));p=pmul(a,b)
  for k in range(4):
   val=sum(F(float(a[0][0,i]))*F(float(b[0][0,j]))for i in range(3)for j in range(2)if i+j==k);self.assertLessEqual(F(float(p[0][0,k])),val);self.assertGreaterEqual(F(float(p[1][0,k])),val)
if __name__=='__main__':unittest.main()
