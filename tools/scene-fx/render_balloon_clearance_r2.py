#!/usr/bin/env python3
"""r2 evidence: same cameras, before (tip drape, cloth through the rim) and after (basket cap).

Offline clearance is the exact distance from each rim-corner's wood vertices to the
posed envelope triangles. Poses for "after" come from BalloonDrape.ts via the node harness.
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "product/2026-11-05/balloon-inflate/r2"
HERE = Path(__file__).resolve().parent


def load_render():
    spec = importlib.util.spec_from_file_location("bal_render", HERE / "render_balloon_inflate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def rebound(u, k=0.06):
    x = min(1.0, max(0.0, u))
    if x >= 1:
        return 1.0
    s = 1 - x
    return 1 - s ** 3 + k * np.sin(np.pi * x) * x * x * (1 - x) * 6


def seg(t, a, b):
    return max(0.0, min(1.0, (t - a) / (b - a)))


def tip_pose(t):
    """Drape on the merged tip (1fe19f29): no basket radius cap. This is the clipping 'before'."""
    v, h = rebound(seg(t, 0, 1.9)), rebound(seg(t, 0.8, 3.0))
    sy_i, sxz_i = 0.12 + 0.88 * v, 0.55 + 0.45 * h
    u_y, u_x = (sy_i - 0.12) / 0.88, (sxz_i - 0.55) / 0.45
    sy = 0.16 + 0.84 * u_y
    u_s = u_x if u_x > 1 else max(u_x, min(1.0, max(0.0, u_y)) * 0.75)
    sxz = 0.34 + 0.66 * u_s
    mouth = 3.05 if u_y >= 1 else 0.22 + 2.83 * max(0.0, u_y)
    local_y = -3.05 + (mouth - 3.05) - 3.05 * (sy - 1)
    frame_base, frame_top = 1.096175, 3.071971
    tuck = frame_top - 3.05
    want = min(frame_top, mouth + tuck)
    grown = sxz + 1e-6 >= 0.58 and want > frame_base + 0.12
    frame_sy = min(1.0, max(0.0, (want - frame_base) / (frame_top - frame_base))) if grown else 0.0
    visible = frame_sy > 0.02
    flame_y = frame_base + (2.625 - frame_base) * frame_sy if visible else min(mouth + 7.35 * sy - 0.45, max(0.45, mouth + 0.15))
    return {
        "sy": sy, "sxz": sxz, "mouthY": mouth, "localY": local_y,
        "frameVisible": visible, "frameSy": frame_sy, "frameSxz": 1.0,
        "frameLocalY": frame_base * (1 - frame_sy), "flameLocalY": flame_y,
    }


def after_poses(times):
    env = os.environ.copy()
    env["QF_TYPESCRIPT_MODULE"] = env.get("QF_TYPESCRIPT_MODULE", "/tmp/tsmod/node_modules/typescript")
    payload = json.dumps(times)
    script = f"""
const path=require('path');
const H=require('./tools/board-ui/harness.cjs').createHarness();
const D=H.load(path.resolve('creator-build-project/assets/scripts/region/BalloonDrape.ts'));
const times={payload};
const home={{p:{{x:0,y:-3.05,z:0}},s:{{x:1,y:1,z:1}}}};
process.stdout.write(JSON.stringify(times.map(t=>{{
  const p=D.balloonDrapePose(t);
  return Object.assign({{t, localY:D.envelopeLocalY(p, home)}}, p);
}})));
"""
    return json.loads(subprocess.check_output(["node", "-e", script], cwd=ROOT, env=env))


def scene_override(name_to_i, pose, hide_frame):
    env = name_to_i["balloon_envelope"]
    frame = name_to_i["balloon_load_frame"]
    flame = name_to_i["burner_flame"]
    ov = {env: {"translation": [0, pose["localY"], 0], "scale": [pose["sxz"], pose["sy"], pose["sxz"]]}}
    if hide_frame or not pose["frameVisible"]:
        ov[frame] = {"translation": [0, pose["frameLocalY"], 0], "scale": [0.001, 0.001, 0.001]}
    else:
        ov[frame] = {"translation": [0, pose["frameLocalY"], 0], "scale": [pose["frameSxz"], pose["frameSy"], pose["frameSxz"]]}
    ov[flame] = {"translation": [0, pose["flameLocalY"], 0], "scale": [1, 1, 1]}
    return ov


def shoot(R, js, blob, images, world_of, names, pose, eye, target, fov, hide_flame):
    hide = {"burner_flame"} if hide_flame else set()
    if not pose["frameVisible"]:
        hide.add("balloon_load_frame")
    tris = R.build_scene(js, blob, images, world_of, scene_override(names, pose, False), hide)
    img = Image.fromarray(R.render(tris, np.array(eye, float), np.array(target, float), fov))
    return img


def load_cloth_geom(R, js, blob):
    parents = {c: i for i, n in enumerate(js["nodes"]) for c in n.get("children", [])}

    def world(i):
        chain, a, seen = [], i, set()
        while a is not None and a not in seen:
            seen.add(a)
            chain.append(a)
            a = parents.get(a)
        M = np.eye(4)
        for k in reversed(chain):
            M = M @ R.node_matrix(js["nodes"][k])
        return M

    def geom(name):
        i = next(k for k, n in enumerate(js["nodes"]) if n.get("name") == name)
        prim = js["meshes"][js["nodes"][i]["mesh"]]["primitives"][0]
        pos = R.read_acc(js, blob, prim["attributes"]["POSITION"]).astype(np.float64).reshape(-1, 3)
        idx = R.read_acc(js, blob, prim["indices"]).reshape(-1, 3).astype(np.int64)
        M = world(i)
        return (pos @ M[:3, :3].T) + M[:3, 3], idx

    E, Ei = geom("balloon_envelope")
    B, _ = geom("balloon_basket")
    return E, Ei, B[B[:, 1] >= 1.0]


def exact_gaps(E, Ei, rim, pose):
    """Min distance (m) from each rim quadrant's wood vertices (y>=1) to the cloth."""
    sy, sxz, mouth = pose["sy"], pose["sxz"], pose["mouthY"]
    X = E.copy()
    X[:, 0] *= sxz
    X[:, 2] *= sxz
    X[:, 1] = mouth + (E[:, 1] - 3.05) * sy
    T = X[Ei]

    def dist_one(P, a, b, c):
        ab, ac, bc = b - a, c - a, c - b
        ap, bp, cp = P - a, P - b, P - c
        d1, d2 = ap @ ab, ap @ ac
        d3, d4 = bp @ ab, bp @ ac
        d5, d6 = cp @ ab, cp @ ac
        closest = np.empty_like(P)
        mask = np.ones(len(P), bool)
        r = (d1 <= 0) & (d2 <= 0)
        closest[r] = a
        mask[r] = False
        r = (d3 >= 0) & (d4 <= d3) & mask
        closest[r] = b
        mask[r] = False
        vc = d1 * d4 - d3 * d2
        r = (vc <= 0) & (d1 >= 0) & (d3 <= 0) & mask
        v = d1 / np.where(d1 - d3 == 0, 1, d1 - d3)
        closest[r] = (a + np.outer(v, ab))[r]
        mask[r] = False
        r = (d6 >= 0) & (d5 <= d6) & mask
        closest[r] = c
        mask[r] = False
        vb = d5 * d2 - d1 * d6
        r = (vb <= 0) & (d2 >= 0) & (d6 <= 0) & mask
        w = d2 / np.where(d2 - d6 == 0, 1, d2 - d6)
        closest[r] = (a + np.outer(w, ac))[r]
        mask[r] = False
        va = d3 * d6 - d5 * d4
        r = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0) & mask
        w = (d4 - d3) / np.where((d4 - d3) + (d5 - d6) == 0, 1, (d4 - d3) + (d5 - d6))
        closest[r] = (b + np.outer(w, bc))[r]
        mask[r] = False
        denom = np.where(va + vb + vc == 0, 1, va + vb + vc)
        vv, ww = vb / denom, vc / denom
        closest[mask] = a + np.outer(vv, ab)[mask] + np.outer(ww, ac)[mask]
        return np.linalg.norm(P - closest, axis=1)

    def mind(P):
        out = np.full(len(P), np.inf)
        for i in range(len(T)):
            out = np.minimum(out, dist_one(P, T[i, 0], T[i, 1], T[i, 2]))
        return out

    gaps = {}
    for name, sx, sz in (("NE", 1, 1), ("NW", -1, 1), ("SE", 1, -1), ("SW", -1, -1)):
        m = (np.sign(rim[:, 0]) == sx) & (np.sign(rim[:, 2]) == sz)
        gaps[name] = float(mind(rim[m]).min())
    return gaps


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    R = load_render()
    js, blob = R.load_glb(R.GLB)
    images, world_of = R.gather(js, blob)
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    stages = [("deflated", 0.0, "瘪气"), ("mid", 0.45, "充气中"), ("inflated", 3.0, "充满")]
    after = {round(p["t"], 2): p for p in after_poses([0.0, 0.35, 0.45, 0.7, 1.2, 3.0])}
    # fixed cameras. Wide fits the cruise balloon; close stays on the NE rim corner.
    wide_eye, wide_at, wide_fov = (8.6, 7.6, 14.2), (0.0, 4.6, 0.0), 30
    close_eye, close_at, close_fov = (1.45, 1.35, 1.35), (0.45, 0.85, 0.40), 34
    opp_eye, opp_at = (-1.45, 1.35, -1.35), (-0.45, 0.85, -0.40)
    top_eye, top_at, top_fov = (0.15, 3.4, 0.05), (0.0, 0.7, 0.0), 42
    cams = {
        "wide": (wide_eye, wide_at, wide_fov),
        "close-ne": (close_eye, close_at, close_fov),
        "close-sw": (opp_eye, opp_at, close_fov),
        "top": (top_eye, top_at, top_fov),
    }
    pairs = []
    for key, t, zh in stages:
        use = ["wide", "close-ne"] + (["close-sw", "top"] if key == "deflated" else [])
        for cam in use:
            eye, at, fov = cams[cam]
            before = tip_pose(t)
            ib = R.label(shoot(R, js, blob, images, world_of, names, before, eye, at, fov, t <= 0), f"修复前 · {zh} · {cam}")
            ia = R.label(shoot(R, js, blob, images, world_of, names, after[t], eye, at, fov, t <= 0), f"修复后 · {zh} · {cam}")
            ib.save(OUT / f"before-{key}-{cam}.png")
            ia.save(OUT / f"after-{key}-{cam}.png")
            both = Image.new("RGB", (ib.width * 2 + 8, ib.height), (16, 22, 32))
            both.paste(ib, (0, 0))
            both.paste(ia, (ib.width + 8, 0))
            both.save(OUT / f"compare-{key}-{cam}.png")
            pairs.append((key, cam))
            print("shot", key, cam)
    # continuous after sequence, same two cameras
    seq_t = [0.0, 0.35, 0.7, 1.2, 3.0]
    labels = ["瘪", "起", "中", "高", "满"]
    for cam, (eye, at, fov) in (("wide", cams["wide"]), ("close-ne", cams["close-ne"])):
        frames = []
        for t, lab in zip(seq_t, labels):
            img = R.label(shoot(R, js, blob, images, world_of, names, after[t], eye, at, fov, t <= 0), f"修复后 · {lab} · t={t:.2f}s")
            img.save(OUT / f"seq-after-{cam}-t{t:.2f}.png")
            frames.append(img)
        strip = Image.new("RGB", (frames[0].width * len(frames) + 8 * (len(frames) - 1), frames[0].height), (16, 22, 32))
        for i, img in enumerate(frames):
            strip.paste(img, (i * (img.width + 8), 0))
        strip.save(OUT / f"seq-after-{cam}.png")
        print("seq", cam)
    # offline numbers: exact distance, same metric as the runtime test
    E, Ei, rim = load_cloth_geom(R, js, blob)
    report = {"source": "offline", "note": "Python point-triangle distance. after poses are BalloonDrape.ts via the node harness. before is the tip drape (1fe19f29), no basket cap.", "after": {}, "before": {}}
    for t in (0.0, 0.45, 3.0):
        report["after"][str(t)] = {k: round(v, 4) for k, v in exact_gaps(E, Ei, rim, after[round(t, 2)]).items()}
        report["before"][str(t)] = {k: round(v, 4) for k, v in exact_gaps(E, Ei, rim, tip_pose(t)).items()}
        report["after"][str(t)]["minM"] = round(min(v for k, v in report["after"][str(t)].items() if k != "minM"), 4)
        report["before"][str(t)]["minM"] = round(min(v for k, v in report["before"][str(t)].items() if k != "minM"), 4)
    curve = after_poses([round(i * 0.1, 1) for i in range(31)])
    mins = []
    for p in curve:
        g = exact_gaps(E, Ei, rim, p)
        mins.append((min(g.values()), p["t"], g))
    worst = min(mins, key=lambda x: x[0])
    report["afterMinimumM"] = round(worst[0], 4)
    report["afterMinimumAtT"] = worst[1]
    report["afterCornersAtMinimum"] = {k: round(v, 4) for k, v in worst[2].items()}
    (OUT / "clearance-offline.json").write_text(json.dumps(report, indent=2) + "\n")
    print("offline min", report["afterMinimumM"], "at", report["afterMinimumAtT"])


if __name__ == "__main__":
    main()
