#!/usr/bin/env python3
"""Offline pictures of the radial shell under recorded B1 poses.

Not a Cocos frame and not liveWorldPose. The eye comes from
tools/transitions-continuous/fixtures/m2-camtrace-full.txt (writer
BalloonTransit:B1). World poses are converted with the B1 t=0 vehicle from
BalloonFlight, the same yaw convention as basketToWorld. The raster is
render_balloon_inflate.py. Subdivision in BalloonCloth lies on these faces
(midpoint lift is 0), so the picture is that surface.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "product/2026-11-06/balloon-mound-cloth"
HERE = Path(__file__).resolve().parent


def load_render():
    import importlib.util
    spec = importlib.util.spec_from_file_location("bal_render", HERE / "render_balloon_inflate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def pack():
    script = r"""
const fs=require('fs'),path=require('path');
const ROOT=path.resolve('.');
const H=require('./tools/board-ui/harness.cjs').createHarness();
const S=path.join(ROOT,'creator-build-project/assets/scripts/');
const C=H.load(S+'region/BalloonCloth.ts');
const D=H.load(S+'region/BalloonDrape.ts');
const TL=H.load(S+'region/TransportLeg.ts');
const BF=H.load(S+'region/BalloonFlight.ts');
global.__QF_BALLOON_FLIGHT=JSON.parse(fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json'),'utf8'));
const M2={yawDeg:180,origin:[-1.7,-1.35,79.1]};
const frameFns=f=>{const r=f.yawDeg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return {w:p=>[f.origin[0]+c*p[0]+s*p[2],f.origin[1]+p[1],f.origin[2]-s*p[0]+c*p[2]]};};
const plan=TL.balloonBeats(frameFns(M2).w(BF.M6_LOCAL),BF.S0_LOCAL,[0,0,0],{meadowFrame:M2,walkInM:0,walkOutM:0});
const v0=plan.vehicle(0);
const yaw=v0.yaw, c=Math.cos(yaw), s=Math.sin(yaw), o=v0.pos;
const toLocal=p=>{const dx=p[0]-o[0], dy=p[1]-o[1], dz=p[2]-o[2]; return [dx*c-dz*s, dy, dx*s+dz*c];};
const b=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb'));
const n=b.readUInt32LE(12), json=JSON.parse(b.slice(20,20+n).toString('utf8'));
const bin=b.slice(20+n+8, 20+n+8+b.readUInt32LE(20+n));
function arr(i){const a=json.accessors[i], bv=json.bufferViews[a.bufferView]; const start=(bv.byteOffset||0)+(a.byteOffset||0); const ncomp={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 if(a.componentType===5126)return new Float32Array(bin.buffer, bin.byteOffset+start, a.count*ncomp);
 return new Uint16Array(bin.buffer, bin.byteOffset+start, a.count);}
const node=json.nodes.find(nd=>nd.name==='balloon_envelope');
const prim=json.meshes[node.mesh].primitives[0];
const pos=arr(prim.attributes.POSITION), uv=arr(prim.attributes.TEXCOORD_0), idx=arr(prim.indices);
const cloth=C.buildCloth(pos, uv, idx, 0);
const rows=[];
for(const line of fs.readFileSync(path.join(ROOT,'tools/transitions-continuous/fixtures/m2-camtrace-full.txt'),'utf8').split('\n')){
  const m=/t=([\d.]+) pos=([-\d.]+),([-\d.]+),([-\d.]+) yaw=([-\d.]+) pitch=([-\d.]+) fov=([\d.]+) w=(\S+)/.exec(line);
  if(!m||!m[8].startsWith('BalloonTransit:B1'))continue;
  const t=+m[1], x=+m[2], y=+m[3], z=+m[4], yawD=+m[5]*Math.PI/180, pitch=+m[6]*Math.PI/180, fov=+m[7];
  const F=[Math.sin(yawD)*Math.cos(pitch), Math.sin(pitch), -Math.cos(yawD)*Math.cos(pitch)];
  rows.push({t, eye:[x,y,z], target:[x+F[0], y+F[1], z+F[2]], fov});
}
const t0=rows[0].t;
let held=null;
for(const r of rows){const dt=r.t-t0; const d=Math.hypot(r.eye[0]-o[0], r.eye[1]-o[1], r.eye[2]-o[2]); if(r.fov<=46.05&&d<8){held=r; break;}}
const want=[0, held.t-t0, 2.25, 3];
const seq=[];
for(const dt of want){
  let best=rows[0], bd=1e9;
  for(const r of rows){const d=Math.abs(r.t-t0-dt); if(d<bd){bd=d; best=r;}}
  seq.push({dt:+(best.t-t0).toFixed(3), eye:toLocal(best.eye), target:toLocal(best.target), fov:best.fov, shape:+C.clothShape01(best.t-t0).toFixed(4)});
}
const close={eye:toLocal(held.eye), target:toLocal(held.target), fov:held.fov, traceT:+held.t.toFixed(3), dt:+(held.t-t0).toFixed(3)};
const dir=path.join(ROOT,'product/2026-11-06/balloon-mound-cloth');
fs.mkdirSync(dir,{recursive:true});
const times=[0,1.5,2.25,3];
for(const t of times){
  const p=C.clothPositions(cloth,t);
  fs.writeFileSync(path.join(dir,`shell-t${t}.f32`), Buffer.from(p.buffer, p.byteOffset, p.byteLength));
}
const pose=D.balloonDrapePose(0);
const scaled=new Float32Array(pos.length);
for(let i=0;i<pos.length/3;i++){
  scaled[i*3]=pos[i*3]*pose.sxz;
  scaled[i*3+1]=pose.mouthY+(pos[i*3+1]-3.05)*pose.sy;
  scaled[i*3+2]=pos[i*3+2]*pose.sxz;
}
fs.writeFileSync(path.join(dir,'scale-t0.f32'), Buffer.from(scaled.buffer, scaled.byteOffset, scaled.byteLength));
fs.writeFileSync(path.join(dir,'envelope.idx'), Buffer.from(Buffer.from(idx.buffer)));
const meta={vehicle:{pos:o,yaw},close,seq,times,notEngine:true,notLiveWorldPose:true,
  source:'m2-camtrace-full.txt BalloonTransit:B1, basket local via vehicle(0)',
  aspect:[390,844], shape:'clothShape01 = (t/3)^3 on the B1 clock'};
fs.writeFileSync(path.join(dir,'cameras.json'), JSON.stringify(meta,null,2));
process.stdout.write(JSON.stringify({close, seq, n:pos.length/3}));
"""
    raw = subprocess.check_output(["node", "-e", script], cwd=ROOT)
    return json.loads(raw)


def env_tris(R, js, blob, images, pos):
    names = {n["name"]: i for i, n in enumerate(js["nodes"])}
    i = names["balloon_envelope"]
    prim = js["meshes"][js["nodes"][i]["mesh"]]["primitives"][0]
    uv = R.read_acc(js, blob, prim["attributes"]["TEXCOORD_0"]).astype(np.float64).reshape(-1, 2)
    nrm = R.read_acc(js, blob, prim["attributes"]["NORMAL"]).astype(np.float64).reshape(-1, 3)
    idx = R.read_acc(js, blob, prim["indices"]).reshape(-1, 3).astype(np.int64)
    mat = prim.get("material", 0)
    tex_i = js["materials"][mat]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    tex = images[js["textures"][tex_i]["source"]]
    col = np.stack([R.sample(tex, uv[k, 0], uv[k, 1]) for k in range(len(uv))])
    P = np.asarray(pos, np.float64).reshape(-1, 3)
    out = []
    for a, b, c in idx:
        out.append((P[a], P[b], P[c], nrm[a], nrm[b], nrm[c], col[a], col[b], col[c]))
    return out


def stamp(img, line1, line2):
    font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", 15)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, img.width, 40), fill=(12, 16, 24))
    d.text((4, 1), line1, fill=(255, 255, 255), font=font)
    d.text((4, 20), line2, fill=(220, 230, 210), font=font)
    return img


def main():
    R = load_render()
    R.W, R.H = 390, 844
    meta = pack()
    js, blob = R.load_glb(R.GLB)
    images, world_of = R.gather(js, blob)
    rest = R.build_scene(js, blob, images, world_of, {}, {"balloon_envelope", "burner_flame"})
    OUT.mkdir(parents=True, exist_ok=True)
    close = meta["close"]
    eye = np.array(close["eye"], float)
    target = np.array(close["target"], float)
    fov = close["fov"]

    def shoot(pos_file, eye_, target_, fov_, a, b, name):
        pos = np.fromfile(OUT / pos_file, dtype=np.float32)
        tris = rest + env_tris(R, js, blob, images, pos)
        img = Image.fromarray(R.render(tris, np.array(eye_, float), np.array(target_, float), fov_))
        stamp(img, a, b)
        img.save(OUT / name)
        print("wrote", name, flush=True)
        return img

    shoot("scale-t0.f32", eye, target, fov, "非引擎 记录的B1特写 旧缩放 t=0", "不是 liveWorldPose", "close-scale-before.png")
    stills = []
    for t in (0, 1.5, 2.25, 3):
        u = 0 if t <= 0 else 1 if t >= 3 else (t / 3) ** 3
        im = shoot(f"shell-t{t}.f32", eye, target, fov, f"非引擎 同一记录特写 壳 t={t:g}", f"shape {u:.3f}  fov {fov:.2f}", f"close-shell-t{t:g}.png")
        stills.append(im)
    seq_imgs = []
    for row in meta["seq"]:
        t = 0 if row["dt"] < 0.2 else 1.5 if row["dt"] < 2 else 2.25 if row["dt"] < 2.8 else 3
        # use the shape clock, not the nearest still: pick the shell file closest in shape
        shapes = [(abs((tt / 3) ** 3 - row["shape"]), tt) for tt in (0, 1.5, 2.25, 3)]
        tt = min(shapes)[1]
        im = shoot(f"shell-t{tt}.f32", row["eye"], row["target"], row["fov"], f"非引擎 轨迹 dt={row['dt']}s", f"fov {row['fov']:.2f}  shape {row['shape']}", f"trace-dt{row['dt']}.png")
        seq_imgs.append(im)
    strip = Image.new("RGB", (390 * len(stills) + 8 * (len(stills) - 1), 844), (12, 16, 24))
    for i, im in enumerate(stills):
        strip.paste(im, (i * (390 + 8), 0))
    strip.save(OUT / "close-shell-0-1.5-2.25-3.png")
    print("done", OUT)


if __name__ == "__main__":
    main()
