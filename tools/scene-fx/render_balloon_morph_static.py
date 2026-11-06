#!/usr/bin/env python3
"""One static same-topology deflated endpoint. Not a runtime pose and not a GLB edit.

Weight 0 is the envelope file, byte for byte in position, normal and UV.
Weight 1 is a single authored pleat of those same vertices. Shared-position
UV splits stay on one displacement. Images use BasketCloseShot's door-stand
formula in basket space. They are a Python raster, not a Cocos frame and not
liveWorldPose.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "product/2026-11-06/balloon-morph-static"
HERE = Path(__file__).resolve().parent
GLB = ROOT / "creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb"

# BasketCloseShot.basketCloseSpot(doorOut, basket origin, no boxes, no prefer).
# Computed by loading BasketCloseShot.ts + TransitionStaging.ts. See camera.json.
EYE = np.array([4.858393277797973, 1.55, 5.895614309156518], dtype=np.float64)
TARGET = np.array([-0.072, 0.95, 1.25], dtype=np.float64)
FOV_Y = 46.0
FRAME_W, FRAME_H = 390, 844


def load_render():
    spec = importlib.util.spec_from_file_location("bal_render", HERE / "render_balloon_inflate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def weld_ids(pos: np.ndarray, decimals: int = 5):
    key = np.round(pos, decimals)
    table = {}
    wid = np.empty(len(pos), np.int32)
    for i, row in enumerate(key):
        t = (float(row[0]), float(row[1]), float(row[2]))
        j = table.get(t)
        if j is None:
            j = len(table)
            table[t] = j
        wid[i] = j
    wp = np.zeros((len(table), 3), np.float64)
    for t, j in table.items():
        wp[j] = t
    groups = [[] for _ in range(len(table))]
    for i, j in enumerate(wid):
        groups[int(j)].append(int(i))
    return wid, wp, groups


def authored_endpoint(pos: np.ndarray, wid: np.ndarray, wp: np.ndarray):
    """One pleated ribbon inside the basket. Meridional steps keep their length.

    Mouth ring (y=3.05) and the mouth cap (the only vertex at y=3.9) stay.
    The crown follows the top ring so it does not stay up at y=10.4.
    Sector spacing is one lateral offset, copied onto every UV split of that weld.
    """
    n = len(wp)
    p1w = wp.copy()
    r = np.hypot(wp[:, 0], wp[:, 2])
    theta = np.arctan2(wp[:, 0], wp[:, 2])
    sec = np.mod(np.rint(theta / (2 * np.pi / 24)), 24).astype(np.int32)
    sec[r < 1e-3] = -1
    mouth = np.where(np.isclose(wp[:, 1], 3.05) & (sec >= 0))[0]
    if len(mouth) != 24:
        raise SystemExit(f"expected 24 mouth welds, got {len(mouth)}")
    view = TARGET - EYE
    view[1] = 0
    view /= np.linalg.norm(view)
    lateral = np.cross(np.array([0.0, 1.0, 0.0]), -view)
    lateral /= np.linalg.norm(lateral)

    def aim(s: float, k: int) -> np.ndarray:
        period = 1.7
        phase = s / period
        ip = int(np.floor(phase))
        frac = phase - ip
        tri = 1.0 - abs(2.0 * frac - 1.0)
        sign = 1.0 if ip % 2 == 0 else -1.0
        depth = sign * tri * 0.48
        y = 3.05 - 2.55 * (1.0 - np.exp(-s / 1.3)) + 0.22 * tri
        y = float(np.clip(y, 0.22, 2.9))
        lat = (k - 11.5) * 0.024 + (ip - 2) * 0.015
        xz = lateral * lat + view * depth
        return np.array([xz[0], y, xz[2]], dtype=np.float64)

    moved = np.zeros(n, np.bool_)
    for k in range(24):
        chain = np.where(sec == k)[0]
        chain = chain[np.argsort(wp[chain, 1])]
        if len(chain) < 2 or not np.isclose(wp[chain[0], 1], 3.05):
            raise SystemExit(f"sector {k} does not start on the mouth ring")
        prev = wp[chain[0]].copy()
        s = 0.0
        for a, b in zip(chain[:-1], chain[1:]):
            d = float(np.linalg.norm(wp[b] - wp[a]))
            s += d
            target = aim(s, k)
            delta = target - prev
            ln = float(np.linalg.norm(delta))
            step = delta / ln if ln > 1e-8 else np.array([0.0, -1.0, 0.0])
            prev = prev + step * d
            p1w[b] = prev
            moved[b] = True
    crown = np.where((r < 1e-3) & (wp[:, 1] > 5))[0]
    if len(crown) != 1:
        raise SystemExit(f"expected one crown weld, got {len(crown)}")
    top = np.where(np.isclose(wp[:, 1], 10.3))[0]
    p1w[crown[0]] = p1w[top].mean(axis=0)
    moved[crown[0]] = True
    # Mouth cap stays. Any weld not on a gore stays.
    p1 = p1w[wid]
    # Exact file positions for welds that were not authored, including UV copies.
    stay = ~moved[wid]
    p1[stay] = pos[stay]
    return p1, {"movedWelds": int(moved.sum()), "lateral": lateral.tolist(), "view": view.tolist()}


def face_normals(pos: np.ndarray, idx: np.ndarray, wid: np.ndarray, nwelds: int):
    acc = np.zeros((nwelds, 3), np.float64)
    for a, b, c in idx:
        fn = np.cross(pos[b] - pos[a], pos[c] - pos[a])
        for v in (int(wid[a]), int(wid[b]), int(wid[c])):
            acc[v] += fn
    ln = np.linalg.norm(acc, axis=1, keepdims=True)
    bad = ln[:, 0] < 1e-12
    acc[~bad] /= ln[~bad]
    acc[bad] = np.array([0.0, 1.0, 0.0])
    return acc


def tri_hit(a, b, c, p, q, eps=1e-7):
    """Segment pq against triangle abc, excluding hits on the segment ends."""
    ab, ac = b - a, c - a
    n = np.cross(ab, ac)
    qp = p - q
    den = float(np.dot(qp, n))
    if abs(den) < eps:
        return False
    t = float(np.dot(p - a, n) / den)
    if t <= 1e-4 or t >= 1.0 - 1e-4:
        return False
    pt = p - t * qp
    pa, pb, pc = a - pt, b - pt, c - pt
    c1 = np.dot(np.cross(pa, pb), n)
    c2 = np.dot(np.cross(pb, pc), n)
    c3 = np.dot(np.cross(pc, pa), n)
    if c1 < -1e-8 or c2 < -1e-8 or c3 < -1e-8:
        return False
    return True


def crossing_pairs(pos: np.ndarray, idx: np.ndarray):
    """Non-adjacent triangle pairs whose edges stab the other triangle."""
    tris = idx.astype(np.int64)
    n = len(tris)
    cents = pos[tris].mean(axis=1)
    lo = pos[tris].min(axis=1)
    hi = pos[tris].max(axis=1)
    hits = []
    for i in range(n):
        a, b, c = tris[i]
        va, vb, vc = pos[a], pos[b], pos[c]
        for j in range(i + 1, n):
            d, e, f = tris[j]
            if a == d or a == e or a == f or b == d or b == e or b == f or c == d or c == e or c == f:
                continue
            if (hi[i] < lo[j] - 1e-6).any() or (hi[j] < lo[i] - 1e-6).any():
                continue
            vd, ve, vf = pos[d], pos[e], pos[f]
            stab = (
                tri_hit(va, vb, vc, vd, ve)
                or tri_hit(va, vb, vc, ve, vf)
                or tri_hit(va, vb, vc, vf, vd)
                or tri_hit(vd, ve, vf, va, vb)
                or tri_hit(vd, ve, vf, vb, vc)
                or tri_hit(vd, ve, vf, vc, va)
            )
            if stab:
                hits.append((int(i), int(j), float(np.linalg.norm(cents[i] - cents[j]))))
    return hits


def seam_gap(pos: np.ndarray, groups):
    worst = 0.0
    for g in groups:
        if len(g) < 2:
            continue
        block = pos[g]
        d = float(np.linalg.norm(block - block[0], axis=1).max())
        if d > worst:
            worst = d
    return worst


def nearest(src: np.ndarray, dst: np.ndarray):
    if len(src) == 0 or len(dst) == 0:
        return {"min": None, "median": None, "within05": 0, "within15": 0, "n": int(len(src))}
    # chunk to keep the temporary small
    mins = np.empty(len(src), np.float64)
    for i in range(0, len(src), 64):
        block = src[i : i + 64]
        d = np.linalg.norm(block[:, None, :] - dst[None, :, :], axis=2)
        mins[i : i + len(block)] = d.min(axis=1)
    return {
        "min": round(float(mins.min()), 4),
        "median": round(float(np.median(mins)), 4),
        "within05": int((mins <= 0.05).sum()),
        "within15": int((mins <= 0.15).sum()),
        "n": int(len(src)),
    }


def build_env_tris(R, pos, nrm, uv, idx, col):
    out = []
    for a, b, c in idx:
        out.append((pos[a], pos[b], pos[c], nrm[a], nrm[b], nrm[c], col[a], col[b], col[c]))
    return out


def main():
    R = load_render()
    R.W, R.H = FRAME_W, FRAME_H
    js, blob = R.load_glb(GLB)
    images, world_of = R.gather(js, blob)
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    env_i = names["balloon_envelope"]
    prim = js["meshes"][js["nodes"][env_i]["mesh"]]["primitives"][0]
    pos0 = R.read_acc(js, blob, prim["attributes"]["POSITION"]).astype(np.float64).reshape(-1, 3).copy()
    nrm0 = R.read_acc(js, blob, prim["attributes"]["NORMAL"]).astype(np.float64).reshape(-1, 3).copy()
    uv = R.read_acc(js, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float64).reshape(-1, 2).copy()
    idx = R.read_acc(js, blob, prim["indices"]).reshape(-1, 3).astype(np.int64)
    wid, wp, groups = weld_ids(pos0)
    wp_exact = np.zeros_like(wp)
    for g in groups:
        wp_exact[int(wid[g[0]])] = pos0[g[0]]
    p1, meta = authored_endpoint(pos0, wid, wp_exact)
    if seam_gap(p1, groups) > 1e-6:
        raise SystemExit(f"authored endpoint splits a UV seam by {seam_gap(p1, groups)}")
    n1w = face_normals(p1, idx, wid, len(groups))
    n1 = n1w[wid]
    # Weight 0 must not depend on n1.
    if not np.array_equal(uv, R.read_acc(js, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float64).reshape(-1, 2)):
        raise SystemExit("UV buffer changed")

    def at(w: float):
        if w == 0.0:
            return pos0.copy(), nrm0.copy()
        p = (1.0 - w) * pos0 + w * p1
        n = (1.0 - w) * nrm0 + w * n1
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-15
        return p, n

    # Other meshes, flame off, authored rest pose. Envelope is replaced per weight.
    rest = R.build_scene(js, blob, images, world_of, {}, {"balloon_envelope", "burner_flame"})
    mat = prim.get("material", 0)
    tex_i = js["materials"][mat]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    tex = images[js["textures"][tex_i]["source"]]
    col = np.stack([R.sample(tex, uv[i, 0], uv[i, 1]) for i in range(len(uv))])

    basket = None
    frame = None
    for name, slot in (("balloon_basket", "basket"), ("balloon_load_frame", "frame")):
        node = names[name]
        pr = js["meshes"][js["nodes"][node]["mesh"]]["primitives"][0]
        raw = R.read_acc(js, blob, pr["attributes"]["POSITION"]).astype(np.float64).reshape(-1, 3)
        M = world_of(node, {})
        pw = raw @ M[:3, :3].T + M[:3, 3]
        if name == "balloon_basket":
            basket = pw
        else:
            frame = pw
    rim = basket[basket[:, 1] > 1.05]
    poles = frame[(np.hypot(frame[:, 0], frame[:, 2]) > 0.45) & (frame[:, 1] > 1.05)]
    mouth = pos0[np.isclose(pos0[:, 1], 3.05)]

    diag = {
        "label": "NON-ENGINE Python raster. Not Cocos, not liveWorldPose, not a device frame.",
        "weightsAreSamples": "0, 0.5 and 1 only. Not a proof of the in-between curve.",
        "camera": {
            "eye": EYE.tolist(),
            "lookAt": TARGET.tolist(),
            "fovVerticalDeg": FOV_Y,
            "aspect": FRAME_W / FRAME_H,
            "framePx": [FRAME_W, FRAME_H],
            "up": [0, 1, 0],
            "provenance": [
                "BasketCloseShot.basketCloseSpot(TRANSITION_STAGING.basket.doorOut, [0,0,0], boxes=[], prefer omitted)",
                "sideDeg 50, the first entry, because no occluder box and no plan.camera(0) prefer",
                "basketClosePose looks at doorOut feet + lookUpM 0.95, fovDeg 46, upM 1.55",
                "aspect 390/844 is BalloonTransit.ts fallback when view.getFrameSize is absent (fw||390, fh||844)",
                "Not applied: liveWorldPose, the blend from cam0, meadow occluders, lensClearStep",
                "Raster near clip is 0.08 m in render_balloon_inflate.py. Game camera near is CAMERA_FIXED.near 0.05. Not the same projection.",
            ],
        },
        "endpoint": meta,
        "samples": {},
    }
    OUT.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 16)
    frames = []
    # Crop from the basket plus the load frame, one rectangle for every weight.
    crop = project_box(R, np.vstack([basket, frame]), EYE, TARGET, FOV_Y)
    for w in (0.0, 0.5, 1.0):
        p, n = at(w)
        eq_p = float(np.max(np.abs(p - pos0))) if w == 0.0 else None
        eq_n = float(np.max(np.abs(n - nrm0))) if w == 0.0 else None
        if w == 0.0 and (eq_p != 0.0 or eq_n != 0.0):
            raise SystemExit(f"weight 0 drifted pos {eq_p} nrm {eq_n}")
        gap = seam_gap(p, groups)
        print(f"weight {w} seam {gap:.3e} crossing…", flush=True)
        hits = crossing_pairs(p, idx)
        env = build_env_tris(R, p, n, uv, idx, col)
        img = R.render(rest + env, EYE, TARGET, FOV_Y)
        im = Image.fromarray(img)
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, im.width, 52), fill=(12, 16, 24))
        d.text((6, 2), f"非引擎光栅  w={w:g}  不是 liveWorldPose", fill=(255, 255, 255), font=font)
        d.text((6, 24), f"缝 {gap:.1e} m   非邻接互穿 {len(hits)} 对", fill=(230, 230, 210), font=font)
        im.save(OUT / f"board-wide-w{w:g}.png")
        x0, y0, x1, y1 = crop
        # Native pixels of the same framebuffer. Not a second camera and not an upscale.
        close = im.crop((x0, y0, x1, y1))
        d2 = ImageDraw.Draw(close)
        d2.rectangle((0, 0, close.width, 18), fill=(12, 16, 24))
        d2.text((4, 1), f"同一帧裁剪 w={w:g}", fill=(255, 255, 255), font=font)
        close.save(OUT / f"board-close-w{w:g}.png")
        frames.append(im)
        closes = diag.setdefault("_closes", [])
        closes.append(close)
        below = int((p[:, 1] < 0.10).sum())
        diag["samples"][str(w)] = {
            "positionMaxAbsVsFile": eq_p,
            "normalMaxAbsVsFile": eq_n,
            "uvUnchanged": True,
            "seamGapM": gap,
            "nonadjacentCrossings": len(hits),
            "crossingCentroidDistM": [round(h[2], 3) for h in hits[:12]],
            "mouthToLoadFrame": nearest(p[np.isclose(pos0[:, 1], 3.05)], frame),
            "envelopeToRimVerts": nearest(p, rim),
            "envelopeToPoleVerts": nearest(p, poles),
            "vertsBelowFloor0_10": below,
            "note": "Distances are vertex-to-vertex samples, not a continuous contact proof.",
        }
        print(json.dumps(diag["samples"][str(w)], ensure_ascii=False), flush=True)

    strip = Image.new("RGB", (FRAME_W * 3 + 16, FRAME_H), (12, 16, 24))
    for i, im in enumerate(frames):
        strip.paste(im, (i * (FRAME_W + 8), 0))
    strip.save(OUT / "board-wide-0-05-1.png")
    closes = diag.pop("_closes")
    gap = 8
    cstrip = Image.new("RGB", (sum(im.width for im in closes) + gap * (len(closes) - 1), max(im.height for im in closes)), (12, 16, 24))
    x = 0
    for im in closes:
        cstrip.paste(im, (x, 0))
        x += im.width + gap
    cstrip.save(OUT / "board-close-0-05-1.png")
    np.savez_compressed(
        OUT / "envelope-endpoint.npz",
        position0=pos0,
        normal0=nrm0,
        uv=uv,
        indices=idx,
        position1=p1,
        normal1=n1,
        weld=wid,
    )
    (OUT / "diagnostics.json").write_text(json.dumps(diag, indent=2, ensure_ascii=False) + "\n")
    print("wrote", OUT)


def project_box(R, pts, eye, target, fov):
    f, r, u = R.look_at(eye, target)
    fy = 0.5 / np.tan(np.radians(fov) / 2)
    fx = fy * (FRAME_H / FRAME_W)
    xs, ys = [], []
    for p in pts:
        d = p - eye
        z = float(np.dot(d, f))
        if z < 0.08:
            continue
        xs.append((float(np.dot(d, r)) / z * fx + 0.5) * FRAME_W)
        ys.append((0.5 - float(np.dot(d, u)) / z * fy) * FRAME_H)
    if not xs:
        return 0, 0, FRAME_W, FRAME_H
    pad = 18
    x0 = max(0, int(min(xs)) - pad)
    y0 = max(0, int(min(ys)) - pad)
    x1 = min(FRAME_W, int(max(xs)) + pad)
    y1 = min(FRAME_H, int(max(ys)) + pad)
    if x1 - x0 < 40 or y1 - y0 < 40:
        return 0, 0, FRAME_W, FRAME_H
    return x0, y0, x1, y1


if __name__ == "__main__":
    main()
