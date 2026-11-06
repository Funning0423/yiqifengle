#!/usr/bin/env python3
"""Close-ups of the t=3 cable ends in the envelope mouth. Pose replay, not Cocos."""
from __future__ import annotations

import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "product/2026-11-05/balloon-inflate/r2"


def main():
    spec = importlib.util.spec_from_file_location("r2", HERE / "render_balloon_clearance_r2.py")
    r2 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(r2)
    R = r2.load_render()
    js, blob = R.load_glb(R.GLB)
    images, world_of = R.gather(js, blob)
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    pose = r2.after_poses([3.0])[0]
    shots = [
        ("mouth-joint-side", (1.25, 2.72, 0.42), (0.55, 3.06, 0.0), 18, "缆绳端侧面"),
        ("mouth-joint-quarter", (1.55, 2.85, 1.35), (0.15, 3.08, 0.0), 26, "八个接头"),
        ("mouth-joint-up", (1.05, 2.35, 0.85), (0.15, 3.15, 0.0), 32, "仰视球嘴"),
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    for name, eye, at, fov, label in shots:
        img = R.label(r2.shoot(R, js, blob, images, world_of, names, pose, eye, at, fov, False), f"t=3 {label}")
        img.save(OUT / f"{name}.png")
        print(name, img.size)


if __name__ == "__main__":
    main()
