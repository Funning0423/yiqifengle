#!/usr/bin/env python3
"""Split the hot-air balloon load frame out of balloon_basket.

The corner poles, grey burner platform, load rods and pennant are one mesh with the
wicker basket, so the inflate scale (which only touches balloon_envelope) can never
fold them. Triangles whose highest vertex is above the rim (y > 1.20) become a new
node `balloon_load_frame` (mesh index 4, appended — existing gltf mesh indices stay).
Identity transform: the inflated balloon is the same triangles in the same place.
No shared edges with the basket body, so the rim stays closed.

Idempotent: if balloon_load_frame is already there, exit 0.
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
GLB = ROOT / "creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb"
RIM_Y = 1.20
FRAME_NODE = "balloon_load_frame"


def load_glb(path: Path):
    data = path.read_bytes()
    assert data[:4] == b"glTF"
    off = 12
    ln, typ = struct.unpack_from("<II", data, off)
    off += 8
    assert typ == 0x4E4F534A
    js = json.loads(data[off : off + ln])
    off += ln
    ln2, typ2 = struct.unpack_from("<II", data, off)
    off += 8
    assert typ2 == 0x004E4942
    return js, data[off : off + ln2]


def read_acc(js, blob, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    dt = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}[a["componentType"]]
    stride = bv.get("byteStride", np.dtype(dt).itemsize * ncomp)
    arr = np.ndarray((a["count"], ncomp), dtype=dt, buffer=blob, offset=start, strides=(stride, np.dtype(dt).itemsize))
    return np.array(arr)


def pack_glb(js, blob: bytes) -> bytes:
    text = json.dumps(js, separators=(",", ":")).encode("utf-8")
    while len(text) % 4:
        text += b" "
    pad = (4 - (len(blob) % 4)) % 4
    blob = blob + b"\x00" * pad
    total = 12 + 8 + len(text) + 8 + len(blob)
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(text), 0x4E4F534A) + text
    out += struct.pack("<II", len(blob), 0x004E4942) + blob
    assert len(out) == total
    return out


def take(pos, nrm, uv, idx, mask):
    tris = idx[mask]
    used = np.unique(tris.reshape(-1))
    remap = -np.ones(len(pos), np.int32)
    remap[used] = np.arange(len(used), dtype=np.int32)
    return pos[used], nrm[used], uv[used], remap[tris].astype(np.uint32)


def main():
    js, blob = load_glb(GLB)
    names = [n.get("name") for n in js["nodes"]]
    if FRAME_NODE in names:
        print("balloon_load_frame already present; nothing to do")
        return 0
    basket_node = next(i for i, n in enumerate(js["nodes"]) if n.get("name") == "balloon_basket")
    mesh_i = js["nodes"][basket_node]["mesh"]
    prim = js["meshes"][mesh_i]["primitives"][0]
    pos = read_acc(js, blob, prim["attributes"]["POSITION"]).astype(np.float32)
    nrm = read_acc(js, blob, prim["attributes"]["NORMAL"]).astype(np.float32)
    uv = read_acc(js, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float32)
    idx = read_acc(js, blob, prim["indices"]).reshape(-1, 3).astype(np.int64)
    ymax = pos[idx][:, :, 1].max(1)
    frame = ymax > RIM_Y
    body = ~frame
    # The rim and the poles do not share edges; splitting must not open a hole.
    def edge_set(mask):
        s = set()
        for t in idx[mask]:
            for a, b in ((0, 1), (1, 2), (2, 0)):
                i, j = int(t[a]), int(t[b])
                s.add((i, j) if i < j else (j, i))
        return s

    shared = edge_set(frame) & edge_set(body)
    if shared:
        raise SystemExit(f"frame/body share {len(shared)} edges; refusing to open the rim")
    b_pos, b_nrm, b_uv, b_idx = take(pos, nrm, uv, idx, body)
    f_pos, f_nrm, f_uv, f_idx = take(pos, nrm, uv, idx, frame)
    # Union of the two parts must be the original triangles (same vertices, no weld).
    if len(b_idx) + len(f_idx) != len(idx):
        raise SystemExit("triangle count changed")
    print(
        f"basket tris {len(idx)} -> body {len(b_idx)} + frame {len(f_idx)}; "
        f"frame y {f_pos[:,1].min():.4f}..{f_pos[:,1].max():.4f}"
    )

    # Rebuild every accessor so the new frame mesh can be appended. Images are copied
    # byte-for-byte. Mesh order stays 0 basket, 1 flame, 2 envelope, 3 door, 4 frame.
    chunks = []
    views = []
    accs = []

    def align(target_multiple=4):
        while sum(len(c) for c in chunks) % target_multiple:
            chunks.append(b"\x00")

    def add_array(arr: np.ndarray, gl_type: str, comp: int, target: int | None):
        align(4)
        raw = np.ascontiguousarray(arr).tobytes()
        off = sum(len(c) for c in chunks)
        chunks.append(raw)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(raw), **({"target": target} if target else {})})
        flat = arr.reshape(arr.shape[0], -1) if arr.ndim == 1 else arr
        # SCALAR comes in 1d
        if arr.ndim == 1:
            mn = [float(arr.min())] if gl_type != "SCALAR" else None
            entry = {
                "bufferView": len(views) - 1,
                "componentType": comp,
                "count": int(arr.shape[0]),
                "type": gl_type,
            }
            if gl_type == "SCALAR":
                entry["min"] = [int(arr.min())]
                entry["max"] = [int(arr.max())]
            return len(accs) + 0 if False else _push(entry)
        mn = flat.min(0).astype(float).tolist()
        mx = flat.max(0).astype(float).tolist()
        entry = {
            "bufferView": len(views) - 1,
            "componentType": comp,
            "count": int(arr.shape[0]),
            "type": gl_type,
            "min": [float(x) for x in mn],
            "max": [float(x) for x in mx],
        }
        return _push(entry)

    def _push(entry):
        accs.append(entry)
        return len(accs) - 1

    def add_vec(arr, typ, comp, target):
        return add_array(arr, typ, comp, target)

    new_prims = []
    # preserve mesh order
    for mi, mesh in enumerate(js["meshes"]):
        prim = mesh["primitives"][0]
        if mi == mesh_i:
            p, n, t, ix = b_pos, b_nrm, b_uv, b_idx.astype(np.uint16)
        else:
            p = read_acc(js, blob, prim["attributes"]["POSITION"]).astype(np.float32)
            n = read_acc(js, blob, prim["attributes"]["NORMAL"]).astype(np.float32)
            t = read_acc(js, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float32)
            ix = read_acc(js, blob, prim["indices"]).reshape(-1).astype(np.uint16 if read_acc(js, blob, prim["indices"]).dtype != np.uint32 else np.uint32)
            if ix.dtype == np.uint32 and ix.max() < 65535:
                ix = ix.astype(np.uint16)
        ip = add_vec(p, "VEC3", 5126, 34962)
        inn = add_vec(n, "VEC3", 5126, 34962)
        iuv = add_vec(t, "VEC2", 5126, 34962)
        itype = 5123 if ix.dtype == np.uint16 else 5125
        ii = add_array(ix.reshape(-1), "SCALAR", itype, 34963)
        new_prims.append(
            {
                "attributes": {"POSITION": ip, "NORMAL": inn, "TEXCOORD_0": iuv},
                "indices": ii,
                "material": prim.get("material", 0),
            }
        )
    # frame
    ip = add_vec(f_pos, "VEC3", 5126, 34962)
    inn = add_vec(f_nrm, "VEC3", 5126, 34962)
    iuv = add_vec(f_uv, "VEC2", 5126, 34962)
    ii = add_array(f_idx.astype(np.uint16).reshape(-1), "SCALAR", 5123, 34963)
    frame_prim = {
        "attributes": {"POSITION": ip, "NORMAL": inn, "TEXCOORD_0": iuv},
        "indices": ii,
        "material": js["meshes"][mesh_i]["primitives"][0].get("material", 0),
    }
    # images: copy the PNG bytes in their existing order
    image_views = []
    for im in js["images"]:
        bv = js["bufferViews"][im["bufferView"]]
        start = bv.get("byteOffset", 0)
        raw = blob[start : start + bv["byteLength"]]
        align(4)
        off = sum(len(c) for c in chunks)
        chunks.append(raw)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(raw)})
        image_views.append(len(views) - 1)

    bin_blob = b"".join(chunks)
    meshes = []
    for mesh, prim in zip(js["meshes"], new_prims):
        m = {"name": mesh.get("name"), "primitives": [prim]}
        if mesh.get("extras"):
            m["extras"] = mesh["extras"]
        meshes.append(m)
    meshes.append({"name": FRAME_NODE, "primitives": [frame_prim]})
    nodes = json.loads(json.dumps(js["nodes"]))
    nodes.append(
        {
            "mesh": len(meshes) - 1,
            "name": FRAME_NODE,
            "extras": {
                "role": "load frame above the rim: corner poles, burner platform, rods, pennant. "
                "Identity at rest (same place as when these tris lived on balloon_basket). "
                "BalloonDrape scales it about the rim so it stays inside the cloth until the mouth rises."
            },
        }
    )
    root = next(i for i, n in enumerate(nodes) if n.get("name") == "transport_balloon")
    nodes[root].setdefault("children", []).append(len(nodes) - 1)
    images = []
    for im, vi in zip(js["images"], image_views):
        images.append({"bufferView": vi, "mimeType": im.get("mimeType", "image/png"), "name": im.get("name")})
    out_js = {
        "asset": js["asset"],
        "scene": js.get("scene", 0),
        "scenes": js["scenes"],
        "nodes": nodes,
        "materials": js["materials"],
        "meshes": meshes,
        "textures": js["textures"],
        "images": images,
        "accessors": accs,
        "bufferViews": views,
        "samplers": js.get("samplers", []),
        "buffers": [{"byteLength": len(bin_blob)}],
    }
    GLB.write_bytes(pack_glb(out_js, bin_blob))
    # verify round-trip
    js2, blob2 = load_glb(GLB)
    assert any(n.get("name") == FRAME_NODE for n in js2["nodes"])
    assert js2["meshes"][0]["name"] == "balloon_basket"
    assert js2["meshes"][4]["name"] == FRAME_NODE
    assert js2["nodes"][0]["mesh"] == 0 and js2["nodes"][2]["mesh"] == 1 and js2["nodes"][4]["mesh"] == 2
    print(f"wrote {GLB} ({GLB.stat().st_size} bytes), meshes {len(js2['meshes'])}, nodes {len(js2['nodes'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
