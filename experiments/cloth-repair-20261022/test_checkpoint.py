"""Small synthetic integration checks, not character acceptance."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import numpy as np
from finite_scan import scan

class CheckpointTests(unittest.TestCase):
    def test_finite_scan_fail_and_separation(self):
        a = np.array([[[0., 0., 0.], [1., 0., 0.], [0., 1., 0.]]])
        self.assertEqual(scan(a, a)['status'], 'FAIL')
        self.assertEqual(scan(a, a + [0., 0., 1.])['status'], 'PASS')

    def test_kinematics_synthetic_constant_curve(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / 'curve.npz'
            x = np.zeros((2, 1, 3))
            np.savez(p, times_s=np.array([0., 1.]), apron_D_m=x, apron_V_mps=x,
                     dress_D_m=x, dress_V_mps=x)
            subprocess.run([sys.executable, '-B', str(Path(__file__).with_name('audit_curve_kinematics_v4.py')), '--curve', str(p)], check=True, capture_output=True)
            result = json.loads((p.parent / 'KINEMATICS_V4.json').read_text())
            self.assertEqual(result['source_A_status'], 'CERTIFIED_IDEAL_SOURCE_A1000')
            self.assertLess(result['source_A_upper_mps2'], 1e-100)

if __name__ == '__main__':
    unittest.main()
