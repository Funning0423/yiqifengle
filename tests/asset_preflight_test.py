import json, sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from asset_preflight import read_glb

class CandidateTests(unittest.TestCase):
    def test_suppression_keeps_binary_skin_and_transforms(self):
        root = Path(__file__).resolve().parents[1]
        source = root / 'inputs/interior-v2.1.0/GROKBOT-ART-001-INTERIOR-v2.1.0/scene/env_interior_assembled.glb'
        output = root / 'creator-project/assets/preflight/interior-preflight-no-proxy-render.glb'
        a, ac = read_glb(source); b, bc = read_glb(output)
        self.assertEqual(ac[1:], bc[1:])
        for key in ['meshes', 'skins', 'animations', 'accessors', 'scenes']:
            self.assertEqual(a.get(key), b.get(key))
        report = json.loads((output.parent / 'asset-preflight.json').read_text())
        self.assertEqual(len(report['suppressed_mesh_bindings']), 15)
        for binding in report['suppressed_mesh_bindings']:
            self.assertNotIn('mesh', b['nodes'][binding['node_index']])
        for old, new in zip(a['nodes'], b['nodes']):
            for key in ['translation', 'rotation', 'scale', 'matrix', 'children']:
                self.assertEqual(old.get(key), new.get(key))

if __name__ == '__main__': unittest.main()
