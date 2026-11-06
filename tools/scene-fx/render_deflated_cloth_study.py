#!/usr/bin/env python3
"""One fixed-view deflated-cloth shape study. Not a runtime pose and not a game camera.

Left: the rejected uniform-scale cap (current balloonDrapePose at t=0).
Right: one proposed limp pile. Same real envelope texture and the same basket mesh.
The proposal only moves a copy of the envelope vertices. The cruise glTF is untouched,
and nothing here is called from BalloonDrape or the inflate clock.
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "product/2026-11-06/balloon-deflated-cloth-study"
HERE = Path(__file__).resolve().parent
BANNER = "离线形态小样，非游戏镜头验收"


def load_render():
    import importlib.util
    spec = importlib.util.spec_from_file_location("bal_render", HERE / "render_balloon_inflate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def rejected_pose():
    """Current candidate t=0, the hard cap the coordinator rejected. Not a new shape."""
    env = os.environ.copy()
    env["QF_TYPESCRIPT_MODULE"] = env.get("QF_TYPESCRIPT_MODULE", "/tmp/tsmod/node_modules/typescript")
    script = r"""
const path=require('path');
const H=require('./tools/board-ui/harness.cjs').createHarness();
const D=H.load(path.resolve('creator-build-project/assets/scripts/region/BalloonDrape.ts'));
const home={p:{x:0,y:-3.05,z:0},s:{x:1,y:1,z:1}};
const p=D.balloonDrapePose(0);
process.stdout.write(JSON.stringify(Object.assign({localY:D.envelopeLocalY(p,home)}, p)));
"""
    return json.loads(subprocess.check_output(["node", "-e", script], cwd=ROOT, env=env))


def envelope_local(R, js, blob):
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    i = names["balloon_envelope"]
    prim = js["meshes"][js["nodes"][i]["mesh"]]["primitives"][0]
    pos = R.read_acc(js, blob, prim["attributes"]["POSITION"]).astype(np.float64).reshape(-1, 3)
    nrm = R.read_acc(js, blob, prim["attributes"]["NORMAL"]).astype(np.float64).reshape(-1, 3)
    uv = R.read_acc(js, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float64).reshape(-1, 2)
    idx = R.read_acc(js, blob, prim["indices"]).reshape(-1, 3).astype(np.int64)
    return pos, nrm, uv, idx, i


def limp_pile_r1(P):
    """Review r1. Kept only so the comparison uses the same eye and the same light.
    Eight equal creases made the upright paper-fan edge."""
    y = P[:, 1]
    u = np.clip((y - 3.05) / 7.35, 0.0, 1.0)
    theta = np.arctan2(P[:, 2], P[:, 0])
    stuffed = np.clip((u - 0.72) / 0.28, 0.0, 1.0)
    vis = np.clip(u / 0.72, 0.0, 1.0)
    lobe = np.sin(theta * 4.0 + 0.6)
    crease = np.sin(theta * 8.0 + 0.3)
    y_in = 0.42 + 0.50 * np.power(vis, 0.55)
    y_in = y_in + 0.045 * lobe * vis + 0.05 * crease * vis
    r_in = 0.12 + 0.40 * np.power(vis, 0.40)
    r_in = r_in * (0.80 + 0.20 * (0.5 + 0.5 * lobe))
    r_in = r_in * (0.88 + 0.12 * crease)
    r_in = np.minimum(r_in, 0.58)
    y_in = np.clip(y_in, 0.40, 1.02)
    near = np.clip(np.cos(theta - 1.15), 0.0, 1.0)
    spill = near * np.clip((vis - 0.50) / 0.30, 0.0, 1.0) * (1.0 - stuffed)
    r_lip = 0.62 + 0.22 * spill
    y_lip = 1.06 - 0.08 * spill
    r = r_in * (1.0 - spill) + r_lip * spill
    y_out = y_in * (1.0 - spill) + y_lip * spill
    y_out = y_out * (1.0 - stuffed) + (0.40 + 0.05 * np.sin(theta * 5.0)) * stuffed
    r = r * (1.0 - 0.70 * stuffed) + 0.14 * stuffed
    return np.column_stack((r * np.cos(theta), y_out, r * np.sin(theta)))


def limp_pile_r2(P):
    """Two unequal broad humps and one overlapping sheet. The back half stays
    low, so there is no full ring of teeth. Crest stays near the lip, not above
    it as spikes. Not runtime."""
    u = np.clip((P[:, 1] - 3.05) / 7.35, 0.0, 1.0)
    theta = np.arctan2(P[:, 2], P[:, 0])
    stuffed = np.clip((u - 0.80) / 0.20, 0.0, 1.0)
    vis = np.clip(u / 0.80, 0.0, 1.0)
    hump_a = np.exp(-0.5 * ((theta - 1.05) / 0.95) ** 2)
    hump_b = np.exp(-0.5 * ((theta + 0.35) / 0.42) ** 2)
    # Cloth below the blue band stays in the basket. Cloth above it lays over that
    # sheet, higher on one wide hump and only a little on a second, smaller hump.
    # 0.46 sits just under the blue band (u ≈ 0.50), so the band rides the draped sheet.
    upper = np.clip((u - 0.46) / 0.05, 0.0, 1.0) * (1.0 - stuffed)
    y0 = 0.52 + 0.08 * hump_a
    r0 = np.minimum(0.18 + 0.30 * np.clip(u / 0.55, 0.0, 1.0), 0.50)
    y1 = 0.86 + 0.28 * hump_a + 0.06 * hump_b
    r1 = 0.26 + 0.18 * hump_a
    y_out = y0 * (1.0 - upper) + y1 * upper
    r = r0 * (1.0 - upper) + r1 * upper
    x = r * np.cos(theta) + 0.14 * upper * hump_a
    z = r * np.sin(theta) - 0.05 * upper
    y_out = y_out * (1.0 - stuffed) + 0.48 * stuffed
    x = x * (1.0 - 0.75 * stuffed)
    z = z * (1.0 - 0.75 * stuffed)
    y_out = np.clip(y_out, 0.44, 1.18)
    return np.column_stack((x, y_out, z))


def tris_from(R, js, blob, images, node_i, pos, nrm, uv, idx, M):
    prim = js["meshes"][js["nodes"][node_i]["mesh"]]["primitives"][0]
    Rm = M[:3, :3]
    pw = pos @ Rm.T + M[:3, 3]
    nw = nrm @ np.linalg.inv(Rm).T
    nw /= np.linalg.norm(nw, axis=1, keepdims=True) + 1e-8
    mat = prim.get("material", 0)
    tex_i = js["materials"][mat]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    tex = images[js["textures"][tex_i]["source"]]
    col = np.stack([R.sample(tex, uv[i, 0], uv[i, 1]) for i in range(len(uv))])
    out = []
    for a, b, c in idx:
        # Face normal of the deformed triangle, so a fold reads as a crease.
        fn = np.cross(pw[b] - pw[a], pw[c] - pw[a])
        fn = fn / (np.linalg.norm(fn) + 1e-8)
        out.append((pw[a], pw[b], pw[c], fn, fn, fn, col[a], col[b], col[c]))
    return out


def label(img, font, line):
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, img.width, 72), fill=(12, 16, 24))
    d.text((8, 6), BANNER, fill=(255, 220, 160), font=font)
    d.text((8, 38), line, fill=(255, 255, 255), font=font)
    return img


def main():
    R = load_render()
    R.W, R.H = 390, 844
    js, blob = R.load_glb(R.GLB)
    images, world_of = R.gather(js, blob)
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    parents = {c: i for i, n in enumerate(js["nodes"]) for c in n.get("children", [])}

    def world_matrix(i, override=None):
        M = np.eye(4)
        chain, a, seen = [], i, set()
        while a is not None and a not in seen:
            seen.add(a)
            chain.append(a)
            a = parents.get(a)
        for k in reversed(chain):
            ov = override if (override is not None and k == i) else None
            M = M @ R.node_matrix(js["nodes"][k], ov)
        return M

    env_i = names["balloon_envelope"]
    pos, nrm, uv, idx, _ = envelope_local(R, js, blob)
    pile_r1 = limp_pile_r1(pos)
    pile_r2 = limp_pile_r2(pos)
    pose = rejected_pose()
    basket_tris = []
    for i, n in enumerate(js["nodes"]):
        if "mesh" not in n or n["name"] in ("balloon_envelope", "balloon_load_frame", "burner_flame"):
            continue
        basket_tris.extend(R.mesh_tris(js, blob, images, i, world_of(i, {})))
    eye = np.array([0.15, 2.35, 2.55])
    target = np.array([0.0, 0.72, 0.0])
    fov = 32.0
    font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 22)
    ident = np.eye(4)
    r1_tris = tris_from(R, js, blob, images, env_i, pile_r1, nrm, uv, idx, ident)
    r2_tris = tris_from(R, js, blob, images, env_i, pile_r2, nrm, uv, idx, ident)
    left = label(Image.fromarray(R.render(basket_tris + r1_tris, eye, target, fov)), font, "r1 已否：直立硬折扇（未接入运行时）")
    right = label(Image.fromarray(R.render(basket_tris + r2_tris, eye, target, fov)), font, "r2 提案：低堆缓折（未接入运行时）")
    both = Image.new("RGB", (left.width * 2 + 8, left.height), (12, 16, 24))
    both.paste(left, (0, 0))
    both.paste(right, (left.width + 8, 0))
    # Same azimuth as the study eye, pulled out to about the boarding-close distance.
    # Aim stays on the basket, so this is not BasketCloseShot and not an acceptance frame.
    horiz = float(np.hypot(eye[0] - target[0], eye[2] - target[2]))
    far_s = 7.6 / horiz
    far_eye = np.array([target[0] + (eye[0] - target[0]) * far_s, 2.6, target[2] + (eye[2] - target[2]) * far_s])
    far_dist = float(np.linalg.norm(far_eye - target))
    far = label(
        Image.fromarray(R.render(basket_tris + r2_tris, far_eye, target, 46.0)),
        font,
        f"近似距离 {far_dist:.1f} m，非验收",
    )
    OUT.mkdir(parents=True, exist_ok=True)
    left.save(OUT / "study-r1.png")
    right.save(OUT / "study-r2.png")
    both.save(OUT / "study-r1-vs-r2.png")
    far.save(OUT / "study-r2-approx-distance.png")
    y = pile_r2[:, 1]
    rad = np.hypot(pile_r2[:, 0], pile_r2[:, 2])
    (OUT / "study.json").write_text(json.dumps({
        "specimen": "proposed-geometry-only",
        "runtimeImplementation": False,
        "productionTransition": "not approved; this study does not change it",
        "cruiseMesh": "unchanged transport_balloon.glb",
        "basket": "authored balloon_basket, unscaled",
        "colors": "envelope baseColorTexture, unchanged",
        "sameView": {"eye": eye.tolist(), "target": target.tolist(), "fov": fov, "light": "render_balloon_inflate.render fixed light"},
        "approxDistance": {
            "eye": far_eye.tolist(), "target": target.tolist(), "fov": 46,
            "distanceM": round(far_dist, 2),
            "note": "about the boarding-close distance, aim is the basket, not the game lens",
        },
        "r2Pile": {"yMin": round(float(y.min()), 3), "yMax": round(float(y.max()), 3), "rMax": round(float(rad.max()), 3)},
        "label": BANNER,
    }, indent=2) + "\n")
    print("r2 y", round(float(y.min()), 3), round(float(y.max()), 3), "r", round(float(rad.max()), 3), "far", round(far_dist, 2))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
