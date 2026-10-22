"""CPU smoke only: verify the frozen public input and evaluate three poses."""
import argparse
import hashlib
import numpy as np
from pose_evaluator import Asset, DEFAULT_DIR

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--asset-dir', type=__import__('pathlib').Path, default=DEFAULT_DIR)
    args = p.parse_args()
    expected = {
        'character-skirt-v2-normal-h1-cocos-attrs-r1.glb': '8a79b26ec12d4e248abe14310dd75febca433a15097b1f22ea94144cd3f5a592',
        'anim_meta.json': '6d775f7779127f2254aa18f243f7cd2a0fcba177564c8ca1c921eed42684182c',
    }
    for name, digest in expected.items():
        assert hashlib.sha256((args.asset_dir / name).read_bytes()).hexdigest() == digest, name
    a = Asset(args.asset_dir / next(iter(expected)), args.asset_dir / 'anim_meta.json')
    for t in (0., .05345, .1166666667):
        scene, _ = a.pose(t)
        assert scene
        assert all(np.isfinite(m['pos']).all() for m in scene.values())
        print('CPU_SMOKE', t, 'surfaces', len(scene))
    print('Frozen public input only; not a repaired-model, GPU or collision acceptance.')

if __name__ == '__main__':
    main()
