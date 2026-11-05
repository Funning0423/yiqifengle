#!/usr/bin/env python3
"""Before/after stills of the hot-air balloon inflate.

Before is the shipped scale-about-origin pose (lakeside adapter, and meadow applyInflate
when world bounds are not ready on the first call): the cloth squashes toward y 0 and the
load frame stays at full height. After is BalloonDrape. t=3 is the authored cruise mesh
either way.

Writes product/2026-11-05/balloon-inflate/.
"""
from __future__ import annotations

import json
import struct
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
GLB = ROOT / "creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb"
OUT = ROOT / "product/2026-11-05/balloon-inflate"
W, H = 480, 854


def load_glb(path: Path):
    data = path.read_bytes()
    off = 12
    ln, typ = struct.unpack_from("<II", data, off)
    off += 8
    js = json.loads(data[off : off + ln])
    off += ln
    ln2, typ2 = struct.unpack_from("<II", data, off)
    off += 8
    return js, data[off : off + ln2]


def read_acc(js, blob, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    dt = {5123: np.uint16, 5125: np.uint32, 5126: np.float32}[a["componentType"]]
    stride = bv.get("byteStride", np.dtype(dt).itemsize * ncomp)
    return np.array(np.ndarray((a["count"], ncomp), dtype=dt, buffer=blob, offset=start, strides=(stride, np.dtype(dt).itemsize)))


def quat_to_mat(q):
    x, y, z, w = q
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ],
        dtype=np.float64,
    )


def node_matrix(n, override=None):
    if override and "matrix" in override:
        return override["matrix"]
    t = np.array((override or n).get("translation", n.get("translation", [0, 0, 0])), dtype=np.float64)
    q = (override or n).get("rotation", n.get("rotation", [0, 0, 0, 1]))
    s = np.array((override or n).get("scale", n.get("scale", [1, 1, 1])), dtype=np.float64)
    R = quat_to_mat(q)
    M = np.eye(4)
    M[:3, :3] = R * s
    M[:3, 3] = t
    return M


def poses_from_ts():
    script = r"""
const path=require('path');
const H=require('./tools/board-ui/harness.cjs').createHarness();
const D=H.load(path.resolve('creator-build-project/assets/scripts/region/BalloonDrape.ts'));
const C=H.load(path.resolve('creator-build-project/assets/scripts/region/TransitionChain.ts'));
const times=[0,0.45,0.9,3];
const out={};
for (const t of times) {
  const p=D.balloonDrapePose(t);
  const f=C.inflateAt(t);
  const home={p:{x:0,y:-3.05,z:0},s:{x:1,y:1,z:1}};
  out[String(t)]={after:p, localY:D.envelopeLocalY(p,home), old:{sy:f.sy,sxz:f.sxz}};
}
process.stdout.write(JSON.stringify(out));
"""
    env = dict(**{k: v for k, v in __import__("os").environ.items()})
    env["QF_TYPESCRIPT_MODULE"] = env.get("QF_TYPESCRIPT_MODULE", "/tmp/tsmod/node_modules/typescript")
    raw = subprocess.check_output(["node", "-e", script], cwd=ROOT, env=env)
    return json.loads(raw)


def gather(js, blob):
    images = []
    for im in js["images"]:
        bv = js["bufferViews"][im["bufferView"]]
        raw = blob[bv.get("byteOffset", 0) : bv.get("byteOffset", 0) + bv["byteLength"]]
        images.append(np.array(Image.open(__import__("io").BytesIO(raw)).convert("RGB")))
    parts = []
    parents = {c: i for i, n in enumerate(js["nodes"]) for c in n.get("children", [])}

    def world_of(i, local_override):
        M = np.eye(4)
        chain = []
        a = i
        seen = set()
        while a is not None and a not in seen:
            seen.add(a)
            chain.append(a)
            a = parents.get(a)
        for k in reversed(chain):
            ov = local_override.get(k)
            M = M @ node_matrix(js["nodes"][k], ov)
        return M

    return images, world_of


def sample(tex, u, v):
    H_, W_ = tex.shape[:2]
    x = int(np.clip(u, 0, 0.999) * (W_ - 1))
    y = int(np.clip(v, 0, 0.999) * (H_ - 1))  # glTF v=0 is the top of this atlas
    return tex[y, x].astype(np.float64) / 255.0


def mesh_tris(js, blob, images, node_i, M):
    n = js["nodes"][node_i]
    if "mesh" not in n:
        return []
    prim = js["meshes"][n["mesh"]]["primitives"][0]
    pos = read_acc(js, blob, prim["attributes"]["POSITION"]).astype(np.float64).reshape(-1, 3)
    nrm = read_acc(js, blob, prim["attributes"]["NORMAL"]).astype(np.float64).reshape(-1, 3)
    uv = read_acc(js, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float64).reshape(-1, 2)
    idx = read_acc(js, blob, prim["indices"]).reshape(-1, 3).astype(np.int64)
    R = M[:3, :3]
    # inverse-transpose for normals, ignore scale shear (diagonal scale)
    N = np.linalg.inv(R).T
    pw = pos @ R.T + M[:3, 3]
    nw = nrm @ N.T
    nw /= np.linalg.norm(nw, axis=1, keepdims=True) + 1e-8
    mat = prim.get("material", 0)
    tex_i = js["materials"][mat]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    tex = images[js["textures"][tex_i]["source"]]
    col = np.stack([sample(tex, uv[i, 0], uv[i, 1]) for i in range(len(uv))])
    out = []
    for a, b, c in idx:
        out.append((pw[a], pw[b], pw[c], nw[a], nw[b], nw[c], col[a], col[b], col[c]))
    return out


def look_at(eye, target, up=np.array([0.0, 1.0, 0.0])):
    f = target - eye
    f = f / np.linalg.norm(f)
    r = np.cross(f, up)
    r = r / np.linalg.norm(r)
    u = np.cross(r, f)
    return f, r, u


def render(tris, eye, target, fov_y=32.0):
    img = np.zeros((H, W, 3), np.float64)
    zbuf = np.full((H, W), np.inf)
    # sky
    for y in range(H):
        k = y / (H - 1)
        img[y, :] = (1 - k) * np.array([0.45, 0.72, 0.95]) + k * np.array([0.18, 0.42, 0.78])
    # ground
    ground = []
    for x0, z0, x1, z1, col in [
        (-8, -8, 8, 8, np.array([0.22, 0.55, 0.18])),
    ]:
        c = col
        ground.append(
            (
                np.array([x0, 0, z0]),
                np.array([x1, 0, z0]),
                np.array([x1, 0, z1]),
                np.array([0, 1, 0.0]),
                np.array([0, 1, 0.0]),
                np.array([0, 1, 0.0]),
                c,
                c * 0.92,
                c * 0.85,
            )
        )
        ground.append(
            (
                np.array([x0, 0, z0]),
                np.array([x1, 0, z1]),
                np.array([x0, 0, z1]),
                np.array([0, 1, 0.0]),
                np.array([0, 1, 0.0]),
                np.array([0, 1, 0.0]),
                c,
                c * 0.85,
                c * 0.9,
            )
        )
    f, r, u = look_at(eye, target)
    fy = 0.5 / np.tan(np.radians(fov_y) / 2)
    fx = fy * (H / W)
    light = np.array([0.35, 0.85, 0.4])
    light /= np.linalg.norm(light)

    def shade(n, c):
        nd = n / (np.linalg.norm(n) + 1e-8)
        lamb = max(0.0, float(np.dot(nd, light)))
        return np.clip(c * (0.48 + 0.62 * lamb), 0, 1)

    def draw(tri):
        p0, p1, p2, n0, n1, n2, c0, c1, c2 = tri
        def proj(p):
            d = p - eye
            z = float(np.dot(d, f))
            if z < 0.08:
                return None
            x = float(np.dot(d, r))
            y = float(np.dot(d, u))
            sx = (x / z * fx + 0.5) * W
            sy = (0.5 - y / z * fy) * H
            return sx, sy, z

        q0, q1, q2 = proj(p0), proj(p1), proj(p2)
        if not (q0 and q1 and q2):
            return
        xs = [q0[0], q1[0], q2[0]]
        ys = [q0[1], q1[1], q2[1]]
        minx, maxx = max(0, int(min(xs))), min(W - 1, int(max(xs)) + 1)
        miny, maxy = max(0, int(min(ys))), min(H - 1, int(max(ys)) + 1)
        if minx >= maxx or miny >= maxy:
            return
        area = (q1[0] - q0[0]) * (q2[1] - q0[1]) - (q2[0] - q0[0]) * (q1[1] - q0[1])
        if abs(area) < 1e-6:
            return
        for y in range(miny, maxy + 1):
            for x in range(minx, maxx + 1):
                w0 = (q1[0] - x) * (q2[1] - y) - (q2[0] - x) * (q1[1] - y)
                w1 = (q2[0] - x) * (q0[1] - y) - (q0[0] - x) * (q2[1] - y)
                w2 = (q0[0] - x) * (q1[1] - y) - (q1[0] - x) * (q0[1] - y)
                if area > 0:
                    if w0 < 0 or w1 < 0 or w2 < 0:
                        continue
                else:
                    if w0 > 0 or w1 > 0 or w2 > 0:
                        continue
                b0, b1, b2 = w0 / area, w1 / area, w2 / area
                z = b0 * q0[2] + b1 * q1[2] + b2 * q2[2]
                if z >= zbuf[y, x]:
                    continue
                zbuf[y, x] = z
                n = b0 * n0 + b1 * n1 + b2 * n2
                c = b0 * c0 + b1 * c1 + b2 * c2
                # backfaces: flip normal so the inside of the cloth still reads
                if np.dot(n, f) > 0:
                    n = -n
                img[y, x] = shade(n, c)

    for tri in ground:
        draw(tri)
    for tri in tris:
        draw(tri)
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)


def bounds(tris):
    if not tris:
        return np.zeros(3), np.ones(3)
    pts = np.concatenate([np.stack([t[0], t[1], t[2]]) for t in tris])
    return pts.min(0), pts.max(0)


def frame_camera(tris):
    lo, hi = bounds(tris)
    center = (lo + hi) / 2
    ext = hi - lo
    radius = 0.5 * np.linalg.norm(ext) + 0.4
    # 3/4 view, a little above, matching the preview that looks down on the basket
    az, el = np.radians(28), np.radians(16)
    dist = radius / np.tan(np.radians(32) / 2) * 0.92
    eye = center + dist * np.array([np.sin(az) * np.cos(el), np.sin(el) + 0.08, np.cos(az) * np.cos(el)])
    return eye, center


def build_scene(js, blob, images, world_of, overrides, hide):
    tris = []
    for i, n in enumerate(js["nodes"]):
        if "mesh" not in n:
            continue
        if n["name"] in hide:
            continue
        M = world_of(i, overrides)
        tris.extend(mesh_tris(js, blob, images, i, M))
    return tris


def override_for(name_to_i, kind, pack):
    """Local TRS overrides keyed by node index."""
    env = name_to_i["balloon_envelope"]
    frame = name_to_i.get("balloon_load_frame")
    flame = name_to_i["burner_flame"]
    ov = {}
    if kind == "before":
        sy, sxz = pack["old"]["sy"], pack["old"]["sxz"]
        ov[env] = {"translation": [0, -3.05, 0], "scale": [sxz, sy, sxz]}
    else:
        p = pack["after"]
        ov[env] = {"translation": [0, pack["localY"], 0], "scale": [p["sxz"], p["sy"], p["sxz"]]}
        if frame is not None:
            if p["frameVisible"]:
                ov[frame] = {"translation": [0, p["frameLocalY"], 0], "scale": [p["frameSxz"], p["frameSy"], p["frameSxz"]]}
            else:
                ov[frame] = {"translation": [0, p["frameLocalY"], 0], "scale": [0.001, 0.001, 0.001]}
        ov[flame] = {"translation": [0, p["flameLocalY"], 0], "scale": [1, 1, 1]}
    return ov


def label(im, text):
    draw = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 22)
    except Exception:
        font = ImageFont.load_default()
    draw.rectangle((0, 0, im.width, 36), fill=(16, 22, 32))
    draw.text((12, 6), text, fill=(255, 248, 230), font=font)
    return im


def side_by_side(a, b, title):
    gap = 8
    canvas = Image.new("RGB", (a.width + b.width + gap, a.height), (16, 22, 32))
    canvas.paste(a, (0, 0))
    canvas.paste(b, (a.width + gap, 0))
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    js, blob = load_glb(GLB)
    images, world_of = gather(js, blob)
    name_to_i = {n["name"]: i for i, n in enumerate(js["nodes"])}
    packs = poses_from_ts()
    stages = [("deflated", "0", "瘪气"), ("mid", "0.45", "充气中"), ("inflated", "3", "充满")]
    # also an early mid so the rising bubble is visible, saved next to the main mid
    shots = []
    for key, tkey, zh in stages:
        pack = packs[tkey]
        hide = set()
        if float(tkey) <= 0:
            hide.add("burner_flame")
        before = build_scene(js, blob, images, world_of, override_for(name_to_i, "before", pack), hide)
        after = build_scene(js, blob, images, world_of, override_for(name_to_i, "after", pack), hide | (set() if pack["after"]["frameVisible"] else {"balloon_load_frame"}))
        # one camera for the pair, framed on whichever is larger
        eye, target = frame_camera(before + after)
        ib = label(Image.fromarray(render(before, eye, target)), f"修复前 · {zh}")
        ia = label(Image.fromarray(render(after, eye, target)), f"修复后 · {zh}")
        ib.save(OUT / f"before-{key}.png")
        ia.save(OUT / f"after-{key}.png")
        side_by_side(ib, ia, "").save(OUT / f"compare-{key}.png")
        shots.append((ib, ia))
        print(key, "wrote", ib.size)
    # contact sheet: 3 rows, before | after
    sheet = Image.new("RGB", (shots[0][0].width * 2 + 8, shots[0][0].height * 3 + 16), (16, 22, 32))
    for i, (b, a) in enumerate(shots):
        sheet.paste(b, (0, i * b.height + 8))
        sheet.paste(a, (b.width + 8, i * b.height + 8))
    sheet.save(OUT / "compare-sheet.png")
    print("sheet", sheet.size, OUT)


if __name__ == "__main__":
    main()
