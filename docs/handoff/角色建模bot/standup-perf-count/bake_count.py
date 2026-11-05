#!/usr/bin/env python3
"""Bake seat_fix_* / skirt_back_thin_* / sit_drape_blend_comp into ≤4 sit + ≤4 stand
basis per APRON/DRESS; delete tip1 noise; drop BODY wrist_clearance_stand_up_0.
Outputs GLB + anim_meta_patch_draft.json + count log.
"""
from __future__ import annotations
import json, hashlib, sys, math
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from glb import G, compact, prune_accessors

SRC_GLB = Path("/workspace/yiqifengle/work/gbt-r5-b20-integrate-landing-visual/creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb")
META_C40 = Path("/tmp/anim_meta_c40.json")
OUT_DIR = Path("/workspace/yiqifengle/previews/角色建模bot/standup-perf-count")
OUT_GLB = OUT_DIR / "chr_b_standup_count_v1.glb"
OUT_PATCH = OUT_DIR / "anim_meta_patch_draft.json"
OUT_COUNT = OUT_DIR / "count_before_after.json"

N_BASIS = 4  # per side (sit / stand)
SPARSE_EPS = 5e-5  # match seat_morph.cjs

SAFE_DELETE = {
    "LOD0_G2_APRON": [
        "task21_stand_up_4", "task21_stand_up_5", "task21_stand_up_6",
        "task21_refine_stand_up_174", "task21_refine_stand_up_208",
    ],
    "LOD0_G2_DRESS": [
        "task21_stand_up_4", "task21_stand_up_5", "task21_stand_up_6",
        "task21_stand_up_9", "task21_refine_stand_up_174",
    ],
    "LOD0_G2_BODY": ["wrist_clearance_stand_up_0"],
}

# Bake candidates by mesh + side
BAKE_APRON_SIT = [
    "sit_drape_blend_comp",
    "hand_rest_support", "cloth_return_clearance",
    "cloth_envelope_sit_down_5", "cloth_envelope_sit_down_6",
    "cloth_envelope_sit_down_7", "cloth_envelope_sit_down_8",
    "task21_sit_down_2", "task21_sit_down_3", "task21_sit_down_4",
    "task21_sit_down_5", "task21_sit_down_6", "task21_sit_down_7",
    "task21_refine_sit_down_139", "task21_refine_sit_down_286",
    # also fold two stand-adjacent into sit? no — keep stand chain
    *[f"seat_fix_sit_down_{k:02d}" for k in list(range(4, 9)) + list(range(20, 30))],
]
BAKE_APRON_STAND = [
    "sit_clearance_rise", "cloth_cuff_clearance",
    *[f"seat_fix_stand_up_{k:02d}" for k in range(3, 11)],
]
BAKE_DRESS_SIT = [
    "sit_drape_blend_comp",
    "hand_rest_support", "cloth_return_clearance",
    "cloth_envelope_sit_down_6", "cloth_envelope_sit_down_7", "cloth_envelope_sit_down_8",
    "task21_sit_down_1", "task21_sit_down_2", "task21_sit_down_3", "task21_sit_down_4",
    "task21_sit_down_5", "task21_sit_down_6", "task21_sit_down_7",
    "task21_refine_sit_down_139", "task21_refine_sit_down_177",
    "task21_refine_sit_down_214", "task21_refine_sit_down_249", "task21_refine_sit_down_286",
    "skirt_back_thin_sit_d_26", "skirt_back_thin_sit_d_32",
    *[f"seat_fix_sit_down_{k:02d}" for k in list(range(4, 9)) + list(range(20, 36))],
]
BAKE_DRESS_STAND = [
    "sit_clearance_rise", "cloth_cuff_clearance",
    "cloth_envelope_stand_up_4", "cloth_envelope_stand_up_5",  # fold to hit ≤16 (APRON has no _4/_5)
    "skirt_back_thin_stand_02", "skirt_back_thin_stand_08", "skirt_back_thin_stand_11",
    *[f"seat_fix_stand_up_{k:02d}" for k in range(2, 16)],
]

BAKE = {
    "LOD0_G2_APRON": {"sit": BAKE_APRON_SIT, "stand": BAKE_APRON_STAND},
    "LOD0_G2_DRESS": {"sit": BAKE_DRESS_SIT, "stand": BAKE_DRESS_STAND},
}

CLIP_FOR_SIDE = {"sit": "sit_down", "stand": "stand_up"}


def eval_curve(pts, t):
    """Linear interpolate curve [[t,w],...] at time t."""
    if not pts:
        return 0.0
    if t <= pts[0][0]:
        return float(pts[0][1])
    if t >= pts[-1][0]:
        return float(pts[-1][1])
    for i in range(len(pts) - 1):
        t0, w0 = pts[i]; t1, w1 = pts[i + 1]
        if t0 <= t <= t1:
            if t1 <= t0:
                return float(w1)
            u = (t - t0) / (t1 - t0)
            return float(w0 + (w1 - w0) * u)
    return 0.0


def read_target_pos(g: G, acc_i: int) -> np.ndarray:
    """Return dense (N,3) float32 POSITION deltas for a morph target accessor."""
    return g.full(acc_i).astype(np.float32)


def mesh_by_name(g, name):
    for m in g.j["meshes"]:
        if m.get("name") == name:
            return m
    raise KeyError(name)


def target_names(mesh):
    return list((mesh.get("extras") or {}).get("targetNames") or [])


def add_sparse_vec3(g: G, nv: int, idx: np.ndarray, vals: np.ndarray, with_normal_zero: bool):
    """Append sparse POSITION (+ optional zero NORMAL) accessors; return target dict."""
    idx = np.ascontiguousarray(idx, np.uint16)
    vals = np.ascontiguousarray(vals, np.float32).reshape(-1)
    assert vals.size == idx.size * 3
    # pad buffer
    while len(g.b) % 4:
        g.b.append(0)
    bi = len(g.j["bufferViews"])
    g.j["bufferViews"].append({"buffer": 0, "byteOffset": len(g.b), "byteLength": idx.nbytes})
    g.b += idx.tobytes()
    while len(g.b) % 4:
        g.b.append(0)
    bv = len(g.j["bufferViews"])
    g.j["bufferViews"].append({"buffer": 0, "byteOffset": len(g.b), "byteLength": vals.nbytes})
    g.b += vals.tobytes()
    mn = [float(vals[c::3].min()) if vals.size else 0.0 for c in range(3)]
    mx = [float(vals[c::3].max()) if vals.size else 0.0 for c in range(3)]
    g.j["accessors"].append({
        "componentType": 5126, "count": nv, "type": "VEC3", "min": mn, "max": mx,
        "sparse": {
            "count": int(idx.size),
            "indices": {"bufferView": bi, "componentType": 5123},
            "values": {"bufferView": bv},
        },
    })
    pos_i = len(g.j["accessors"]) - 1
    tgt = {"POSITION": pos_i}
    if with_normal_zero:
        while len(g.b) % 4:
            g.b.append(0)
        zi = np.array([int(idx[0])], np.uint16)
        zv = np.zeros(3, np.float32)
        b1 = len(g.j["bufferViews"])
        g.j["bufferViews"].append({"buffer": 0, "byteOffset": len(g.b), "byteLength": zi.nbytes})
        g.b += zi.tobytes()
        while len(g.b) % 4:
            g.b.append(0)
        b2 = len(g.j["bufferViews"])
        g.j["bufferViews"].append({"buffer": 0, "byteOffset": len(g.b), "byteLength": zv.nbytes})
        g.b += zv.tobytes()
        g.j["accessors"].append({
            "componentType": 5126, "count": nv, "type": "VEC3",
            "sparse": {
                "count": 1,
                "indices": {"bufferView": b1, "componentType": 5123},
                "values": {"bufferView": b2},
            },
        })
        tgt["NORMAL"] = len(g.j["accessors"]) - 1
    return tgt


def densify_to_sparse(delta: np.ndarray, eps=SPARSE_EPS):
    mag = np.linalg.norm(delta, axis=1)
    idx = np.nonzero(mag > eps)[0].astype(np.uint16)
    if idx.size == 0:
        # keep one zero entry so sparse is valid
        idx = np.array([0], np.uint16)
        vals = np.zeros((1, 3), np.float32)
    else:
        vals = delta[idx].astype(np.float32)
    return idx, vals


def pca_basis(frames: list[np.ndarray], n: int):
    """frames: list of (V,3). Return (n,V,3) basis and per-frame weights (F,n)."""
    if not frames:
        raise ValueError("no frames")
    F = len(frames)
    V = frames[0].shape[0]
    X = np.stack([f.reshape(-1) for f in frames], axis=0).astype(np.float64)  # (F, V*3)
    # subtract mean? For morph reconstruction with non-negative-ish weights, keep absolute
    # Use SVD on X directly (no centering) so basis can represent absolute deltas
    # Economy SVD
    # If F is small, use eigh on Gram
    if F == 1:
        b0 = frames[0].astype(np.float32)
        # normalize peak to ~1 scale: use L2
        nrm = np.linalg.norm(b0)
        if nrm < 1e-12:
            return np.zeros((1, V, 3), np.float32), np.zeros((1, 1), np.float32)
        b0 = b0 / nrm
        return b0[None, ...], np.array([[nrm]], np.float32)

    # Center for better PCA, keep mean as extra if needed — but we only have n slots.
    # Prefer: no center; take top-n right singular... actually X = U S Vt with Vt (k, V*3)
    U, S, Vt = np.linalg.svd(X, full_matrices=False)
    n_use = min(n, len(S))
    basis = Vt[:n_use].reshape(n_use, V, 3).astype(np.float32)
    # Scale basis so max |component| weight for original frames is comfortable
    # weights = X @ basis_flat.T  but basis may not be orthonormal in float — Vt rows are.
    W = (U[:, :n_use] * S[:n_use]).astype(np.float32)  # (F, n)
    # Flip signs so average weight positive
    for k in range(n_use):
        if W[:, k].mean() < 0:
            W[:, k] *= -1
            basis[k] *= -1
    if n_use < n:
        pad_b = np.zeros((n - n_use, V, 3), np.float32)
        pad_w = np.zeros((F, n - n_use), np.float32)
        basis = np.concatenate([basis, pad_b], 0)
        W = np.concatenate([W, pad_w], 1)
    return basis, W


def keyframe_pick(frames, times, n):
    """Pick n frames by equal spacing over times where magnitude is significant."""
    mags = np.array([np.linalg.norm(f) for f in frames])
    active = np.where(mags > mags.max() * 0.05)[0]
    if active.size == 0:
        active = np.arange(len(frames))
    if active.size <= n:
        idxs = list(active)
        while len(idxs) < n:
            idxs.append(active[-1] if active.size else 0)
        return idxs[:n]
    # equal quantiles
    qs = np.linspace(0, 1, n)
    idxs = []
    for q in qs:
        pos = active[0] + q * (active[-1] - active[0])
        idxs.append(int(round(pos)))
    # unique
    out = []
    for i in idxs:
        if i not in out:
            out.append(i)
    while len(out) < n:
        # fill gaps
        for i in range(len(frames)):
            if i not in out:
                out.append(i)
                break
    return out[:n]


def compose_at(deltas: dict, curves: dict, names: list[str], t: float) -> np.ndarray:
    """Compose weighted sum of named morphs at time t. deltas[name]=(V,3)."""
    any_d = next(iter(deltas.values()))
    out = np.zeros_like(any_d, dtype=np.float64)
    for n in names:
        if n not in deltas:
            continue
        w = eval_curve(curves.get(n, []), t)
        if abs(w) < 1e-8:
            continue
        out += w * deltas[n]
    return out.astype(np.float32)


def rebuild_weights_from_basis(frames, basis):
    """Least-squares weights per frame: min ||B w - d||. basis (n,V,3), frames list (V,3)."""
    n, V, _ = basis.shape
    B = basis.reshape(n, -1).T.astype(np.float64)  # (V*3, n)
    # ridge
    BtB = B.T @ B + 1e-8 * np.eye(n)
    BtB_inv = np.linalg.inv(BtB)
    Ws = []
    for f in frames:
        d = f.reshape(-1).astype(np.float64)
        w = BtB_inv @ (B.T @ d)
        Ws.append(w)
    return np.asarray(Ws, np.float32)


def curve_from_samples(times, weights_1d, dur):
    """Build [[t,w],...] with 0 at ends."""
    pts = []
    # force 0 at 0
    pts.append([0.0, 0.0])
    for t, w in zip(times, weights_1d):
        w = float(w)
        if t <= 1e-6 or t >= dur - 1e-6:
            continue
        pts.append([round(float(t), 6), round(w, 6)])
    pts.append([round(float(dur), 6), 0.0])
    # dedupe times
    out = []
    for p in pts:
        if out and abs(out[-1][0] - p[0]) < 1e-9:
            out[-1] = p
        else:
            out.append(p)
    return out


def process_mesh(g, mesh_name, meta, patch_curves, report):
    mesh = mesh_by_name(g, mesh_name)
    assert len(mesh["primitives"]) == 1, mesh_name
    prim = mesh["primitives"][0]
    names = target_names(mesh)
    targets = prim["targets"]
    assert len(names) == len(targets)
    nv = g.j["accessors"][prim["attributes"]["POSITION"]]['count']
    has_normal = any("NORMAL" in t for t in targets)

    # load all deltas
    deltas = {}
    for i, n in enumerate(names):
        deltas[n] = read_target_pos(g, targets[i]["POSITION"])

    bake_sit = [n for n in BAKE[mesh_name]["sit"] if n in deltas]
    bake_stand = [n for n in BAKE[mesh_name]["stand"] if n in deltas]
    safe_del = set(SAFE_DELETE.get(mesh_name, []))
    bake_all = set(bake_sit) | set(bake_stand)

    missing_sit = [n for n in BAKE[mesh_name]["sit"] if n not in deltas]
    missing_stand = [n for n in BAKE[mesh_name]["stand"] if n not in deltas]
    report[mesh_name] = {
        "before": len(names),
        "bake_sit_found": bake_sit,
        "bake_stand_found": bake_stand,
        "missing_sit": missing_sit,
        "missing_stand": missing_stand,
        "safe_delete": sorted(safe_del),
    }

    new_bases = {}  # name -> (V,3)
    new_curves = {"sit_down": {}, "stand_up": {}}  # name -> pts

    for side, bake_names in (("sit", bake_sit), ("stand", bake_stand)):
        clip = CLIP_FOR_SIDE[side]
        curves = meta["clips"][clip]["morph"]["curves"]
        dur = float(meta["clips"][clip]["duration_s"])
        fps = 30.0
        times = []
        t = 0.0
        while t <= dur + 1e-9:
            times.append(round(min(t, dur), 6))
            t += 1.0 / fps
        # also include peak times of each bake curve
        for n in bake_names:
            for pt in curves.get(n, []):
                times.append(round(float(pt[0]), 6))
        times = sorted(set(times))

        # sit_drape_blend_comp spans both clips — always include in composition if present
        comp_names = list(bake_names)
        if "sit_drape_blend_comp" in deltas and "sit_drape_blend_comp" not in comp_names:
            comp_names.append("sit_drape_blend_comp")
        frames = [compose_at(deltas, curves, comp_names, t) for t in times]
        mags = np.array([np.linalg.norm(f) for f in frames])
        print(f"  {mesh_name} {side}: {len(bake_names)} src, {len(times)} samples, peak_mag={mags.max():.6f}")

        # PCA basis
        # Use only frames with meaningful motion for SVD stability, but keep all times for curves
        active_idx = [i for i, m in enumerate(mags) if m > max(mags.max() * 0.02, 1e-7)]
        if not active_idx:
            active_idx = list(range(len(frames)))
        active_frames = [frames[i] for i in active_idx]
        basis, _ = pca_basis(active_frames, N_BASIS)  # (n,V,3)
        # Re-fit weights on ALL sample times
        W = rebuild_weights_from_basis(frames, basis)  # (F,n)

        # Measure reconstruction error
        err = []
        for i, f in enumerate(frames):
            recon = sum(float(W[i, k]) * basis[k] for k in range(N_BASIS))
            err.append(np.linalg.norm(f - recon))
        err = np.array(err)
        print(f"    recon RMSE={err.mean():.6f} max={err.max():.6f} (mesh units)")

        prefix = f"seat_bake_{side}"
        for k in range(N_BASIS):
            bname = f"{prefix}_{k}"
            # Skip near-zero basis
            if np.linalg.norm(basis[k]) < 1e-9:
                # still register empty? skip slot to save COUNT
                continue
            new_bases[bname] = basis[k].astype(np.float32)
            new_curves[clip][bname] = curve_from_samples(times, W[:, k], dur)

        report[mesh_name][f"{side}_recon_rmse"] = float(err.mean())
        report[mesh_name][f"{side}_recon_max"] = float(err.max())
        report[mesh_name][f"{side}_n_basis"] = sum(1 for k in range(N_BASIS) if f"{prefix}_{k}" in new_bases)

    # Build keep list (order preserved)
    keep_names = [n for n in names if n not in bake_all and n not in safe_del]
    # Map old target dicts
    name_to_tgt = {n: targets[i] for i, n in enumerate(names)}

    new_names = list(keep_names) + list(new_bases.keys())
    new_targets = [name_to_tgt[n] for n in keep_names]
    for bname, delta in new_bases.items():
        idx, vals = densify_to_sparse(delta)
        new_targets.append(add_sparse_vec3(g, nv, idx, vals, with_normal_zero=has_normal))
        print(f"    + {bname} sparse={idx.size}")

    prim["targets"] = new_targets
    mesh.setdefault("extras", {})["targetNames"] = new_names
    if "weights" in mesh and isinstance(mesh["weights"], list):
        mesh["weights"] = [0.0] * len(new_names)

    # name->index map for patch
    name_to_idx = {n: i for i, n in enumerate(new_names)}
    report[mesh_name]["after"] = len(new_names)
    report[mesh_name]["after_names"] = new_names
    report[mesh_name]["removed"] = [n for n in names if n not in new_names]
    report[mesh_name]["added"] = list(new_bases.keys())

    # Fill patch curves (draft) — only for this mesh's new bases; anim bot remaps indices
    for clip, cmap in new_curves.items():
        patch_curves.setdefault(clip, {})
        for bname, pts in cmap.items():
            patch_curves[clip][bname] = {
                "mesh": mesh_name,
                "index": name_to_idx[bname],
                "curve": pts,
                "replaces": bake_sit if "sit" in bname else bake_stand,
            }

    return name_to_idx


def process_body(g, report):
    mesh = mesh_by_name(g, "LOD0_G2_BODY")
    names = target_names(mesh)
    drop = "wrist_clearance_stand_up_0"
    if drop not in names:
        report["LOD0_G2_BODY"] = {"before": len(names), "after": len(names), "note": "wrist_0 already absent"}
        return {n: i for i, n in enumerate(names)}
    di = names.index(drop)
    new_names = [n for n in names if n != drop]
    for prim in mesh["primitives"]:
        tgts = prim["targets"]
        prim["targets"] = [t for i, t in enumerate(tgts) if i != di]
    mesh.setdefault("extras", {})["targetNames"] = new_names
    if "weights" in mesh and isinstance(mesh["weights"], list):
        mesh["weights"] = [0.0] * len(new_names)
    report["LOD0_G2_BODY"] = {
        "before": len(names), "after": len(new_names),
        "removed": [drop], "added": [],
        "after_names": new_names,
    }
    return {n: i for i, n in enumerate(new_names)}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = json.loads(META_C40.read_text())
    print("Loading", SRC_GLB)
    g = G(str(SRC_GLB))
    report = {"source": str(SRC_GLB), "meta_source": "c40de312 anim_meta"}
    patch = {
        "schema": "standup-perf-count-anim_meta-patch-draft/v1",
        "note": "DRAFT for 角色动画bot to rewire; not a final anim_meta. Tangents=Exclude.",
        "source_glb": str(SRC_GLB),
        "deleted": {},
        "added": {},
        "name_to_index": {},
        "curves": {},  # clip -> {morphName: {mesh,index,curve,replaces}}
        "bow_note": "BOW kept (bow_sit_drape / ribbon_bend_half / ribbon_bend); tip1 dropped BOW driver map — anim must re-verify",
    }

    # Pre-count
    before = {}
    for mn in ("LOD0_G2_APRON", "LOD0_G2_DRESS", "LOD0_G2_BODY", "LOD0_G2_BOW"):
        before[mn] = len(target_names(mesh_by_name(g, mn)))
    print("BEFORE", before)

    patch_curves = {}
    for mn in ("LOD0_G2_APRON", "LOD0_G2_DRESS"):
        print("Processing", mn)
        idxmap = process_mesh(g, mn, meta, patch_curves, report)
        patch["name_to_index"][mn] = idxmap
        patch["deleted"][mn] = report[mn]["removed"]
        patch["added"][mn] = report[mn]["added"]

    print("Processing BODY")
    idxmap = process_body(g, report)
    patch["name_to_index"]["LOD0_G2_BODY"] = idxmap
    patch["deleted"]["LOD0_G2_BODY"] = report["LOD0_G2_BODY"].get("removed", [])
    patch["added"]["LOD0_G2_BODY"] = []

    # BOW unchanged
    bow = mesh_by_name(g, "LOD0_G2_BOW")
    patch["name_to_index"]["LOD0_G2_BOW"] = {n: i for i, n in enumerate(target_names(bow))}
    report["LOD0_G2_BOW"] = {"before": 3, "after": 3, "removed": [], "added": [], "after_names": target_names(bow)}

    patch["curves"] = patch_curves

    # Suggested morph.meshes remaps for anim_meta
    patch["morph_meshes_targets_draft"] = {
        mn: patch["name_to_index"][mn] for mn in patch["name_to_index"]
    }

    print("Compacting...")
    prune_accessors(g)
    compact(g)
    print("Saving", OUT_GLB)
    g.save(str(OUT_GLB))
    sha = hashlib.sha256(OUT_GLB.read_bytes()).hexdigest()
    size = OUT_GLB.stat().st_size

    after = {mn: report[mn]["after"] for mn in ("LOD0_G2_APRON", "LOD0_G2_DRESS", "LOD0_G2_BODY", "LOD0_G2_BOW")}
    count_log = {
        "before": before,
        "after": after,
        "targets": {
            "APRON": "≤16 aggressive / ≤32 interim",
            "DRESS": "≤16 aggressive / ≤35 interim",
            "BODY": "≤16 (expect 15)",
            "BOW": 3,
        },
        "hit_interim": {
            "APRON": after["LOD0_G2_APRON"] <= 32,
            "DRESS": after["LOD0_G2_DRESS"] <= 35,
        },
        "hit_aggressive": {
            "APRON": after["LOD0_G2_APRON"] <= 16,
            "DRESS": after["LOD0_G2_DRESS"] <= 16,
        },
        "sha256": sha,
        "bytes": size,
        "tangents": "Exclude",
    }
    OUT_COUNT.write_text(json.dumps(count_log, indent=2, ensure_ascii=False) + "\n")
    OUT_PATCH.write_text(json.dumps(patch, indent=2, ensure_ascii=False) + "\n")
    (OUT_DIR / "bake_report_internal.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False, default=str) + "\n"
    )
    print("DONE", count_log)
    print("AFTER", after)


if __name__ == "__main__":
    main()
