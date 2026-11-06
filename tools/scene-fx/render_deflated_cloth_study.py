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
DIR_BANNER = "离线方向小样，非游戏镜头，未接运行时"


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


def direction_lobes(P, is_blue):
    """Sagging skin, height order kept. Two broad gathers of different size,
    not eight equal teeth. Blue vertices stay a band and dip into one tuck.
    A patch of upper red/yellow lays over that tuck. Not runtime."""
    u = np.clip((P[:, 1] - 3.05) / 7.35, 0.0, 1.0)
    th = np.arctan2(P[:, 2], P[:, 0])
    # Camera is on +Z. Gathers are stronger there, and not a full equal ring.
    face = np.clip(np.cos(th - 1.35), 0.0, 1.0)
    g1 = np.sin(th * 2.1 + 0.4)
    g2 = np.sin(th * 3.4 - 0.9)
    gather = face * (0.10 * g1 + 0.04 * g2)
    tuck = np.clip((u - 0.86) / 0.14, 0.0, 1.0)
    y = 0.46 + 0.52 * u + 0.05 * gather
    r = 0.20 + 0.28 * np.clip(u, 0.0, 1.0) + gather
    r = np.clip(r, 0.12, 0.58)
    blue = is_blue.astype(np.float64)
    # One gap in the band: blue on the right-front drops under the cloth.
    hide = blue * np.clip(np.cos(th - 2.0), 0.0, 1.0)
    y = y * (1.0 - 0.45 * hide) + 0.48 * hide
    r = r * (1.0 - 0.25 * hide)
    # Upper red/yellow lays across that gap.
    cover = (1.0 - blue) * np.clip((u - 0.58) / 0.12, 0.0, 1.0) * np.clip(np.cos(th - 1.9), 0.0, 1.0)
    cover = cover * (1.0 - tuck)
    y = y * (1.0 - cover) + 0.70 * cover
    r = r * (1.0 - 0.2 * cover)
    th2 = th + 0.35 * cover
    y = y * (1.0 - tuck) + 0.50 * tuck
    r = r * (1.0 - 0.5 * tuck) + 0.14 * tuck
    y = np.clip(y, 0.44, 1.05)
    return np.column_stack((r * np.cos(th2), y, r * np.sin(th2)))


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


def build_board(pair, board_dir, font):
    """One sheet: source crops with limits, then the same-eye r1 vs proposal."""
    ref = board_dir / "reference"
    r1 = Image.open(ref / "R1_deflating_a_hot_air_balloon_1.jpg").convert("RGB")
    r3 = Image.open(ref / "R3_westown_deflating_envelope.jpg").convert("RGB")
    # Bottom pool of R1, where the bands wrinkle into the ground. Not a basket.
    r1c = r1.crop((0, int(r1.height * 0.62), r1.width, r1.height))
    # Lower sidewall of R3, where the skin sags. Not our colors, not our basket.
    r3c = r3.crop((80, 180, 780, 640))
    small = font.font_variant(size=18) if hasattr(font, "font_variant") else font
    cap_h = 78
    def tile(im, w, h, lines):
        im = im.resize((w, h - cap_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (w, h), (245, 242, 234))
        canvas.paste(im, (0, 0))
        d = ImageDraw.Draw(canvas)
        d.rectangle((0, h - cap_h, w, h), fill=(245, 242, 234))
        for i, line in enumerate(lines):
            d.text((8, h - cap_h + 6 + i * 22), line, fill=(40, 36, 28), font=small)
        return canvas
    tw, th = 560, 360
    t1 = tile(r1c, tw, th, ["R1 Neuroxic CC BY 4.0", "底部色带随布弯、松堆。不是篮内高度。"])
    t3 = tile(r3c, tw, th, ["R3 Pennington CC BY-SA 2.0", "侧壁塌软。不是我们的配色，也不是篮内折法。"])
    note_h = 150
    width = pair.width
    # scale reference row to the pair width
    gap = 12
    scale = (width - gap) / (tw * 2)
    t1 = t1.resize((int(tw * scale), int(th * scale)), Image.Resampling.LANCZOS)
    t3 = t3.resize((width - gap - t1.width, int(th * scale)), Image.Resampling.LANCZOS)
    head_h = 168
    board = Image.new("RGB", (width, head_h + t1.height + gap + note_h + gap + pair.height + 64), (245, 242, 234))
    d = ImageDraw.Draw(board)
    d.text((16, 12), DIR_BANNER, fill=(90, 40, 20), font=font)
    d.text((16, 44), "结构：低丘搭覆。蓝环带贴在同一张皮上，翻过红黄丘时是断开的弯条。", fill=(40, 36, 28), font=small)
    d.text((16, 70), "不是一整块竖直蓝板，不是等距尖峰，不是缩小的满气球。", fill=(40, 36, 28), font=small)
    d.text((16, 96), "R2 地面长堆、F1 厚布层叠只借丘和搭覆，不作篮内事实。", fill=(40, 36, 28), font=small)
    d.text((16, 122), "篮内是压缩转译，不声称与实拍篮内一致。吊篮与巡航网格未改。", fill=(40, 36, 28), font=small)
    y = head_h
    board.paste(t1, (0, y))
    board.paste(t3, (t1.width + gap, y))
    y += t1.height + gap
    d.text((16, y), "下图与 r1 同一只眼、同一盏灯。左 r1，右本次提案。未接运行时。", fill=(40, 36, 28), font=small)
    y += note_h - 40
    board.paste(pair, (0, y))
    y += pair.height + 8
    d.text((12, y), "来源：R1 commons File:Deflating_a_hot_air_balloon_1.JPG · R3 Geograph 3607030 / CC BY-SA 2.0", fill=(70, 64, 54), font=small)
    board.save(board_dir / "direction-board.png")
    print("board", board.size)


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
    prim = js["meshes"][js["nodes"][env_i]["mesh"]]["primitives"][0]
    tex_i = js["materials"][prim["material"]]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    tex = images[js["textures"][tex_i]["source"]]
    thH, thW = tex.shape[:2]
    uv = R.read_acc(js, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float64).reshape(-1, 2)
    is_blue = np.zeros(len(pos), dtype=bool)
    for k in range(len(pos)):
        uu, vv = uv[k]
        x = int(np.clip(uu, 0, 0.999) * (thW - 1))
        yy = int(np.clip(vv, 0, 0.999) * (thH - 1))
        c = tex[yy, x].astype(int)
        is_blue[k] = c[2] > c[0] + 25 and c[2] > 80
    pile_dir = direction_lobes(pos, is_blue)
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
    dir_tris = tris_from(R, js, blob, images, env_i, pile_dir, nrm, uv, idx, ident)
    left = label(Image.fromarray(R.render(basket_tris + r1_tris, eye, target, fov)), font, "r1 已否：直立硬折扇（未接入运行时）")
    right = label(Image.fromarray(R.render(basket_tris + dir_tris, eye, target, fov)), font, "方向提案：低丘搭覆（未接入运行时）")
    # Retitle with the direction banner on the pair used for the board.
    def retitle(img, sub):
        d = ImageDraw.Draw(img)
        d.rectangle((0, 0, img.width, 72), fill=(12, 16, 24))
        d.text((8, 6), DIR_BANNER, fill=(255, 220, 160), font=font)
        d.text((8, 38), sub, fill=(255, 255, 255), font=font)
        return img
    left, right = retitle(left, "r1 已否：等距尖峰"), retitle(right, "提案：蓝带随丘弯折")
    both = Image.new("RGB", (left.width * 2 + 8, left.height), (12, 16, 24))
    both.paste(left, (0, 0))
    both.paste(right, (left.width + 8, 0))
    board_dir = ROOT / "product/2026-11-06/balloon-direction-study"
    board_dir.mkdir(parents=True, exist_ok=True)
    left.save(board_dir / "direction-r1.png")
    right.save(board_dir / "direction-proposed.png")
    both.save(board_dir / "direction-same-view.png")
    build_board(both, board_dir, font)
    y = pile_dir[:, 1]
    rad = np.hypot(pile_dir[:, 0], pile_dir[:, 2])
    (board_dir / "direction.json").write_text(json.dumps({
        "specimen": "proposed-geometry-only",
        "runtimeImplementation": False,
        "productionPR72": "A observability and B scale-shape both unapproved; this board does not change them",
        "cruiseMesh": "unchanged transport_balloon.glb",
        "basket": "authored balloon_basket, unscaled",
        "sameEyeAsR1Review": {"eye": eye.tolist(), "target": target.tolist(), "fov": fov, "light": "render_balloon_inflate.render fixed light"},
        "structure": "unequal low lobes; blue band is the lower-mid skin and should cross the lobes as curved strips; upper red/yellow is the crest; one overlap",
        "proposed": {"yMin": round(float(y.min()), 3), "yMax": round(float(y.max()), 3), "rMax": round(float(rad.max()), 3)},
        "label": DIR_BANNER,
        "sources": [
            "R1 Neuroxic CC BY 4.0 https://commons.wikimedia.org/wiki/File:Deflating_a_hot_air_balloon_1.JPG",
            "R3 Mike Pennington CC BY-SA 2.0 https://commons.wikimedia.org/wiki/File:Deflating_the_envelope_of_a_hot_air_balloon_at_Westown_-_geograph.org.uk_-_3607030.jpg",
            "R2 Neuroxic CC BY 4.0 ground layout, not basket evidence",
            "F1 Elinkorn CC BY-SA 4.0 upholstery overlap only, not balloon nylon",
        ],
    }, indent=2) + "\n")
    print("direction y", round(float(y.min()), 3), round(float(y.max()), 3), "r", round(float(rad.max()), 3))
    print("wrote", board_dir)


if __name__ == "__main__":
    main()
