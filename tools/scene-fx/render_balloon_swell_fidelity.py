#!/usr/bin/env python3
"""Pose-fidelity stills for the deflated pile.

The earlier compare applied envelopeLocalY with home.y = 0. The envelope node
lives at local y -3.05 under envelope_sway_pivot (y +3.05). That missing -3.05
lifted the t=0 cloth to about y 3–4, so a balloon appeared at the top of the
frame while the label still said crown 0.95 m. Runtime applyEnvelopeDrape uses
the node's real position. This script refuses to save a frame whose mesh crown
disagrees with balloonDrapePose.

The basket-close eye is BasketCloseShot's spot, used here only to re-render the
picture that was wrong. It is not a claim that this fixed eye is the live B1
lens for the whole inflate. liveWorldPose is not available offline.
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
OUT = ROOT / "product/2026-11-06/balloon-visible-swell"
HERE = Path(__file__).resolve().parent


def load_render():
    spec = importlib.util.spec_from_file_location("bal_render", HERE / "render_balloon_inflate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def poses():
    env = os.environ.copy()
    env["QF_TYPESCRIPT_MODULE"] = env.get("QF_TYPESCRIPT_MODULE", "/tmp/tsmod/node_modules/typescript")
    script = r"""
const path=require('path');
const H=require('./tools/board-ui/harness.cjs').createHarness();
const D=H.load(path.resolve('creator-build-project/assets/scripts/region/BalloonDrape.ts'));
const C=H.load(path.resolve('creator-build-project/assets/scripts/region/TransitionChain.ts'));
const B=H.load(path.resolve('creator-build-project/assets/scripts/region/BasketCloseShot.ts'));
const S=H.load(path.resolve('creator-build-project/assets/scripts/region/TransitionStaging.ts'));
const home={p:{x:0,y:-3.05,z:0},s:{x:1,y:1,z:1}};
const rings=[[3.05,0.620],[3.54,1],[4.03,1.487],[4.52,1.935],[5.01,2.309],[5.50,2.640],[5.99,2.819],[6.48,2.958],[6.97,2.989],[7.46,2.946],[7.95,2.860],[8.44,2.590],[8.93,2.245],[9.42,1.769],[9.91,1.080],[10.40,0]];
function rad(y){if(y<=rings[0][0])return rings[0][1];if(y>=rings.at(-1)[0])return rings.at(-1)[1];for(let i=1;i<rings.length;i++){const [y0,r0]=rings[i-1],[y1,r1]=rings[i];if(y<=y1)return r0+(r1-r0)*(y-y0)/(y1-y0);}return 0;}
function oldCap(mouth,sy){if(!(sy>1e-4))return 0.5/2.989;let maxR=0,any=false;const cons=h=>{const wy=mouth+(h-3.05)*sy;if(wy<=1.28){any=true;maxR=Math.max(maxR,rad(h));}};for(const ring of rings)cons(ring[0]);const hCut=3.05+(1.28-mouth)/sy;if(hCut>=3.05&&hCut<=10.4)cons(hCut);return !any||maxR<1e-4?1e9:0.5/maxR;}
function oldPose(t){
  const I=C.INFLATE,f=C.inflateAt(t);
  const uY=(f.sy-I.flatY)/(1-I.flatY),uX=(f.sxz-I.flatXZ)/(1-I.flatXZ);
  const sy=0.10+0.90*uY;
  const mouthY=uY>=1?3.05:0.22+(3.05-0.22)*Math.max(0,uY);
  const uSxz=uX>1?uX:Math.max(uX,Math.min(1,Math.max(0,uY))*0.75);
  const sxz=Math.min(0.17+0.83*uSxz, oldCap(mouthY,sy));
  const crownY=mouthY+(10.4-3.05)*sy;
  const frameBase=1.096175,frameTop=3.071971;
  const wantTop=Math.min(frameTop,mouthY+(frameTop-3.05));
  const grown=sxz+1e-6>=0.58&&wantTop>frameBase+0.12;
  const frameSy=grown?Math.min(1,Math.max(0,(wantTop-frameBase)/(frameTop-frameBase))):0;
  const pose={sy,sxz,mouthY,crownY,frameVisible:frameSy>0.02,frameSy,frameLocalY:frameBase*(1-frameSy),flameLocalY:frameSy>0.02?frameBase+(2.625-frameBase)*frameSy:Math.min(crownY-0.45,Math.max(0.45,mouthY+0.15))};
  pose.localY=D.envelopeLocalY(pose,home);
  pose.localYWrong=0+(mouthY-3.05)-3.05*(sy-1);
  return pose;
}
const her=S.TRANSITION_STAGING.basket.doorOut;
const spot=B.basketCloseSpot(her,[0,0,0],[]);
const times=[0,1,1.5,3];
process.stdout.write(JSON.stringify({
  eye:spot.position, target:[her[0], her[1]+B.BASKET_CLOSE.lookUpM, her[2]], fov:B.BASKET_CLOSE.fovDeg,
  times:times.map(t=>{
    const p=D.balloonDrapePose(t);
    return {t, before:oldPose(t), after:Object.assign({localY:D.envelopeLocalY(p,home)}, p)};
  })
}));
"""
    return json.loads(subprocess.check_output(["node", "-e", script], cwd=ROOT, env=env))


def mesh_local(R, js, blob):
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    i = names["balloon_envelope"]
    prim = js["meshes"][js["nodes"][i]["mesh"]]["primitives"][0]
    return R.read_acc(js, blob, prim["attributes"]["POSITION"]).astype(np.float64).reshape(-1, 3)


def world_y(local, pose):
    """Pivot y 3.05 + envelope local translation + mesh y * sy. Matches the glTF parent."""
    return 3.05 + pose["localY"] + local[:, 1] * pose["sy"]


def main():
    R = load_render()
    R.W, R.H = 390, 844
    js, blob = R.load_glb(R.GLB)
    images, world_of = R.gather(js, blob)
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    local = mesh_local(R, js, blob)
    pack = poses()
    font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 22)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()

    def checked(pose, tag):
        wy = world_y(local, pose)
        crown, foot = float(wy.max()), float(wy.min())
        if abs(crown - pose["crownY"]) > 0.02:
            raise SystemExit(f"{tag} mesh crown {crown:.3f} != pose {pose['crownY']:.3f}")
        return crown, foot

    b0 = pack["times"][0]["before"]
    wrong = dict(b0)
    wrong["localY"] = b0["localYWrong"]
    wrong_crown = float(world_y(local, wrong).max())
    right_crown, right_foot = checked(b0, "before t=0")
    if not (right_crown < 1.15 and wrong_crown > 2.5):
        raise SystemExit(f"expected the home.y=0 bug to lift the cloth, right={right_crown:.3f} wrong={wrong_crown:.3f}")
    print(f"reconcile before t=0: runtime mesh crown {right_crown:.3f} (inside the rim), home.y=0 bug crown {wrong_crown:.3f}")

    def shoot(pose, eye, target, fov, label):
        crown, foot = checked(pose, label)
        env, frame, flame = names["balloon_envelope"], names["balloon_load_frame"], names["burner_flame"]
        ov = {env: {"translation": [0, pose["localY"], 0], "scale": [pose["sxz"], pose["sy"], pose["sxz"]]}}
        hide = set()
        if pose["frameVisible"]:
            ov[frame] = {"translation": [0, pose["frameLocalY"], 0], "scale": [1, pose["frameSy"], 1]}
        else:
            hide.add("balloon_load_frame")
        if pose["t"] <= 0:
            hide.add("burner_flame")
        else:
            ov[flame] = {"translation": [0, pose["flameLocalY"], 0], "scale": [1, 1, 1]}
        tris = R.build_scene(js, blob, images, world_of, ov, hide)
        img = Image.fromarray(R.render(tris, np.array(eye, float), np.array(target, float), fov))
        d = ImageDraw.Draw(img)
        d.rectangle((0, 0, img.width, 64), fill=(12, 16, 24))
        d.text((8, 4), label, fill=(255, 255, 255), font=font)
        d.text((8, 32), f"mesh y {foot:.2f}..{crown:.2f}  pose crown {pose['crownY']:.2f}", fill=(220, 230, 210), font=font)
        return img

    eye, target, fov = pack["eye"], pack["target"], pack["fov"]
    # Same BasketCloseShot eye as the rejected compare, now with the runtime local Y.
    pair = []
    for kind in ("before", "after"):
        pose = dict(pack["times"][0][kind])
        pose["t"] = 0
        checked(pose, kind + " t=0")
        zh = "修复前 运行时" if kind == "before" else "修复后 运行时"
        img = shoot(pose, eye, target, fov, f"{zh} t=0")
        img.save(OUT / f"fidelity-close-{kind}-t0.png")
        pair.append(img)
        print("saved", kind, "t0", "crown", round(pose["crownY"], 3))
    both = Image.new("RGB", (pair[0].width * 2 + 8, pair[0].height), (12, 16, 24))
    both.paste(pair[0], (0, 0))
    both.paste(pair[1], (pair[0].width + 8, 0))
    both.save(OUT / "fidelity-compare-t0.png")

    # Whole-balloon eye. Not the game camera: one eye far enough that t=3 fits,
    # so the four poses can be compared without a crop pretending to be a stage.
    wide_eye, wide_at, wide_fov = (7.2, 5.4, 16.5), (0.0, 4.8, 0.0), 42
    frames = []
    for row in pack["times"]:
        pose = dict(row["after"])
        pose["t"] = row["t"]
        img = shoot(pose, wide_eye, wide_at, wide_fov, f"非游戏镜头 姿态 t={row['t']:.1f}")
        img.save(OUT / f"pose-shape-t{row['t']:.1f}.png")
        frames.append(img)
        print("shape", row["t"], round(pose["crownY"], 2))
    strip = Image.new("RGB", (frames[0].width * 4 + 24, frames[0].height), (12, 16, 24))
    for i, img in enumerate(frames):
        strip.paste(img, (i * (img.width + 8), 0))
    strip.save(OUT / "pose-shape-strip.png")
    (OUT / "fidelity.json").write_text(json.dumps({
        "notGameCamera": True,
        "notCocos": True,
        "liveWorldPose": "unavailable offline",
        "bug": {"homeYUsed": 0, "meshCrownM": round(wrong_crown, 3), "note": "previous compare; not a runtime pose"},
        "beforeT0": {"meshCrownM": round(right_crown, 3), "poseCrownM": round(b0["crownY"], 3), "localY": round(b0["localY"], 4)},
        "closeEye": {"position": eye, "target": target, "fov": fov, "source": "BasketCloseShot.basketCloseSpot at the meadow door, one fixed eye"},
        "wideEye": {"position": list(wide_eye), "target": list(wide_at), "fov": wide_fov, "source": "framing check only, not liveWorldPose"},
    }, indent=2) + "\n")
    print("fidelity ok")


if __name__ == "__main__":
    main()
