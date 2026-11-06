#!/usr/bin/env python3
"""Dense swell curve and a wide-camera strip of the readable deflate-to-balloon rise.

Pose numbers come from BalloonDrape.ts through the node harness (pose replay, not Cocos).
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "product/2026-11-05/balloon-inflate/r2"
HERE = Path(__file__).resolve().parent


def poses(times):
    env = os.environ.copy()
    env["QF_TYPESCRIPT_MODULE"] = env.get("QF_TYPESCRIPT_MODULE", "/tmp/tsmod/node_modules/typescript")
    script = f"""
const path=require('path');
const H=require('./tools/board-ui/harness.cjs').createHarness();
const D=H.load(path.resolve('creator-build-project/assets/scripts/region/BalloonDrape.ts'));
const times={json.dumps(times)};
const home={{p:{{x:0,y:-3.05,z:0}},s:{{x:1,y:1,z:1}}}};
process.stdout.write(JSON.stringify(times.map(t=>{{
  const p=D.balloonDrapePose(t);
  return {{t, localY:D.envelopeLocalY(p, home), sxz:p.sxz, sy:p.sy, mouthY:p.mouthY, crownY:p.crownY,
    horizR:2.989*p.sxz, cap:D.basketSxzCap(p.mouthY,p.sy), frameVisible:p.frameVisible,
    frameSy:p.frameSy, frameLocalY:p.frameLocalY, frameSxz:p.frameSxz, flameLocalY:p.flameLocalY}};
}})));
"""
    return json.loads(subprocess.check_output(["node", "-e", script], cwd=ROOT, env=env))


def load_r2():
    spec = importlib.util.spec_from_file_location("r2", HERE / "render_balloon_clearance_r2.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def plot(samples, release_t):
    font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 18)
    small = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 14)
    keys = [("sxz", "水平缩放 sxz", (220, 90, 70)), ("mouthY", "嘴高 mouthY (m)", (40, 90, 160)),
            ("crownY", "顶高 crownY (m)", (30, 120, 70)), ("horizR", "最大水平半径 (m)", (120, 70, 160))]
    W, H, left, top = 1100, 220 * len(keys) + 40, 70, 36
    img = Image.new("RGB", (W, H), (248, 246, 240))
    draw = ImageDraw.Draw(img)
    ts = [s["t"] for s in samples]
    t0, t1 = ts[0], ts[-1]
    for i, (key, title, col) in enumerate(keys):
        y0 = 20 + i * 220
        draw.text((left, y0), title, fill=(20, 20, 20), font=font)
        plot_top, plot_bot = y0 + 32, y0 + 190
        vals = [s[key] for s in samples]
        vmin, vmax = min(vals), max(vals)
        if vmax - vmin < 1e-6:
            vmax = vmin + 1
        draw.rectangle((left, plot_top, W - 30, plot_bot), outline=(180, 180, 180))
        pts = []
        for t, v in zip(ts, vals):
            x = left + (t - t0) / (t1 - t0) * (W - 30 - left)
            y = plot_bot - (v - vmin) / (vmax - vmin) * (plot_bot - plot_top)
            pts.append((x, y))
        draw.line(pts, fill=col, width=2)
        rx = left + (release_t - t0) / (t1 - t0) * (W - 30 - left)
        draw.line((rx, plot_top, rx, plot_bot), fill=(180, 40, 40))
        draw.text((left + 6, plot_top + 4), f"{vmax:.2f}", fill=(60, 60, 60), font=small)
        draw.text((left + 6, plot_bot - 18), f"{vmin:.2f}", fill=(60, 60, 60), font=small)
        draw.text((rx + 4, plot_top + 4), "封顶解除", fill=(180, 40, 40), font=small)
    img.save(OUT / "swell-curve.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    times = [round(i * 0.01, 2) for i in range(301)]
    rows = poses(times)
    release = next(s["t"] for s in rows if s["cap"] > 2)
    steps = [abs(rows[i]["sxz"] - rows[i - 1]["sxz"]) for i in range(1, len(rows))]
    summary = {
        "kind": "pose-replay",
        "notCocosDevice": True,
        "note": "Dense 0.01 s replay of balloonDrapePose. Not a Cocos device run.",
        "capReleaseT": release,
        "maxAbsDsxzPer001s": round(max(steps), 4),
        "maxAbsDsxzAtT": rows[1 + int(np.argmax(steps))]["t"],
        "markers": {str(t): next(s for s in rows if abs(s["t"] - t) < 1e-6) for t in (0, 0.35, 0.7, 1.2, 1.8, 3)},
    }
    for k, s in summary["markers"].items():
        summary["markers"][k] = {kk: (round(vv, 4) if isinstance(vv, float) else vv) for kk, vv in s.items() if kk != "cap"}
        summary["markers"][k]["cap"] = None if s["cap"] > 2 else round(s["cap"], 4)
    (OUT / "swell-curve-offline.json").write_text(json.dumps(summary, indent=2) + "\n")
    # keep the dense table too, without huge duplication of the runtime file
    (OUT / "swell-curve-dense.json").write_text(json.dumps({
        "stepS": 0.01, "notCocosDevice": True,
        "samples": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in s.items()} for s in rows],
    }) + "\n")
    plot(rows, release)
    r2 = load_r2()
    R = r2.load_render()
    js, blob = R.load_glb(R.GLB)
    images, world_of = R.gather(js, blob)
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    by_t = {round(s["t"], 2): s for s in rows}
    eye, at, fov = (8.6, 7.6, 14.2), (0.0, 4.6, 0.0), 30
    basket_eye, basket_at, basket_fov = (3.2, 2.4, 4.6), (0.0, 0.9, 0.0), 32
    seq = [0.0, 0.2, 0.35, 0.55, 0.75, 1.0, 1.4, 2.0, 3.0]
    frames, close = [], []
    for t in seq:
        pose = by_t[round(t, 2)]
        wide = R.label(r2.shoot(R, js, blob, images, world_of, names, pose, eye, at, fov, t <= 0), f"t={t:.2f}s  顶 {pose['crownY']:.1f}m")
        wide.save(OUT / f"swell-wide-t{t:.2f}.png")
        frames.append(wide)
        if t <= 1.0:
            near = R.label(r2.shoot(R, js, blob, images, world_of, names, pose, basket_eye, basket_at, basket_fov, t <= 0), f"篮近景 t={t:.2f}s")
            near.save(OUT / f"swell-basket-t{t:.2f}.png")
            close.append(near)
        print("frame", t)
    def strip(imgs, name):
        canvas = Image.new("RGB", (imgs[0].width * len(imgs) + 6 * (len(imgs) - 1), imgs[0].height), (16, 22, 32))
        for i, im in enumerate(imgs):
            canvas.paste(im, (i * (im.width + 6), 0))
        canvas.save(OUT / name)
    strip(frames, "swell-seq-wide.png")
    strip(close, "swell-seq-basket.png")
    print("release", release, "max step", summary["maxAbsDsxzPer001s"])


if __name__ == "__main__":
    main()
